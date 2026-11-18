# `@twobots/game-kit/lives`

A session limiter — not an energy meter. Regains 1 life per hour, caps at a fixed count, and
has **no refill path other than its own clock.** There is deliberately no purchase, ad-reward,
or any other way to add a life outside `regenerate`.

```ts
import { consume, initialLives, msUntilNextLife, regenerate } from '@twobots/game-kit/lives'
```

Source: `src/lives/lives.ts`.

## Why "never purchasable" is the whole point

This is mechanically the standard free-to-play energy gate. The one thing distinguishing it
from one is that it cannot be bought, and that distinction is the reason it exists: it
continues the anti-addiction line each game's own match-ending rule already takes (a hand
limit or score floor so a sitting has somewhere to stop). A limiter that can be bypassed with
a purchase or a watched ad is not a limiter, it's a funnel — so this package ships with no
such path, and adding one should be argued against the issue that specified this feature,
not added quietly here.

## The state

| Symbol | Signature | Notes |
|---|---|---|
| `LivesState` | `{ count: number; lastRegenAt: number }` | `count` is `0..cap`. `lastRegenAt` is an epoch-ms clock the regen math advances by whole intervals — never snapped to "now." |
| `initialLives` | `(cap?: number, now?: number) => LivesState` | Starts full. A first-ever visit is not a worse deal than one returning after a long absence. |

## Spending and regaining

| Symbol | Signature | Notes |
|---|---|---|
| `consume` | `(state: LivesState) => LivesState \| null` | Decrements by 1. `null` (refuses) at 0. Leaves `lastRegenAt` untouched — spending a life does not help the regen clock. |
| `canConsume` | `(state: LivesState) => boolean` | `state.count > 0`. |
| `regenerate` | `(state: LivesState, now: number, cap?: number, regenMs?: number) => LivesState` | Credits only whole elapsed intervals. No-ops at the cap. |
| `msUntilNextLife` | `(state: LivesState, now: number, cap?: number, regenMs?: number) => number \| null` | `null` once at the cap. |

`DEFAULT_LIVES_CAP` (`5`) and `DEFAULT_REGEN_MS` (one hour) are exported for callers that want
the stock shape; every function also takes them as explicit parameters for a caller that
wants a different cap or rate.

## Why `regenerate` advances the clock by whole intervals, not to `now`

The tempting implementation sets `lastRegenAt = now` after crediting whatever lives are due.
It is wrong: it discards whatever fraction of the *next* interval had already elapsed, so a
player checking back every few minutes would see the countdown restart from zero on every
single check instead of ever visibly progressing. Advancing by `consumedIntervals * regenMs`
— and by nothing at all when no whole interval has passed — keeps that partial progress
live across every call, which is what makes an ambient "next life in Nm" readout honest.

## Honour-system by design, and why that's acceptable here

`lastRegenAt` is a device-clock timestamp. An offline-capable app (a service worker, no
server) cannot do better than that without a backend — and changing the device clock
defeats it. That's fine for what this is for: the player who'd circumvent it is the player
it exists to help pause, and they've made their choice. The hard constraint this implies:
**lives must never gate anything paid or competitive.** If they ever need to, that requires
a server-backed version — a materially larger feature than this one, and not this package's
job to become.

## Storage and the UI are the caller's

This module is pure and storage-agnostic, matching `timing`'s own split between "how to
compute a value" and "what a caller does with it." Persisting a `LivesState` (typically via
`@twobots/game-kit/storage`'s `readJSON`/`writeJSON`, validated with `isBag`/`isCount` before
trusting a stored record) and deciding when to call `regenerate` — on mount, on
`visibilitychange`, on an interval for a live countdown — are each app's own concern.
