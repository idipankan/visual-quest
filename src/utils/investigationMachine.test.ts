import { describe, expect, it } from 'vitest'
import {
  initialInvestigationState,
  investigationReducer,
} from './investigationMachine'
import type { CapturedFrame } from './captureFrame'

const frame: CapturedFrame = {
  blob: new Blob(['frame'], { type: 'image/jpeg' }),
  url: 'blob:frame',
  width: 640,
  height: 480,
  mirrored: false,
  name: 'Camera frame',
}

describe('investigationReducer', () => {
  it('moves through capture and analysis into success', () => {
    const captured = investigationReducer(initialInvestigationState, { type: 'CAPTURE_STARTED' })
    const frozen = investigationReducer(captured, { type: 'FRAME_CAPTURED', frame })
    const analyzing = investigationReducer(frozen, { type: 'ANALYSIS_STARTED' })
    const result = investigationReducer(analyzing, {
      type: 'SUCCESS',
      points: 100,
      judgment: {
        presenceProbability: 0.9,
        box: { top: 0.1, bottom: 0.8, left: 0.1, right: 0.8 },
        boxConfidence: 0.8,
        matchScore: 3,
        matchBand: 'strong_match',
        matchConfidence: 0.8,
        category: 'functional_match',
      },
    })

    expect(result.status).toBe('success')
  })

  it('ignores duplicate submissions while a request is running', () => {
    const capturing = investigationReducer(initialInvestigationState, { type: 'CAPTURE_STARTED' })
    expect(investigationReducer(capturing, { type: 'CAPTURE_STARTED' })).toBe(capturing)
  })

  it('does not accept results before analysis has started', () => {
    const capturing = investigationReducer(initialInvestigationState, { type: 'CAPTURE_STARTED' })
    expect(
      investigationReducer(capturing, {
        type: 'UNCERTAIN',
        outcome: 'no-match',
        judgment: {
          presenceProbability: 0.1,
          box: { top: 0.1, bottom: 0.8, left: 0.1, right: 0.8 },
          boxConfidence: 0.9,
          matchScore: 0,
          matchBand: 'no_match',
          matchConfidence: 0.8,
          category: 'no_suitable_match',
        },
      }),
    ).toBe(capturing)
  })
})
