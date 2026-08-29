/**
 * Byte-safe sizing for anything a server caps in bytes rather than characters.
 *
 * `String.length` cannot see the difference between 2000 characters of plain ASCII
 * and 2000 characters of Tagalog with diacritics or of emoji — the latter two are
 * several kilobytes. Measuring in characters would mean the longest, most considered
 * notes are exactly the ones that come back rejected for size.
 *
 * These caps are shared backend constraints, not a per-app tuning knob: every
 * twobots.dev game currently posts feedback through the same wojtek endpoint, which
 * enforces the same byte limits regardless of which game is reporting.
 */
export const MAX_NOTE_BYTES = 3000
export const MAX_CONTACT_BYTES = 150
/** The whole body. Comfortably under the server's 192KB so a real report never 413s. */
export const MAX_BODY_BYTES = 64 * 1024

const encoder = new TextEncoder()
export const byteLength = (text: string): number => encoder.encode(text).length

/**
 * Truncate to a byte budget without splitting a character.
 *
 * `TextEncoder` has no partial-encode, so this walks back from an over-long slice.
 * Cheap at these sizes, and it cannot produce a lone surrogate the way a naive
 * `slice` would.
 */
export function clampBytes(text: string, max: number): string {
  if (byteLength(text) <= max) return text
  let out = text.slice(0, max)
  while (byteLength(out) > max) out = out.slice(0, -1)
  return out
}
