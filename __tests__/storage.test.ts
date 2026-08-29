import { describe, it, expect, vi } from 'vitest'
import {
  clearKey,
  deepEqual,
  isBag,
  isCount,
  isInt,
  memoryStorage,
  pickStorage,
  readJSON,
  usableStorage,
  writeJSON,
} from '../src/storage/index.js'

describe('deepEqual', () => {
  it('is true for structurally identical plain values', () => {
    expect(deepEqual(1, 1)).toBe(true)
    expect(deepEqual('a', 'a')).toBe(true)
    expect(deepEqual({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] })).toBe(true)
  })

  it('is insensitive to key order', () => {
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
  })

  it('treats null, undefined, and an absent key as distinct', () => {
    expect(deepEqual({ a: null }, { a: undefined })).toBe(false)
    expect(deepEqual({ a: undefined }, {})).toBe(false)
    expect(deepEqual({ a: null }, {})).toBe(false)
  })

  it('treats an array and a plain object as never equal', () => {
    expect(deepEqual([1, 2], { 0: 1, 1: 2 })).toBe(false)
  })

  it('catches a nested difference', () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false)
  })
})

describe('usableStorage', () => {
  it('rejects an absent candidate', () => {
    expect(usableStorage(null)).toBe(false)
    expect(usableStorage(undefined)).toBe(false)
  })

  it('rejects something that does not look like Storage', () => {
    expect(usableStorage({} as unknown as Storage)).toBe(false)
  })

  it('rejects a candidate that throws on write', () => {
    const throwing: Storage = {
      length: 0,
      clear: () => {},
      getItem: () => null,
      key: () => null,
      removeItem: () => {},
      setItem: () => {
        throw new Error('quota exceeded')
      },
    }
    expect(usableStorage(throwing)).toBe(false)
  })

  it('accepts a real working store and leaves no canary behind', () => {
    const store = memoryStorage()
    expect(usableStorage(store)).toBe(true)
    expect(store.length).toBe(0)
  })
})

describe('memoryStorage', () => {
  it('round-trips a value', () => {
    const store = memoryStorage()
    store.setItem('k', 'v')
    expect(store.getItem('k')).toBe('v')
    store.removeItem('k')
    expect(store.getItem('k')).toBeNull()
  })

  it('getItem on a missing key returns null, not throw', () => {
    expect(memoryStorage().getItem('missing')).toBeNull()
  })
})

describe('pickStorage', () => {
  it('returns the candidate when it works', () => {
    const store = memoryStorage()
    expect(pickStorage(() => store)).toBe(store)
  })

  it('falls back to an in-memory store when the getter throws', () => {
    const store = pickStorage(() => {
      throw new Error('access denied')
    })
    store.setItem('k', 'v')
    expect(store.getItem('k')).toBe('v')
  })

  it('falls back to an in-memory store when the candidate is unusable', () => {
    const store = pickStorage(() => null)
    store.setItem('k', 'v')
    expect(store.getItem('k')).toBe('v')
  })
})

describe('readJSON / writeJSON / clearKey', () => {
  it('round-trips a plain value', () => {
    const store = memoryStorage()
    expect(writeJSON(store, 'k', { a: 1 })).toBe(true)
    const result = readJSON(store, 'k')
    expect(result).toEqual({ ok: true, raw: { a: 1 } })
  })

  it('reports absent for a missing key', () => {
    expect(readJSON(memoryStorage(), 'missing')).toEqual({ ok: false, why: 'absent' })
  })

  it('reports unreadable for malformed JSON without throwing', () => {
    const store = memoryStorage()
    store.setItem('k', '{not json')
    expect(readJSON(store, 'k')).toEqual({ ok: false, why: 'unreadable' })
  })

  it('reports unreadable when the store throws on read', () => {
    const throwing: Storage = {
      length: 0,
      clear: () => {},
      getItem: () => {
        throw new Error('blocked')
      },
      key: () => null,
      removeItem: () => {},
      setItem: () => {},
    }
    expect(readJSON(throwing, 'k')).toEqual({ ok: false, why: 'unreadable' })
  })

  it('a failed write clears rather than leaves a partial record', () => {
    const removeItem = vi.fn()
    const throwing: Storage = {
      length: 0,
      clear: () => {},
      getItem: () => null,
      key: () => null,
      removeItem,
      setItem: () => {
        throw new Error('quota exceeded')
      },
    }
    expect(writeJSON(throwing, 'k', { a: 1 })).toBe(false)
    expect(removeItem).toHaveBeenCalledWith('k')
  })

  it('clearKey never throws even when the store does', () => {
    const throwing: Storage = {
      length: 0,
      clear: () => {},
      getItem: () => null,
      key: () => null,
      removeItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {},
    }
    expect(() => clearKey(throwing, 'k')).not.toThrow()
  })
})

describe('the generic shape guards', () => {
  it('isBag accepts a plain object and rejects arrays/null/primitives', () => {
    expect(isBag({})).toBe(true)
    expect(isBag([])).toBe(false)
    expect(isBag(null)).toBe(false)
    expect(isBag(1)).toBe(false)
  })

  it('isInt accepts whole numbers only', () => {
    expect(isInt(3)).toBe(true)
    expect(isInt(3.5)).toBe(false)
    expect(isInt(NaN)).toBe(false)
    expect(isInt('3')).toBe(false)
  })

  it('isCount accepts non-negative whole numbers only', () => {
    expect(isCount(0)).toBe(true)
    expect(isCount(-1)).toBe(false)
  })
})
