import { describe, it, expect } from 'vitest'
import { botThinkingDelayMs } from '../src/timing/index.js'

describe('botThinkingDelayMs', () => {
  const RANGES: readonly (readonly [number, number])[] = [
    [1000, 5000], // andarta's own flat range
    [300, 460], // karu's fox persona
    [530, 770], // karu's bear persona
  ]

  for (const range of RANGES) {
    describe(`range [${range[0]}, ${range[1]}]`, () => {
      it('stays within the given range across many draws', () => {
        for (let i = 0; i < 500; i++) {
          const ms = botThinkingDelayMs(range)
          expect(ms).toBeGreaterThanOrEqual(range[0])
          expect(ms).toBeLessThan(range[1])
        }
      })

      it('is not the same value every call', () => {
        const values = new Set(Array.from({ length: 20 }, () => botThinkingDelayMs(range)))
        expect(values.size).toBeGreaterThan(1)
      })
    })
  }
})
