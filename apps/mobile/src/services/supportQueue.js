/**
 * supportQueue — offline queue for support/unsupport actions.
 *
 * When NetInfo reports the device is offline, calling enqueueSupport(issueId,
 * action) stores the intent. On reconnect, drainSupportQueue() replays each
 * queued action against the API. Multiple queued actions for the same issue
 * collapse to the final net state (last wins).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const QUEUE_KEY = 'prajashakti_support_queue';

async function readQueue() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue) {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    /* best-effort */
  }
}

function collapse(queue) {
  // Keep only the last action per issueId.
  const map = new Map();
  for (const item of queue) map.set(item.issueId, item);
  return [...map.values()];
}

export async function enqueueSupport(issueId, action) {
  const queue = await readQueue();
  queue.push({ issueId, action, queuedAt: new Date().toISOString() });
  await writeQueue(collapse(queue));
}

export async function getSupportQueueSize() {
  const queue = await readQueue();
  return queue.length;
}

export async function drainSupportQueue(supportFn, unsupportFn) {
  const state = await NetInfo.fetch();
  if (!state.isConnected) return { succeeded: 0, failed: 0, skipped: true };

  const queue = collapse(await readQueue());
  if (queue.length === 0) return { succeeded: 0, failed: 0 };

  const remaining = [];
  let succeeded = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      if (item.action === 'support') await supportFn(item.issueId);
      else await unsupportFn(item.issueId);
      succeeded += 1;
    } catch {
      remaining.push(item);
      failed += 1;
    }
  }

  await writeQueue(remaining);
  return { succeeded, failed };
}

export function subscribeSupportDrain(supportFn, unsupportFn, onDrained) {
  return NetInfo.addEventListener(async (state) => {
    if (!state.isConnected) return;
    const result = await drainSupportQueue(supportFn, unsupportFn);
    if (onDrained) onDrained(result);
  });
}
