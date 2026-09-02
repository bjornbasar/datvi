# `@twobots/game-kit/timing`

A jittered per-action delay, so a bot's turn reads as a move happening rather than a whole
turn resolving instantly.

```ts
import { botThinkingDelayMs } from '@twobots/game-kit/timing'
```

| Symbol | Signature | Notes |
|---|---|---|
| `botThinkingDelayMs` | `(range: readonly [number, number]) => number` | A random delay within `range`, in milliseconds. |

Source: `src/timing/thinking.ts`.

## Why it isn't seeded

`pickNames` threads a caller-supplied RNG state because identical seeds have to produce
identical bot names for deterministic replay. This does the opposite on purpose: a bot's
per-action pause is a rendering-timing artifact with no effect on the game log or the
outcome, so seeding it would buy nothing and cost a parameter every call site would have
to supply. Plain `Math.random()` is correct here specifically because nothing downstream
depends on the value being reproducible.

## Why the range is a parameter, not a constant

This package owns the jitter shape — draw a number between two bounds — not the bounds
themselves. Two real games already wanted different shapes from the same mechanism: one
uses a single flat range for every bot, the other varies the range by bot persona so a
"decisive" opponent reads as consistently quicker than a "deliberate" one. Baking in one
app's numbers would make this package a second opinion about a per-game tuning decision
it has no way to keep informed — the same reasoning that keeps `pickNames`'s word list
generic over the caller's RNG rather than its seeding scheme.

## Where the delay gets scheduled

This function only computes a duration. Actually pausing between actions — a
`setTimeout` in each app's own bot-turn effect, re-fired after every resulting state
change so a chained sequence of actions gets its own independent pause — stays in each
consuming app, since that's woven into its own turn-loop and session state.
