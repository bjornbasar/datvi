# @twobots/game-kit

Shared non-visual logic for the [`twobots.dev`](https://twobots.dev) card-game lineup —
a seeded bot-naming pool/picker, feedback-sending primitives (byte-safe clamping, an
offline retry queue, a send-outcome classifier), and storage primitives. Ships raw
source; consuming apps compile it with their own TypeScript pipeline.

Sibling to [`@twobots/ui-theme`](https://www.npmjs.com/package/@twobots/ui-theme) (the
visual material) — split into a second package rather than folded into that one because
neither of these belongs under a name that says "ui-theme": a bot-naming pool and a
feedback retry queue are not visual material.

## What's in it, and what deliberately isn't

**`@twobots/game-kit/names`**
- `BEAR_NAMES` — the pool: one ASCII word for "bear" per language, capitalised, short
  enough to sit under a card face and to be spoken in an event ticker.
- `pickNames(count, rng, nextInt)` — picks `count` distinct entries without
  replacement. Generic over the caller's own RNG state: this package owns the word list
  and the pick-without-replacement shape, never the seeding. Each game keeps its own
  deterministic-replay guarantee, built on its own PRNG stream-part scheme — baking a
  specific derivation in here would make this package a second opinion about a property
  it has no way to keep honest.

**`@twobots/game-kit/feedback`**
- `byteLength`/`clampBytes` + `MAX_NOTE_BYTES`/`MAX_CONTACT_BYTES`/`MAX_BODY_BYTES` —
  byte-safe sizing against a server that caps in bytes, not characters. Shared backend
  constraints, not per-app tuning: every twobots.dev game currently posts feedback
  through the same wojtek endpoint.
- `Transport`, `SendOutcome`, `outcomeOf`, `sendReport` — a status-code classifier
  (`sent`/`duplicate`/`rejected`/`retryable`) and a thin, injectable transport wrapper.
- `createFeedbackQueue<R>(key)` — an offline retry queue bound to one app's own storage
  key, generic over the report shape `R`. Everything here only needs a report to be
  JSON-serialisable, never to know its fields — each app keeps its own `Report`/
  `ReportEnv` payload schema.

**`@twobots/game-kit/storage`**
- `usableStorage`, `memoryStorage`, `pickStorage` — whether a `Storage` will actually
  accept a write, and a safe fallback when it won't.
- `deepEqual` — structural equality, used as a drift check between a replayed state
  and its stored comparison target.
- `isBag`/`isInt`/`isCount` — the type guards a restore-from-JSON validator is built
  from.
- `readJSON`/`writeJSON`/`clearKey` — try/catch-safe JSON storage, quota-safe on write
  (a failed write clears rather than leaves a partial record).

**Out of scope, stays in each app**: any payload schema itself — the feedback
`Report`/`ReportEnv`, a match's own `RestorableSession`/`MatchRecord` shape and its
validators — that's inherently tied to each game's own replay/match-record format, not
shared material. A game's own storage key (e.g. karu's `karu.feedback.queue.v1` /
`karu.match.v2`) stays local too, so two games' data never collide.

**Deliberately not here: the seeded PRNG.** karu's and andarta's engines each define the
same `RngState`/`rng`/`nextInt`/`deriveStream`/`shuffle` algorithm — verified
byte-identical, comments aside — and it would otherwise be a clean extraction. But both
apps' own architecture tests require `src/engine` (and, in andarta's case, `src/ai`) to
import *nothing* beyond relative modules and `node:` builtins, specifically so the engine
stays portable and dependency-free enough to run unchanged as an authoritative server.
An npm dependency inside either engine would violate that on purpose-built grounds, in
both repos independently — so the RNG stays duplicated, and that duplication is the
correct outcome here, not an oversight.

## Using it

```bash
npm install @twobots/game-kit
```

Pin an exact version rather than `^`/`latest` — deliberately, not by default. Two apps
floating on "whatever's newest" is exactly the kind of silent divergence this package
exists to prevent.

```ts
import { BEAR_NAMES, pickNames } from '@twobots/game-kit/names'
import {
  byteLength,
  clampBytes,
  createFeedbackQueue,
  outcomeOf,
  sendReport,
} from '@twobots/game-kit/feedback'
import { deepEqual, isBag, isCount, isInt, readJSON, usableStorage, writeJSON } from '@twobots/game-kit/storage'
```

## License

MIT — see [LICENSE](LICENSE).
