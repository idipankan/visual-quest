import { afterEach, describe, expect, it, vi } from 'vitest'
import { CHALLENGES } from '../data/challenges'
import { buildJevRequest } from '../services/jev/requestBuilder'
import { calculatePoints } from './scoring'
import { createRound, GAME_MODES, maximumRoundScore, ROUND_LENGTH } from './gameRound'

afterEach(() => vi.restoreAllMocks())

describe('challenge catalogue', () => {
  it('contains 150 unique, complete challenges, with 50 in each difficulty', () => {
    expect(CHALLENGES).toHaveLength(150)
    expect(new Set(CHALLENGES.map(({ id }) => id)).size).toBe(150)
    expect(new Set(CHALLENGES.map(({ mission }) => mission)).size).toBe(150)
    for (const difficulty of ['easy', 'medium', 'hard']) {
      expect(CHALLENGES.filter((challenge) => challenge.difficulty === difficulty)).toHaveLength(50)
    }
    for (const challenge of CHALLENGES) {
      for (const text of [challenge.id, challenge.title, challenge.mission, challenge.hint, challenge.localizationPrompt]) {
        expect(text.trim().length).toBeGreaterThan(0)
      }
      expect(challenge.basePoints).toBeGreaterThan(0)
      expect(buildJevRequest(challenge).request.questions).toHaveProperty('target')
    }
  })
})

describe('createRound', () => {
  it.each(GAME_MODES)('draws ten unique catalogue challenges in $label mode', ({ value }) => {
    for (let index = 0; index < 20; index += 1) {
      const round = createRound(value)
      expect(round).toHaveLength(ROUND_LENGTH)
      expect(new Set(round.map(({ id }) => id)).size).toBe(ROUND_LENGTH)
      for (const challenge of round) {
        expect(CHALLENGES).toContain(challenge)
        if (value !== 'progressive') expect(challenge.difficulty).toBe(value)
      }
    }
  })

  it('orders Progressive as four Easy, three Medium, then three Hard', () => {
    expect(createRound('progressive').map(({ difficulty }) => difficulty)).toEqual([
      'easy', 'easy', 'easy', 'easy', 'medium', 'medium', 'medium', 'hard', 'hard', 'hard',
    ])
  })

  it.each(GAME_MODES)('randomizes selection in $label without mutating the catalogue or an existing round', ({ value }) => {
    const originalIds = CHALLENGES.map(({ id }) => id)
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const first = createRound(value)
    const firstIds = first.map(({ id }) => id)
    vi.mocked(Math.random).mockReturnValue(0.999999)
    const second = createRound(value)
    expect(second.map(({ id }) => id)).not.toEqual(firstIds)
    expect(first.map(({ id }) => id)).toEqual(firstIds)
    expect(CHALLENGES.map(({ id }) => id)).toEqual(originalIds)
  })
})

describe('maximumRoundScore', () => {
  it.each(GAME_MODES)('uses only the selected $label round and matches perfect scoring', ({ value }) => {
    const round = createRound(value)
    const perfectScore = round.reduce((sum, challenge) => sum + calculatePoints(challenge.basePoints, {
      matchBand: 'unmistakable_match', boxConfidence: 1,
    }), 0)
    expect(maximumRoundScore(round)).toBe(perfectScore)
    expect(maximumRoundScore(round)).toBeLessThan(maximumRoundScore(CHALLENGES))
  })

  it('respects the per-challenge cap', () => {
    expect(maximumRoundScore([{ ...CHALLENGES[0], basePoints: 250 }])).toBe(250)
  })
})
