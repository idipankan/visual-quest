import { afterEach, describe, expect, it, vi } from 'vitest'
import { CHALLENGES } from '../data/challenges'
import { buildJevRequest } from '../services/jev/requestBuilder'
import { calculatePoints } from './scoring'
import { createRound, GAME_MODES, maximumRoundScore, ROUND_LENGTH } from './gameRound'

afterEach(() => vi.restoreAllMocks())

describe('challenge catalogue', () => {
  it('contains 1,000 unique, complete challenges across all three difficulties', () => {
    expect(CHALLENGES).toHaveLength(1000)
    for (const field of ['id', 'mission', 'localizationPrompt'] as const) {
      expect(new Set(CHALLENGES.map((challenge) => challenge[field].trim().toLowerCase())).size).toBe(1000)
    }
    for (const [difficulty, count] of Object.entries({ easy: 350, medium: 350, hard: 300 })) {
      expect(CHALLENGES.filter((challenge) => challenge.difficulty === difficulty)).toHaveLength(count)
    }
    for (const challenge of CHALLENGES) {
      for (const text of [challenge.id, challenge.title, challenge.mission, challenge.hint, challenge.localizationPrompt]) {
        expect(text.trim().length).toBeGreaterThan(0)
      }
      expect(challenge.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      expect(challenge.basePoints).toBeGreaterThan(0)
      expect(buildJevRequest(challenge).request.questions).toMatchObject({
        presence: { instructions: expect.stringContaining(challenge.localizationPrompt) },
        target: { instructions: expect.stringContaining(challenge.localizationPrompt) },
        match: { instructions: expect.stringContaining(challenge.localizationPrompt) },
        category: { instructions: expect.stringContaining(challenge.localizationPrompt) },
      })
    }
  })

  it('preserves the original opening challenges and their scoring', () => {
    expect(CHALLENGES.slice(0, 12).map(({ id, difficulty, basePoints }) => ({ id, difficulty, basePoints }))).toEqual([
      { id: 'rainy-day', difficulty: 'easy', basePoints: 100 },
      { id: 'power-failure', difficulty: 'easy', basePoints: 100 },
      { id: 'make-noise', difficulty: 'easy', basePoints: 100 },
      { id: 'charge-device', difficulty: 'easy', basePoints: 110 },
      { id: 'information', difficulty: 'medium', basePoints: 140 },
      { id: 'unrelated-tech', difficulty: 'medium', basePoints: 140 },
      { id: 'older-than-phone', difficulty: 'medium', basePoints: 150 },
      { id: 'desk-imposter', difficulty: 'medium', basePoints: 160 },
      { id: 'useful-pair', difficulty: 'hard', basePoints: 180 },
      { id: 'out-of-place', difficulty: 'hard', basePoints: 190 },
      { id: 'ready-to-write', difficulty: 'hard', basePoints: 180 },
      { id: 'protect-fragile', difficulty: 'hard', basePoints: 200 },
    ])
  })

  it('assigns the existing tier scores to all additional challenges', () => {
    const scores = { easy: 100, medium: 150, hard: 190 }
    expect(CHALLENGES.slice(150)).toHaveLength(850)
    for (const challenge of CHALLENGES.slice(150)) {
      expect(challenge.basePoints).toBe(scores[challenge.difficulty])
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
