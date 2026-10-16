export type Difficulty = 'easy' | 'medium' | 'hard'

export type VisionChallenge = {
  id: string
  title: string
  mission: string
  localizationPrompt: string
  difficulty: Difficulty
  basePoints: number
  hint: string
}

export const CHALLENGES: VisionChallenge[] = [
  {
    id: 'rainy-day',
    title: 'Weather ready',
    mission: 'Find something you would take on a rainy day.',
    localizationPrompt: 'an item someone could use to stay dry in the rain',
    difficulty: 'easy',
    basePoints: 100,
    hint: 'Think practical: what would keep the rain off?',
  },
  {
    id: 'power-failure',
    title: 'Lights out',
    mission: 'Find something useful during a power failure.',
    localizationPrompt: 'the most useful visible item during a household power failure',
    difficulty: 'easy',
    basePoints: 100,
    hint: 'Look for a safe, everyday source of light.',
  },
  {
    id: 'make-noise',
    title: 'Sound check',
    mission: 'Show something that could make a sound.',
    localizationPrompt: 'a visible object designed to produce or play sound',
    difficulty: 'easy',
    basePoints: 100,
    hint: 'An instrument or a small speaker could work.',
  },
  {
    id: 'charge-device',
    title: 'Power link',
    mission: 'Find something used to charge another device.',
    localizationPrompt: 'a charger, charging cable, or power bank used to charge another device',
    difficulty: 'easy',
    basePoints: 110,
    hint: 'Look for a cable, adapter, or portable battery.',
  },
  {
    id: 'information',
    title: 'Knowledge source',
    mission: 'Show something that probably contains information.',
    localizationPrompt: 'an object that visibly contains or presents information, such as a book, label, or screen',
    difficulty: 'medium',
    basePoints: 140,
    hint: 'It could be printed, handwritten, or displayed.',
  },
  {
    id: 'unrelated-tech',
    title: 'Analog signal',
    mission: 'Find something unrelated to technology.',
    localizationPrompt: 'the clearest visible object that is not electronic or primarily technology-related',
    difficulty: 'medium',
    basePoints: 140,
    hint: 'Try a natural, paper, or simple everyday object.',
  },
  {
    id: 'older-than-phone',
    title: 'Time traveler',
    mission: 'Show something that probably existed before smartphones.',
    localizationPrompt: 'an object whose kind clearly existed before modern smartphones',
    difficulty: 'medium',
    basePoints: 150,
    hint: 'Everyday tools and household objects are good candidates.',
  },
  {
    id: 'desk-imposter',
    title: 'Desk imposter',
    mission: 'Find something that does not belong on a work desk.',
    localizationPrompt: 'the visible object that seems least appropriate or most out of place on a work desk',
    difficulty: 'medium',
    basePoints: 160,
    hint: 'Give Jev a clear desk scene with a surprising item.',
  },
  {
    id: 'useful-pair',
    title: 'Perfect pair',
    mission: 'Show two objects normally used together.',
    localizationPrompt: 'the strongest visible example of a pair of objects normally used together; locate the more visually prominent object in that pair',
    difficulty: 'hard',
    basePoints: 180,
    hint: 'Place both objects in the same frame, close together.',
  },
  {
    id: 'out-of-place',
    title: 'Scene anomaly',
    mission: 'Find the object that appears most out of place.',
    localizationPrompt: 'the single object that appears most incongruous with its surrounding scene',
    difficulty: 'hard',
    basePoints: 190,
    hint: 'Show a few ordinary things together and add one unexpected item.',
  },
  {
    id: 'ready-to-write',
    title: 'Ready to record',
    mission: 'Find something you could use to write a note.',
    localizationPrompt: 'a visible writing tool or writing surface that could be used to write a short note',
    difficulty: 'hard',
    basePoints: 180,
    hint: 'A pen and paper are a classic combination.',
  },
  {
    id: 'protect-fragile',
    title: 'Handle with care',
    mission: 'Show something that could help protect a fragile item.',
    localizationPrompt: 'a visible material or container that could reasonably cushion or protect a fragile object',
    difficulty: 'hard',
    basePoints: 200,
    hint: 'Look for padding, a soft case, or a protective container.',
  },
]

export const difficultyLabel = (difficulty: Difficulty): string =>
  difficulty.charAt(0).toUpperCase() + difficulty.slice(1)
