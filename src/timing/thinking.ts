/**
 * A bot's "thinking time" — a randomized per-action delay so a bot's turn reads as a
 * move happening rather than a whole turn resolving instantly. Independently built
 * twice already: andarta's own flat 1-5s draw, and karu's per-persona jittered range
 * (fox reads faster/more decisive, bear noticeably longer) — both apps' own doc
 * comments call this out as a rendering-timing artifact with no effect on the game
 * log or replay determinism, which is exactly why it's plain `Math.random()` and takes
 * no RNG state, unlike `pickNames`.
 *
 * This package owns the jitter shape only. It does not own the range: karu's own
 * per-persona split and andarta's flat one are each a product-tuning decision, not
 * shared material — a caller supplies its own `[min, max]`, per persona/tier or not,
 * however its own bot design wants to.
 */
export function botThinkingDelayMs(range: readonly [number, number]): number {
  const [min, max] = range
  return min + Math.random() * (max - min)
}
