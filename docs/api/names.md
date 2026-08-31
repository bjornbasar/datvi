# `@twobots/game-kit/names`

The bot-naming pool, and a picker for it.

```ts
import { BEAR_NAMES, pickNames } from '@twobots/game-kit/names'
```

| Symbol | Signature | Notes |
|---|---|---|
| `BEAR_NAMES` | `readonly string[]` | 30 words meaning "bear", one per language. |
| `pickNames` | `<S>(count: number, rng: S, nextInt: (state: S, bound: number) => readonly [number, S]) => readonly [names: readonly string[], next: S]` | Picks `count` distinct entries, without replacement, threading **your** RNG state through. |

Source: `src/names/bearNames.ts`.

## Why these particular words

`bear-names.md` is the workspace's naming source of truth, and its policy splits on **exposure**:
public-facing things take generic bear translations or public-domain mythic bears, while
trademarked and fandom names stay on infrastructure and private devices.

A bot name is spoken in a published game's event ticker, which is about as exposed as anything
gets here — so every entry is a plain dictionary word. No MTG cards, no Pokémon, no copyrighted
characters.

They are also **ASCII, short, and capitalised**, because they render under a card face and in a
fixed-width ticker, and *a name a player cannot type is a name they cannot tell you about* when
reporting a bug.

## The pool and claimed project names are independent

The pool does not exclude a word because it is claimed elsewhere. `Lokys` is simultaneously a bot
name here and a separate app's repo name, deliberately and at the same time.

This is worth stating because the opposite was once asserted as settled policy and was not: it had
been generalised from a single real incident — a near-*spelling* collision between `hartz` and
`hartza`, the household budget app — into a broad namespace-exclusivity rule nobody had decided.
karu's own test scopes itself to that one spelling pair rather than enforcing the invented rule.

## Why `pickNames` is generic over your RNG

The signature threads a caller-supplied state `S` rather than seeding anything itself:

```ts
const [names, next] = pickNames(2, rngState, nextInt)
```

You pass the state **and** the function that advances it, so the package can draw without ever
knowing how your generator works.

This package owns **the word list and the pick-without-replacement shape**. It does not own
seeding. Each game has its own deterministic-replay guarantee built on its own PRNG stream scheme
— karu derives a presentation stream so that naming the bots cannot perturb the deal — and baking
a derivation in here would make this package a second, competing opinion about how a game achieves
determinism.

The practical consequence: identical seeds produce identical names, and that property belongs to
the caller's RNG, not to us.

## Why it shrinks the pool instead of retrying

The implementation swaps the picked entry to the end and shrinks the pool, rather than drawing
again when it hits a duplicate. A repeat becomes **structurally impossible** instead of merely
retried against — so `pickNames(2, …)` cannot, on some unlucky seed, take a visibly long time or
return the same bear twice. That matters here specifically: the joke only works if the two
opponents differ from each other and from the table's own name.
