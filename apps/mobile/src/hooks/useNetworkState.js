/**
 * useNetworkState — subscribes to NetInfo and returns { isConnected }.
 * Starts as `true` to avoid false offline flashes on initial mount.
 */
import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useNetworkState() {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    let cancelled = false;
    NetInfo.fetch().then((state) => {
      if (!cancelled) setIsConnected(!!state.isConnected);
    });
    const unsub = NetInfo.addEventListener((state) => {
      setIsConnected(!!state.isConnected);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return { isConnected };
}
