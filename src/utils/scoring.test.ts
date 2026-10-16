import { describe, expect, it } from 'vitest'
import { calculatePoints, evaluatePresence } from './scoring'

describe('calculatePoints', () => {
  it('awards deterministic match and Box confidence bonuses', () => {
    expect(calculatePoints(100, { matchBand: 'unmistakable_match', boxConfidence: 0.9 })).toBe(119)
    expect(calculatePoints(100, { matchBand: 'strong_match', boxConfidence: 0.7 })).toBe(112)
  })

  it('caps points and does not award confidence bonus when confidence is absent', () => {
    expect(calculatePoints(250, { matchBand: 'unmistakable_match', boxConfidence: null })).toBe(250)
  })
})

describe('evaluatePresence', () => {
  it('requires the configured presence threshold, regardless of a returned box', () => {
    expect(evaluatePresence(0.71, 0.72)).toBe('inconclusive')
    expect(evaluatePresence(0.72, 0.72)).toBe('success')
    expect(evaluatePresence(0.34, 0.72)).toBe('no-match')
  })
})
