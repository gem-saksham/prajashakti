/**
 * useSupportedIds — optimistic local set of supported issue IDs, persisted in
 * AsyncStorage. Mirrors the web's `ps_supported_ids` localStorage bucket.
 */
import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supportApi } from '../utils/api';
import { enqueueSupport, subscribeSupportDrain } from '../services/supportQueue';

const KEY = 'ps_supported_ids';

export function useSupportedIds() {
  const [ids, setIds] = useState(() => new Set());
  const [ready, setReady] = useState(false);

  // Hydrate from storage once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        const arr = raw ? JSON.parse(raw) : [];
        if (!cancelled && Array.isArray(arr)) setIds(new Set(arr));
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (next) => {
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  }, []);

  /**
   * Toggle support on an issue. Optimistic update; reverts on network-failure
   * when online. When offline, queues the action for later replay and keeps
   * the optimistic state.
   */
  const toggle = useCallback(
    async (issueId) => {
      const alreadySupported = ids.has(issueId);

      const next = new Set(ids);
      if (alreadySupported) next.delete(issueId);
      else next.add(issueId);
      setIds(next);
      persist(next);

      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        await enqueueSupport(issueId, alreadySupported ? 'unsupport' : 'support');
        return true; // Optimistic — will drain when back online.
      }

      try {
        if (alreadySupported) await supportApi.unsupport(issueId);
        else await supportApi.support(issueId);
        return true;
      } catch {
        // revert
        const reverted = new Set(ids);
        setIds(reverted);
        persist(reverted);
        return false;
      }
    },
    [ids, persist],
  );

  // Drain any queued support actions whenever the network returns.
  useEffect(() => {
    if (!ready) return undefined;
    return subscribeSupportDrain(
      (id) => supportApi.support(id),
      (id) => supportApi.unsupport(id),
    );
  }, [ready]);

  const has = useCallback((id) => ids.has(id), [ids]);

  return { has, toggle, ready, size: ids.size };
}
