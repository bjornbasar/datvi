/**
 * A lives counter — a session limiter that regains 1 life per hour, caps at a fixed count,
 * and is **deliberately never purchasable**: this module has no refill path other than
 * `regenerate`'s own clock. karu#2 states the reasoning this package only enforces: lives
 * exist to help a willing player stop (the game is addictive by design — see each game's own
 * match-ending rule), not to meter access, so anything that let a life be bought or watched-
 * for would invert the feature's whole purpose. If that trade is ever wanted, it should be
 * argued against that issue directly rather than added quietly here.
 *
 * Honour-system and offline-tolerant on purpose: `lastRegenAt` is a device-clock timestamp, so
 * changing the clock defeats it. Acceptable — the person circumventing it is the person it was
 * protecting — but it means lives must never become load-bearing for anything paid or
 * competitive; that would need a server, which this package deliberately is not.
 *
 * Storage-agnostic and React-agnostic, matching `timing/thinking.ts`'s split: this module owns
 * the counting; each app owns persisting a `LivesState` and deciding when to call `regenerate`.
 */

export interface LivesState {
  readonly count: number
  readonly lastRegenAt: number
}

export const DEFAULT_LIVES_CAP = 5
export const DEFAULT_REGEN_MS = 60 * 60 * 1000

/** Starts full — a first-ever visit is not a worse deal than returning after a long absence. */
export function initialLives(cap: number = DEFAULT_LIVES_CAP, now: number = Date.now()): LivesState {
  return { count: cap, lastRegenAt: now }
}

/**
 * Credits only WHOLE elapsed intervals, and advances `lastRegenAt` by exactly that many
 * intervals — never snaps it to `now`. Snapping to `now` would discard partial progress
 * toward the next life every time this runs (every mount, every tick), so a player would
 * never see the countdown actually move. No-ops once at the cap, without advancing
 * `lastRegenAt` either, so a full cap can't "store up" overflow regen for a later deficit.
 */
export function regenerate(
  state: LivesState,
  now: number,
  cap: number = DEFAULT_LIVES_CAP,
  regenMs: number = DEFAULT_REGEN_MS,
): LivesState {
  if (state.count >= cap) return state
  const elapsedIntervals = Math.floor((now - state.lastRegenAt) / regenMs)
  if (elapsedIntervals <= 0) return state
  const count = Math.min(cap, state.count + elapsedIntervals)
  const consumedIntervals = count - state.count
  return { count, lastRegenAt: state.lastRegenAt + consumedIntervals * regenMs }
}

/** Refuses (returns `null`) at 0. Leaves `lastRegenAt` untouched — consuming a life does not
 * reset or otherwise help the regen clock. */
export function consume(state: LivesState): LivesState | null {
  if (state.count <= 0) return null
  return { count: state.count - 1, lastRegenAt: state.lastRegenAt }
}

export function canConsume(state: LivesState): boolean {
  return state.count > 0
}

/** `null` once already at the cap — there is no "next" life to wait for. */
export function msUntilNextLife(
  state: LivesState,
  now: number,
  cap: number = DEFAULT_LIVES_CAP,
  regenMs: number = DEFAULT_REGEN_MS,
): number | null {
  if (state.count >= cap) return null
  const elapsed = now - state.lastRegenAt
  const intoInterval = ((elapsed % regenMs) + regenMs) % regenMs
  return regenMs - intoInterval
}
