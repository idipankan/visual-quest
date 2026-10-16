import type { MatchBand, VisionJudgment } from '../services/jev/types'

export const MAX_CHALLENGE_POINTS = 250
export const PROTOTYPE_PRESENCE_UNCERTAIN_FLOOR = 0.35

const matchBonuses: Record<MatchBand, number> = {
  no_match: 0,
  weak_match: 2,
  reasonable_match: 6,
  strong_match: 10,
  unmistakable_match: 14,
}

export function calculatePoints(
  basePoints: number,
  judgment: Pick<VisionJudgment, 'matchBand' | 'boxConfidence'>,
): number {
  const confidenceBonus =
    judgment.boxConfidence !== null && judgment.boxConfidence >= 0.8
      ? 5
      : judgment.boxConfidence !== null && judgment.boxConfidence >= 0.65
        ? 2
        : 0

  return Math.min(MAX_CHALLENGE_POINTS, basePoints + matchBonuses[judgment.matchBand] + confidenceBonus)
}

export type PresenceOutcome = 'success' | 'no-match' | 'inconclusive'

export function evaluatePresence(
  probability: number,
  threshold: number,
): PresenceOutcome {
  if (probability >= threshold) return 'success'
  if (probability < PROTOTYPE_PRESENCE_UNCERTAIN_FLOOR) return 'no-match'
  return 'inconclusive'
}
