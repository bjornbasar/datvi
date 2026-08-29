import { byteLength } from './bytes.js'
import { sendReport, type Transport } from './transport.js'
import { usableStorage } from '../storage/storage.js'

export interface QueuedReport<R> {
  readonly report: R
  readonly attempts: number
}

/** Beyond this a report is dropped: something is permanently wrong and the slot is needed. */
export const MAX_ATTEMPTS = 8
/** The queue, capped in bytes — see `enqueue`. */
export const MAX_QUEUE_BYTES = 128 * 1024

export interface FeedbackQueue<R> {
  enqueue(store: Storage, report: R): boolean
  queuedCount(store: Storage): number
  clearQueue(store: Storage): void
  flushQueue(
    store: Storage,
    transport: Transport,
  ): Promise<{ sent: number; dropped: number; kept: number }>
}

/**
 * An offline retry queue, bound to one app's own storage key.
 *
 * The key is a parameter rather than a package constant: each app needs its own,
 * distinct key (karu's is `karu.feedback.queue.v1`) so two games' queues never
 * collide, and versioned the same way each app's own match-record key is — change the
 * report's shape, change the key in the same edit, and yesterday's bytes are ignored
 * rather than misparsed.
 *
 * Generic over the report shape `R`: everything here only needs a report to be
 * JSON-serialisable, never to know its fields. Each app keeps its own `Report`/
 * `ReportEnv` types — those are payload schemas, not queue mechanics.
 */
export function createFeedbackQueue<R>(key: string): FeedbackQueue<R> {
  const readQueue = (store: Storage): QueuedReport<R>[] => {
    try {
      const raw = store.getItem(key)
      if (raw === null) return []
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      // Shape-checked loosely: a corrupt queue should empty, never throw during a render.
      return parsed.filter(
        (q): q is QueuedReport<R> =>
          typeof q === 'object' && q !== null && 'report' in q && typeof q.report === 'object',
      )
    } catch {
      return []
    }
  }

  /**
   * Persist the queue, and **give up rather than compete with anything else in
   * storage.** Callers with something more important stored under their own key
   * (karu's match record, for instance) rely on the queue never being what makes
   * that other write fail — so a full disk drops the queue, not the caller's write.
   */
  function writeQueue(store: Storage, queue: readonly QueuedReport<R>[]): boolean {
    try {
      store.setItem(key, JSON.stringify(queue))
      return true
    } catch {
      try {
        store.removeItem(key)
      } catch {
        /* Nothing left to try, and a crash here helps nobody. */
      }
      return false
    }
  }

  /**
   * Add a report to the queue, capped in **bytes** rather than entries.
   *
   * A record-bearing report can be 10-25KB and a bare note a few hundred bytes, so
   * "five entries" is anywhere between 2KB and 125KB — a limit that does not limit
   * the thing being worried about. The oldest go first: a fresh report describes a
   * bug the player is looking at right now.
   */
  function enqueue(store: Storage, report: R): boolean {
    if (!usableStorage(store)) return false
    const queue = [...readQueue(store), { report, attempts: 1 }]
    while (queue.length > 1 && byteLength(JSON.stringify(queue)) > MAX_QUEUE_BYTES) queue.shift()
    return writeQueue(store, queue)
  }

  function queuedCount(store: Storage): number {
    return readQueue(store).length
  }

  function clearQueue(store: Storage): void {
    try {
      store.removeItem(key)
    } catch {
      /* See writeQueue. */
    }
  }

  /**
   * Try every queued report once, and rewrite the queue with whatever still needs
   * sending.
   *
   * Sequential rather than parallel: these are retries of things nobody is waiting
   * for, and a burst would trip the server's rate limit and convert a queue into a
   * longer queue.
   *
   * **Caller must hold an in-flight guard.** Two documents can share one origin (an
   * installed PWA and a browser tab), and both will flush. Server-side dedupe on
   * `reportId` is what makes that safe rather than duplicative; this only avoids
   * making it worse within a single document.
   */
  async function flushQueue(
    store: Storage,
    transport: Transport,
  ): Promise<{ sent: number; dropped: number; kept: number }> {
    const queue = readQueue(store)
    if (queue.length === 0) return { sent: 0, dropped: 0, kept: 0 }

    const keep: QueuedReport<R>[] = []
    let sent = 0
    let dropped = 0

    for (const entry of queue) {
      const outcome = await sendReport(transport, entry.report)
      if (outcome === 'sent' || outcome === 'duplicate') {
        sent += 1
        continue
      }
      if (outcome === 'rejected') {
        // Permanently unacceptable. Dropping is the honest choice: it will never
        // succeed, and keeping it would starve the queue of room for reports that would.
        dropped += 1
        continue
      }
      const attempts = entry.attempts + 1
      if (attempts > MAX_ATTEMPTS) dropped += 1
      else keep.push({ report: entry.report, attempts })
    }

    if (keep.length === 0) clearQueue(store)
    else writeQueue(store, keep)

    return { sent, dropped, kept: keep.length }
  }

  return { enqueue, queuedCount, clearQueue, flushQueue }
}
