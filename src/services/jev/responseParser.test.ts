import { describe, expect, it } from 'vitest'
import { parseJevResponse, ResponseValidationError } from './responseParser'

const validResponse = {
  model: 'jev-preview',
  answers: {
    presence: { type: 'noul', noul: 0.1 },
    target: {
      type: 'box',
      box: { top: 0.2, bottom: 0.7, left: 0.1, right: 0.6 },
      confidence: null,
    },
    match: {
      type: 'score',
      score: 0.2,
      legend: { '0': 'No match', '1': 'Weak', '2': 'Reasonable', '3': 'Strong', '4': 'Unmistakable' },
      probabilities: { '0': 0.9, '1': 0.04, '2': 0.03, '3': 0.02, '4': 0.01 },
      confidence: 0.8,
    },
    category: {
      type: 'choice',
      choice: 'no_suitable_match',
      probabilities: {
        direct_match: 0.1,
        functional_match: 0.1,
        contextual_match: 0.1,
        ambiguous_match: 0.1,
        no_suitable_match: 0.6,
      },
      confidence: 0.7,
    },
  },
}

describe('parseJevResponse', () => {
  it('validates typed answers without treating a Box as proof of presence', () => {
    const judgment = parseJevResponse(validResponse)
    expect(judgment.presenceProbability).toBe(0.1)
    expect(judgment.box).toEqual({ top: 0.2, bottom: 0.7, left: 0.1, right: 0.6 })
    expect(judgment.boxConfidence).toBeNull()
  })

  it('rejects a box with invalid edges', () => {
    const malformed = structuredClone(validResponse)
    malformed.answers.target.box.left = 0.8
    expect(() => parseJevResponse(malformed)).toThrow(ResponseValidationError)
  })

  it('rejects missing answer ids and mismatched answer types', () => {
    const missing = structuredClone(validResponse)
    delete (missing.answers as Partial<typeof missing.answers>).category
    expect(() => parseJevResponse(missing)).toThrow(ResponseValidationError)

    const wrongType = structuredClone(validResponse)
    wrongType.answers.presence.type = 'score'
    expect(() => parseJevResponse(wrongType)).toThrow(ResponseValidationError)
  })

  it('rejects non-finite probabilities', () => {
    const malformed = structuredClone(validResponse)
    malformed.answers.presence.noul = Number.NaN
    expect(() => parseJevResponse(malformed)).toThrow(ResponseValidationError)
  })
})
