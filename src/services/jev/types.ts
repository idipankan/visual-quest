import type { VisionChallenge } from '../../data/challenges'

export type BoxCoordinates = {
  top: number
  bottom: number
  left: number
  right: number
}

export type MatchBand =
  | 'no_match'
  | 'weak_match'
  | 'reasonable_match'
  | 'strong_match'
  | 'unmistakable_match'

export type MatchCategory =
  | 'direct_match'
  | 'functional_match'
  | 'contextual_match'
  | 'ambiguous_match'
  | 'no_suitable_match'

export type VisionJudgment = {
  presenceProbability: number
  box: BoxCoordinates
  boxConfidence: number | null
  matchScore: number
  matchBand: MatchBand
  matchConfidence: number
  category: MatchCategory
}

export type JevClient = {
  analyze: (image: Blob, challenge: VisionChallenge) => Promise<VisionJudgment>
}

export const MATCH_BANDS: MatchBand[] = [
  'no_match',
  'weak_match',
  'reasonable_match',
  'strong_match',
  'unmistakable_match',
]

export const MATCH_CATEGORIES: MatchCategory[] = [
  'direct_match',
  'functional_match',
  'contextual_match',
  'ambiguous_match',
  'no_suitable_match',
]
