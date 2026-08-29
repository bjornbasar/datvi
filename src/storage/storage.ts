/**
 * Storage primitives shared by every game's own persistence module —
 * write-probe feature detection, an in-memory fallback, structural equality,
 * and try/catch-safe JSON read/write. Game-agnostic on purpose: nothing here
 * imports an engine type or knows a match's shape.
 *
 * Modeled on andarta's own `matchStorage.ts`, itself "ported from karu's
 * `src/ui/persist.ts`" — this package formalises a split both apps had
 * already converged on independently, rather than inventing a new one.
 */

/**
 * Is this actually a usable store? Neither a `typeof`/`in` check nor a
 * try/catch around access is enough — in a jsdom test environment,
 * `'localStorage' in window === true` while `window.localStorage` is
 * `undefined`, and nothing throws for a catch to catch. Safari private-mode
 * has historically handed back a real `Storage` that throws on the first
 * `setItem` instead. The only check that covers both is to actually write a
 * canary and remove it.
 */
export function usableStorage(candidate: Storage | null | undefined): candidate is Storage {
  if (candidate === null || candidate === undefined) return false
  if (typeof candidate.setItem !== 'function' || typeof candidate.getItem !== 'function') {
    return false
  }
  try {
    const canary = '@twobots/game-kit.storage.probe'
    candidate.setItem(canary, '1')
    candidate.removeItem(canary)
    return true
  } catch {
    return false
  }
}

/**
 * An in-memory `Storage` stand-in for when nothing usable exists — a match
 * simply does not outlive the tab, matching an app's own behaviour before
 * persistence existed at all.
 */
export function memoryStorage(): Storage {
  const bag = new Map<string, string>()
  return {
    get length() {
      return bag.size
    },
    clear: () => bag.clear(),
    getItem: (k: string) => bag.get(k) ?? null,
    key: (i: number) => [...bag.keys()][i] ?? null,
    removeItem: (k: string) => void bag.delete(k),
    setItem: (k: string, v: string) => void bag.set(k, v),
  }
}

/**
 * Resolves to a real usable store or a safe in-memory fallback — never
 * throws, even if reading the candidate itself throws (Safari private mode
 * has denied property access outright, not just calls).
 */
export function pickStorage(getCandidate: () => Storage | null | undefined): Storage {
  let candidate: Storage | null | undefined
  try {
    candidate = getCandidate()
  } catch {
    candidate = null
  }
  return usableStorage(candidate) ? candidate : memoryStorage()
}

/**
 * Structural equality, key order and all. `JSON.stringify(a) ===
 * JSON.stringify(b)` is the tempting one-liner and it is wrong here: key
 * order in a serialised object follows insertion order, so two otherwise-
 * identical objects built by different code paths could disagree on a
 * field-order refactor that changed nothing. `undefined`/`null`/an absent key
 * stay distinct, because a JSON round-trip turns the first into the third
 * and that difference is real.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false

  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]))
  }

  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  const keys = Object.keys(left)
  if (keys.length !== Object.keys(right).length) return false
  return keys.every((k) => k in right && deepEqual(left[k], right[k]))
}

export const isBag = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

export const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)

export const isCount = (v: unknown): v is number => isInt(v) && v >= 0

export type ReadResult =
  | { readonly ok: true; readonly raw: unknown }
  | { readonly ok: false; readonly why: 'absent' | 'unreadable' }

export function readJSON(store: Storage, key: string): ReadResult {
  let text: string | null
  try {
    text = store.getItem(key)
  } catch {
    return { ok: false, why: 'unreadable' }
  }
  if (text === null) return { ok: false, why: 'absent' }
  try {
    return { ok: true, raw: JSON.parse(text) }
  } catch {
    return { ok: false, why: 'unreadable' }
  }
}

/**
 * Returns whether it worked. A failed write clears rather than leaves a
 * partial record — a truncated record that still parses is worse than no
 * record at all, since it would be silently accepted as valid.
 */
export function writeJSON(store: Storage, key: string, value: unknown): boolean {
  try {
    store.setItem(key, JSON.stringify(value))
    return true
  } catch {
    clearKey(store, key)
    return false
  }
}

export function clearKey(store: Storage, key: string): void {
  try {
    store.removeItem(key)
  } catch {
    /* Nothing useful to do, and a crash on the way out is not an improvement. */
  }
}
