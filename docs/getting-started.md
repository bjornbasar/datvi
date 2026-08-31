# Getting started

## Install

```bash
npm install @twobots/game-kit
```

Requires Node **>= 22.13**, and a build that **transpiles this package's TypeScript**. The package
ships raw `src/` with no compiled output, so a bundler configured to skip `node_modules` will fail
on an untransformed `.ts` import. In Next.js that means listing it in `transpilePackages`; Vite
handles it without configuration.

## Naming the bots

`pickNames` never seeds anything. You pass your RNG state **and** the function that advances it, and
get back the names plus the next state:

```ts
import { pickNames } from '@twobots/game-kit/names'

// Any PRNG whose step returns [value, nextState] fits — this shape is the whole contract.
const nextInt = (state: number, bound: number): readonly [number, number] => {
  const s = (state * 1664525 + 1013904223) >>> 0
  return [s % bound, s]
}

const [names, seedAfter] = pickNames(2, seed, nextInt)
// names -> e.g. ['Baavgai', 'Khers'] — distinct, and identical for an identical seed
```

Keep `seedAfter` if the same stream feeds anything else. If your game guarantees deterministic
replay, draw names from a **presentation stream** separate from the one that deals cards — otherwise
naming the bots perturbs the deal, and a replay of the same seed produces a different game.

## Storage that survives private browsing

Never touch `localStorage` directly. `pickStorage` takes a *getter*, because reading
`window.localStorage` can itself throw before you reach a method:

```ts
import { pickStorage, readJSON, writeJSON, isCount } from '@twobots/game-kit/storage'

const store = pickStorage(() => globalThis.localStorage)  // real store, or an in-memory stand-in

writeJSON(store, 'myapp.wins.v1', 3)

const result = readJSON(store, 'myapp.wins.v1')
if (result.ok) {
  const wins = isCount(result.raw) ? result.raw : 0   // raw is `unknown` — narrow before trusting it
} else if (result.why === 'unreadable') {
  // Corrupt, not first-run. Worth logging before you overwrite it.
}
```

Two habits the API is shaped to enforce: **check `why`** rather than treating any failed read as a
new player, and **narrow `raw`** rather than casting it. Anything in a browser store is untrusted —
it may have been written by an older version of your own app.

## Queueing feedback that has nowhere to go yet

`createFeedbackQueue` is bound to one storage key, which **you** supply and version:

```ts
import { createFeedbackQueue, clampBytes, MAX_NOTE_BYTES } from '@twobots/game-kit/feedback'

interface Report { id: string; note: string }

const queue = createFeedbackQueue<Report>('myapp.feedback.queue.v1')

// Clamp in BYTES, not characters — the server's limit is a byte limit, and
// String.length cannot tell 3,000 ASCII characters from 3,000 emoji.
queue.enqueue(store, { id: crypto.randomUUID(), note: clampBytes(note, MAX_NOTE_BYTES) })
```

Change the report's shape and change the key in the same edit — `v1` becomes `v2`, and yesterday's
bytes are ignored rather than misparsed.

Flushing needs a `Transport`, which is where `fetch` lives — in *your* code, not this package's:

```ts
const transport = async (body: string): Promise<number> => {
  const res = await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  })
  return res.status
}

const { sent, dropped, kept } = await queue.flushQueue(store, transport)
```

Three counters, not a boolean: all three outcomes occur in one pass, and a caller that only learns
"did it work" cannot tell a healthy flush from one quietly discarding reports.

**Hold your own in-flight guard around `flushQueue`.** An installed PWA and a browser tab share an
origin and both will flush. Server-side dedupe on the report id is what makes that safe; this
package only avoids making it worse within a single document.

## Where to go next

Full symbol-by-symbol reference, with the reasoning behind each shape:
[names](api/names.md) · [feedback](api/feedback.md) · [storage](api/storage.md).
