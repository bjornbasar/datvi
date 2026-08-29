# datvi

Shared non-visual logic for the [`twobots.dev`](https://twobots.dev) card-game lineup —
a seeded bot-naming pool/picker, and feedback-sending primitives. Published to npm as
**`@twobots/game-kit`**.

Sibling to [otso](https://github.com/bjornbasar/otso) (`@twobots/ui-theme`, the visual
material) — split into a second package rather than folded into that one because neither
of these belongs under a name that says "ui-theme": a bot-naming pool and a feedback
retry queue are not visual material.

Repo name **datvi** — Georgian for "bear," matching the workspace's authorship-naming
convention (the repo/package split mirrors otso's: the repo carries the bear name, the
npm package carries the consumer-facing name).

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
- `usableStorage` — whether a `Storage` reference will actually accept a write.

**Out of scope, stays in each app**: the report payload schema itself (`Report`,
`ReportEnv`, and whatever `reportFrom`-equivalent builds one) — that's inherently tied
to each game's own replay/match-record format, not shared material. A game's own
storage key (e.g. karu's `karu.feedback.queue.v1`) stays local too, so two games'
queues never collide.

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
  usableStorage,
} from '@twobots/game-kit/feedback'
```

## License

MIT — see [LICENSE](LICENSE).
