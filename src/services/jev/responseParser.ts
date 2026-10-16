import {
  MATCH_BANDS,
  MATCH_CATEGORIES,
  type BoxCoordinates,
  type MatchBand,
  type MatchCategory,
  type VisionJudgment,
} from './types'

export class ResponseValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ResponseValidationError'
  }
}

type RecordValue = Record<string, unknown>

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isProbability = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1

const requireRecord = (value: unknown, label: string): RecordValue => {
  if (!isRecord(value)) {
    throw new ResponseValidationError(`${label} must be an object.`)
  }
  return value
}

const requireProbability = (value: unknown, label: string): number => {
  if (!isProbability(value)) {
    throw new ResponseValidationError(`${label} must be a finite probability between 0 and 1.`)
  }
  return value
}

const parseBox = (value: unknown): BoxCoordinates => {
  const box = requireRecord(value, 'Box coordinates')
  const top = requireProbability(box.top, 'Box top')
  const bottom = requireProbability(box.bottom, 'Box bottom')
  const left = requireProbability(box.left, 'Box left')
  const right = requireProbability(box.right, 'Box right')

  if (left >= right || top >= bottom) {
    throw new ResponseValidationError('Box edges must have positive width and height.')
  }

  return { top, bottom, left, right }
}

const parseDistribution = (
  value: unknown,
  label: string,
  expectedKeys?: string[],
): Record<string, number> => {
  const distribution = requireRecord(value, `${label} probabilities`)
  const entries = Object.entries(distribution)

  if (entries.length === 0 || (expectedKeys && expectedKeys.some((key) => !(key in distribution)))) {
    throw new ResponseValidationError(`${label} probabilities are missing required options.`)
  }

  return Object.fromEntries(
    entries.map(([key, probability]) => [key, requireProbability(probability, `${label} probability "${key}"`)]),
  )
}

const parseBand = (score: number): MatchBand => {
  const index = Math.min(4, Math.max(0, Math.round(score)))
  return MATCH_BANDS[index]
}

export function parseJevResponse(payload: unknown): VisionJudgment {
  const response = requireRecord(payload, 'Response')
  if (typeof response.model !== 'string' || !isRecord(response.answers)) {
    throw new ResponseValidationError('Response is missing its model or answers map.')
  }

  const answers = response.answers
  const presence = requireRecord(answers.presence, 'Presence answer')
  const target = requireRecord(answers.target, 'Target answer')
  const match = requireRecord(answers.match, 'Match answer')
  const category = requireRecord(answers.category, 'Category answer')

  if (presence.type !== 'noul' || target.type !== 'box' || match.type !== 'score' || category.type !== 'choice') {
    throw new ResponseValidationError('An answer type did not match its requested question.')
  }

  const presenceProbability = requireProbability(presence.noul, 'Presence probability')
  const box = parseBox(target.box)
  const boxConfidence =
    target.confidence === null ? null : requireProbability(target.confidence, 'Box confidence')

  const matchScore = match.score
  if (typeof matchScore !== 'number' || !Number.isFinite(matchScore) || matchScore < 0 || matchScore > 4) {
    throw new ResponseValidationError('Match score must be a finite value from 0 to 4.')
  }
  if (typeof match.confidence !== 'number' || !isProbability(match.confidence)) {
    throw new ResponseValidationError('Match confidence must be a probability from 0 to 1.')
  }
  const scoreProbabilities = parseDistribution(match.probabilities, 'Match')
  if (Object.keys(scoreProbabilities).some((key) => !/^[0-4]$/.test(key))) {
    throw new ResponseValidationError('Match probabilities must use score-level keys from 0 to 4.')
  }
  const legend = requireRecord(match.legend, 'Match legend')
  if (Object.values(legend).some((description) => typeof description !== 'string')) {
    throw new ResponseValidationError('Match legend entries must be strings.')
  }

  if (typeof category.choice !== 'string' || !MATCH_CATEGORIES.includes(category.choice as MatchCategory)) {
    throw new ResponseValidationError('Match category was not one of the requested options.')
  }
  const categoryProbabilities = parseDistribution(
    category.probabilities,
    'Category',
    MATCH_CATEGORIES,
  )
  if (typeof category.confidence !== 'number' || !isProbability(category.confidence)) {
    throw new ResponseValidationError('Category confidence must be a probability from 0 to 1.')
  }
  if (Object.keys(categoryProbabilities).some((key) => !MATCH_CATEGORIES.includes(key as MatchCategory))) {
    throw new ResponseValidationError('Category probabilities contain an unknown option.')
  }

  return {
    presenceProbability,
    box,
    boxConfidence,
    matchScore,
    matchBand: parseBand(matchScore),
    matchConfidence: match.confidence,
    category: category.choice as MatchCategory,
  }
}
