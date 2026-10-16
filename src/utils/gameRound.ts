import { CHALLENGES } from '../data/challenges'
import type { Difficulty, VisionChallenge } from '../data/challenges'
import { MAX_CHALLENGE_POINTS } from './scoring'

export type GameMode = Difficulty | 'progressive'

export const ROUND_LENGTH = 10

export const GAME_MODES: readonly { value: GameMode; label: string; description: string }[] = [
  { value: 'easy', label: 'Easy', description: 'Spot familiar objects and everyday essentials.' },
  { value: 'medium', label: 'Medium', description: 'Think about what objects do and how they help.' },
  { value: 'hard', label: 'Hard', description: 'Arrange objects, find relationships, and read the scene.' },
  { value: 'progressive', label: 'Progressive', description: 'Build up: 4 Easy, then 3 Medium, then 3 Hard.' },
]

function pickChallenges(difficulty: Difficulty, count: number): VisionChallenge[] {
  const pool = CHALLENGES.filter((challenge) => challenge.difficulty === difficulty)
  if (pool.length < count) {
    throw new Error(`Not enough ${difficulty} challenges for a round: need ${count}, found ${pool.length}.`)
  }
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]]
  }
  return pool.slice(0, count)
}

export function createRound(mode: GameMode): VisionChallenge[] {
  if (mode === 'progressive') {
    return [
      ...pickChallenges('easy', 4),
      ...pickChallenges('medium', 3),
      ...pickChallenges('hard', 3),
    ]
  }
  return pickChallenges(mode, ROUND_LENGTH)
}

export function maximumRoundScore(challenges: readonly VisionChallenge[]): number {
  // Strongest match (+14) and best box confidence (+5), subject to the per-challenge cap.
  return challenges.reduce(
    (sum, challenge) => sum + Math.min(MAX_CHALLENGE_POINTS, challenge.basePoints + 14 + 5),
    0,
  )
}
