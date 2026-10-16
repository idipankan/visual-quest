import type { VisionChallenge } from '../../data/challenges'
import { JEV_MODEL } from '../../config'

export const IMAGES_HEADER = 'TypeSafe-Danger-Zone-Images'

const matchLevels = [
  'No visible evidence supports the challenge.',
  'Weak match: a possible fit, but the visual evidence is unclear.',
  'Reasonable match: the visible evidence probably fits the challenge.',
  'Strong match: the visible evidence clearly fits the challenge.',
  'Unmistakable match: the visible evidence is an obvious fit.',
]

export type JevMultipartRequest = {
  request: Record<string, unknown>
  imagePartName: string
}

export function buildJevRequest(challenge: VisionChallenge): JevMultipartRequest {
  const imageReference = `vision-${crypto.randomUUID()}`
  const imagePartName = 'vision-frame'

  return {
    imagePartName,
    request: {
      model: JEV_MODEL,
      state: { scene: imageReference },
      assets: {
        [imageReference]: { type: 'image', part: imagePartName },
      },
      questions: {
        presence: {
          type: 'noul',
          instructions: `Is there clearly visible evidence in \`scene\` that satisfies this challenge: ${challenge.localizationPrompt}?`,
          criteria: {
            true: 'A visible object or scene clearly satisfies the challenge.',
            false: 'No visible evidence satisfies the challenge.',
          },
        },
        target: {
          type: 'box',
          instructions: `The single strongest visible object or region in \`scene\` that satisfies this challenge: ${challenge.localizationPrompt}`,
        },
        match: {
          type: 'score',
          instructions: `How strongly does the visible evidence in \`scene\` satisfy this challenge: ${challenge.localizationPrompt}?`,
          criteria: matchLevels,
        },
        category: {
          type: 'choice',
          instructions: `How does the strongest visible evidence in \`scene\` relate to this challenge: ${challenge.localizationPrompt}?`,
          criteria: {
            direct_match: 'The object directly and plainly satisfies the challenge.',
            functional_match: 'The object can perform the function described by the challenge.',
            contextual_match: 'Its suitability depends on the visible situation or context.',
            ambiguous_match: 'The evidence is unclear, weak, or open to more than one interpretation.',
            no_suitable_match: 'Nothing visible is a suitable match.',
          },
        },
      },
    },
  }
}
