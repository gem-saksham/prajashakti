/**
 * Event Bus — lightweight in-process event emitter.
 *
 * In Phase 2 Sprint 5 this module will be swapped for a Kafka producer.
 * All callers use the same `emit(eventName, payload)` interface so the
 * swap is a single-file change.
 *
 * Events emitted today:
 *   issue.supported          { issueId, userId, newCount, weight }
 *   issue.unsupported        { issueId, userId, newCount }
 *   issue.milestone.reached  { issueId, milestone, crossedAt }
 *   issue.trending           { issueId }
 */

import { EventEmitter } from 'events';

export const eventBus = new EventEmitter();

// Silence Node's default "possible EventEmitter memory leak" warning —
// in prod we'll have many long-lived subscribers on the milestone channel.
eventBus.setMaxListeners(50);

/**
 * Emit an event synchronously to all in-process listeners.
 * Logs in development/test; silent in production (Kafka takes over).
 *
 * @param {string} eventName
 * @param {object} payload
 */
export function emit(eventName, payload) {
  eventBus.emit(eventName, payload);

  if (process.env.NODE_ENV !== 'production') {
    // Compact single-line log so test output isn't noisy
    const preview = JSON.stringify(payload).slice(0, 120);
    process.stdout.write(`[event] ${eventName} ${preview}\n`);
  }
}
