import { describe, it, expect } from 'vitest'
import {
  DEFAULT_LIVES_CAP,
  DEFAULT_REGEN_MS,
  canConsume,
  consume,
  initialLives,
  msUntilNextLife,
  regenerate,
  type LivesState,
} from '../src/lives/index.js'

const HOUR = 60 * 60 * 1000

describe('initialLives', () => {
  it('starts full at the given cap', () => {
    expect(initialLives(5)).toEqual({ count: 5, lastRegenAt: expect.any(Number) })
  })

  it('defaults to DEFAULT_LIVES_CAP', () => {
    expect(initialLives().count).toBe(DEFAULT_LIVES_CAP)
  })
})

describe('consume', () => {
  it('decrements by 1', () => {
    const state: LivesState = { count: 3, lastRegenAt: 1000 }
    expect(consume(state)).toEqual({ count: 2, lastRegenAt: 1000 })
  })

  it('refuses (returns null) at 0', () => {
    const state: LivesState = { count: 0, lastRegenAt: 1000 }
    expect(consume(state)).toBeNull()
  })

  it('leaves lastRegenAt untouched — consuming does not help the regen clock', () => {
    const state: LivesState = { count: 5, lastRegenAt: 12345 }
    expect(consume(state)!.lastRegenAt).toBe(12345)
  })
})

describe('canConsume', () => {
  it('is true above 0 and false at 0', () => {
    expect(canConsume({ count: 1, lastRegenAt: 0 })).toBe(true)
    expect(canConsume({ count: 0, lastRegenAt: 0 })).toBe(false)
  })
})

describe('regenerate', () => {
  it('credits exactly one life per whole hour elapsed, no more', () => {
    const state: LivesState = { count: 2, lastRegenAt: 0 }
    expect(regenerate(state, HOUR - 1, 5, DEFAULT_REGEN_MS).count).toBe(2)
    expect(regenerate(state, HOUR, 5, DEFAULT_REGEN_MS).count).toBe(3)
    expect(regenerate(state, HOUR * 2, 5, DEFAULT_REGEN_MS).count).toBe(4)
    expect(regenerate(state, HOUR * 3.9, 5, DEFAULT_REGEN_MS).count).toBe(5)
  })

  it('never exceeds the cap even after a very long absence', () => {
    const state: LivesState = { count: 1, lastRegenAt: 0 }
    expect(regenerate(state, HOUR * 1000, 5, DEFAULT_REGEN_MS).count).toBe(5)
  })

  it('advances lastRegenAt by whole consumed intervals, not to `now` — partial progress survives', () => {
    const state: LivesState = { count: 0, lastRegenAt: 0 }
    const now = HOUR * 2.4
    const next = regenerate(state, now, 5, DEFAULT_REGEN_MS)
    expect(next.count).toBe(2)
    expect(next.lastRegenAt).toBe(HOUR * 2)
    // The remaining 0.4h of progress toward the 3rd life is still live: only 0.6h more
    // (not a fresh full hour) should be needed from `next` to credit the next life.
    const after = regenerate(next, now + HOUR * 0.6, 5, DEFAULT_REGEN_MS)
    expect(after.count).toBe(3)
  })

  it('no-ops at the cap without advancing lastRegenAt', () => {
    const state: LivesState = { count: 5, lastRegenAt: 0 }
    expect(regenerate(state, HOUR * 10, 5, DEFAULT_REGEN_MS)).toEqual(state)
  })

  it('is a no-op when no whole interval has elapsed', () => {
    const state: LivesState = { count: 1, lastRegenAt: 500 }
    expect(regenerate(state, 500 + HOUR - 1, 5, DEFAULT_REGEN_MS)).toEqual(state)
  })
})

describe('msUntilNextLife', () => {
  it('is null once at the cap', () => {
    expect(msUntilNextLife({ count: 5, lastRegenAt: 0 }, 0, 5, DEFAULT_REGEN_MS)).toBeNull()
  })

  it('counts down to the next whole interval', () => {
    const state: LivesState = { count: 2, lastRegenAt: 0 }
    expect(msUntilNextLife(state, HOUR * 0.25, 5, DEFAULT_REGEN_MS)).toBe(HOUR * 0.75)
    expect(msUntilNextLife(state, HOUR * 1.9, 5, DEFAULT_REGEN_MS)).toBe(HOUR * 0.1)
  })
})
