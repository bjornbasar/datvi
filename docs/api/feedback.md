# `@twobots/game-kit/feedback`

Primitives for getting a player's report off their device and to a server that may not be
reachable yet. Three concerns, deliberately separate: **sizing** what you send, **classifying**
what came back, and **holding on** to what did not get through.

```ts
import { clampBytes, MAX_NOTE_BYTES, sendReport, createFeedbackQueue } from '@twobots/game-kit/feedback'
```

## Sizing — `src/feedback/bytes.ts`

`String.length` cannot tell 2,000 characters of ASCII from 2,000 characters of Tagalog with
diacritics, or of emoji — the latter are several kilobytes. Measuring in characters means the
longest, most considered notes are exactly the ones rejected for size.

| Symbol | Signature | Notes |
|---|---|---|
| `byteLength` | `(text: string) => number` | UTF-8 byte count, via `TextEncoder`. |
| `clampBytes` | `(text: string, max: number) => string` | Truncates to a byte budget **without splitting a character**. `TextEncoder` has no partial encode, so it walks back from an over-long slice — cheap at these sizes, and it cannot leave a lone surrogate the way a naive `slice` would. |
| `MAX_NOTE_BYTES` | `3000` | The player's free-text note. |
| `MAX_CONTACT_BYTES` | `150` | Optional contact detail. |
| `MAX_BODY_BYTES` | `65536` | The whole request body. |

These are **shared backend constraints, not per-app tuning**: every twobots.dev game posts through
the same wojtek endpoint, which enforces the same limits whichever game is reporting. Change them
here only when that endpoint changes.

## Sending — `src/feedback/transport.ts`

| Symbol | Signature | Notes |
|---|---|---|
| `Transport` | `(body: string) => Promise<number>` | You supply the transport; it returns an HTTP status. The package never imports `fetch`, so it stays testable and free of any assumption about your network layer. |
| `SendOutcome` | `'sent' \| 'duplicate' \| 'rejected' \| 'retryable'` | The four things that can happen, named for what the caller should *do*. |
| `outcomeOf` | `(status: number) => SendOutcome` | Maps a status to an outcome. |
| `sendReport` | `<R>(transport: Transport, report: R) => Promise<SendOutcome>` | Serialises and sends one report. |

The distinction that matters is **`rejected` versus `retryable`**. A rejected report will never
succeed however often you try, so retrying it burns the queue slot a recoverable report needs.
Anything ambiguous — status `0` from a network failure or an opaque cross-origin response, `429`,
any `5xx` — is classified `retryable`, which is the safe direction: a duplicate is harmless
because the server dedupes on `reportId`, whereas a dropped report is the one thing a feedback
feature exists to prevent.

**`outcomeOf` does not currently return `'duplicate'`** — it maps `200` to `sent`, non-`429`
`4xx` to `rejected`, and everything else to `retryable`. The member exists because
`flushQueue` treats `duplicate` as a success alongside `sent`, so a transport that *can*
distinguish an already-held report (or a future server contract that does) needs somewhere to
say so without the queue counting it as a failure. Today no code path produces it; that is a
deliberate seam, not an oversight, and it is why the union is worth reading before you write a
`switch` over it.

## Queueing — `src/feedback/queue.ts`

| Symbol | Signature | Notes |
|---|---|---|
| `createFeedbackQueue` | `<R>(key: string) => FeedbackQueue<R>` | Builds a queue bound to one storage key. |
| `FeedbackQueue` | interface | `enqueue`, `queuedCount`, `clearQueue`, `flushQueue`. |
| `QueuedReport` | `{ report: R; attempts: number }` | One pending report and its attempt count. |
| `MAX_ATTEMPTS` | `8` | Past this a report is dropped: something is permanently wrong and the slot is needed. |
| `MAX_QUEUE_BYTES` | `131072` | The queue is capped in bytes, not entries — see the note below. |

`flushQueue` resolves to `{ sent, dropped, kept }` rather than a boolean, because all three
outcomes happen in one pass and a caller that only learns "did it work" cannot tell a healthy
flush from one quietly discarding reports.

**The key is a parameter, not a package constant.** Each app supplies its own — karu's is
`karu.feedback.queue.v1` — so two games' queues can never collide, and it is versioned the same
way the app's match-record key is. Change the report's shape and change the key in the same edit;
yesterday's bytes are then ignored rather than misparsed.

**Generic over `R` on purpose.** Nothing here needs a report to be anything but
JSON-serialisable. The payload schema belongs to the app; the queue mechanics belong here.

## Why the cap is in bytes

`localStorage` quotas are byte quotas, and a queue capped at *n* entries can still overflow one
if a player writes a long note. Capping in bytes means the failure is bounded by the same unit
the browser enforces, so `enqueue` can return `false` honestly instead of throwing from inside a
`try` several frames later.
