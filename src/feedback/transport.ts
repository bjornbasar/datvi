/**
 * Sending a report, and reading what the server actually said.
 *
 * Deliberately touches neither the network nor any one app's report shape: the
 * transport and the report are both arguments, so every path here is exercisable
 * from a DOM-free test suite regardless of which game is calling it.
 */

/** The transport, injected. Resolves to an HTTP status, or 0 for a network-level failure. */
export type Transport = (body: string) => Promise<number>

/**
 * What the caller learned, and — the part that matters — whether it is worth
 * retrying.
 *
 * `rejected` and `retryable` are not the same outcome even though a browser often
 * cannot tell them apart: a 400 will never succeed, so retrying it forever would
 * occupy a queue slot a real report needs. Anything ambiguous is treated as
 * retryable, which is the safe direction — a duplicate is harmless because the
 * server dedupes on `reportId`, while a dropped report is the one thing a feedback
 * feature exists to prevent.
 */
export type SendOutcome = 'sent' | 'duplicate' | 'rejected' | 'retryable'

export function outcomeOf(status: number): SendOutcome {
  if (status === 200) return 'sent'
  // A permanent client error. Never queued: it cannot start succeeding.
  if (status >= 400 && status < 500 && status !== 429) return 'rejected'
  // 0 (network / opaque CORS rejection), 429, 5xx — all worth another try.
  return 'retryable'
}

export async function sendReport<R>(transport: Transport, report: R): Promise<SendOutcome> {
  let status: number
  try {
    status = await transport(JSON.stringify(report))
  } catch {
    // A thrown transport is a network failure by definition — the request never
    // got an answer we can read, which is also what an unreadable cross-origin
    // response looks like. Retryable, and the server's dedupe makes that safe.
    status = 0
  }
  return outcomeOf(status)
}
