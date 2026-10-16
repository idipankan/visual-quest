import { describe, expect, it } from 'vitest'
import { toBoxPercentages } from './boxCoordinates'

const box = { left: 0.2, right: 0.7, top: 0.1, bottom: 0.8 }

describe('toBoxPercentages', () => {
  it('converts normalized edges into overlay percentages', () => {
    const converted = toBoxPercentages(box)
    expect(converted.left).toBeCloseTo(20)
    expect(converted.top).toBeCloseTo(10)
    expect(converted.width).toBeCloseTo(50)
    expect(converted.height).toBeCloseTo(70)
  })

  it('reflects horizontal edges for a mirrored displayed image', () => {
    const converted = toBoxPercentages(box, true)
    expect(converted.left).toBeCloseTo(30)
    expect(converted.top).toBeCloseTo(10)
    expect(converted.width).toBeCloseTo(50)
    expect(converted.height).toBeCloseTo(70)
  })
})
