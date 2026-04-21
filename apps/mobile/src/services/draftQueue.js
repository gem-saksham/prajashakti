/**
 * draftQueue — offline-aware queue for issue drafts pending submission.
 *
 * Flow:
 *   1. User submits while offline → draft is enqueued instead of POSTed.
 *   2. NetInfo flips to connected → drain() attempts to submit each queued draft.
 *   3. Each successful submit removes the draft from storage.
 *
 * Storage: AsyncStorage key "prajashakti_issue_draft_queue" (JSON array).
 * Submission: delegates to a caller-supplied submitFn(draft) so this service
 * doesn't import the API (keeps it pure / testable).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const QUEUE_KEY = 'prajashakti_issue_draft_queue';

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
    // best-effort
  }
}

export async function enqueueDraft(draft) {
  const queue = await readQueue();
  // Photos lose their URIs when the app restarts, so drop URI-less photos
  // from the queue payload (they'd fail on upload anyway).
  const cleaned = {
    ...draft,
    photos: (draft.photos || []).filter((p) => p.uri),
    queuedAt: new Date().toISOString(),
  };
  queue.push(cleaned);
  await writeQueue(queue);
  return queue.length;
}

export async function getQueueSize() {
  const queue = await readQueue();
  return queue.length;
}

export async function clearQueue() {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

/**
 * Attempt to submit every queued draft. Submissions that fail remain in the
 * queue. Returns { succeeded, failed } counts.
 */
export async function drainQueue(submitFn) {
  const state = await NetInfo.fetch();
  if (!state.isConnected) return { succeeded: 0, failed: 0, skipped: true };

  const queue = await readQueue();
  if (queue.length === 0) return { succeeded: 0, failed: 0 };

  const remaining = [];
  let succeeded = 0;
  let failed = 0;

  for (const draft of queue) {
    try {
      await submitFn(draft);
      succeeded += 1;
    } catch {
      remaining.push(draft);
      failed += 1;
    }
  }

  await writeQueue(remaining);
  return { succeeded, failed };
}

/**
 * Listen for connection-up events and attempt to drain the queue.
 * Returns an unsubscribe function.
 */
export function subscribeNetworkDrain(submitFn, onDrained) {
  return NetInfo.addEventListener(async (state) => {
    if (!state.isConnected) return;
    const result = await drainQueue(submitFn);
    if (onDrained) onDrained(result);
  });
}

export async function isOnline() {
  const state = await NetInfo.fetch();
  return !!state.isConnected;
}
