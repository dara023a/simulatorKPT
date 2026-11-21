import type { TextDoc } from '../types'

interface CategorySeed {
  name: string
  keywords: string[]
}

export const CATEGORY_SEEDS: CategorySeed[] = [
  {
    name: 'alt.atheism',
    keywords: ['atheism', 'religion', 'belief', 'god', 'moral', 'church', 'argument', 'faith'],
  },
  {
    name: 'comp.graphics',
    keywords: ['graphics', 'image', 'rendering', 'polygon', 'texture', 'pixel', 'algorithm', 'display'],
  },
  {
    name: 'comp.os.ms-windows.misc',
    keywords: ['windows', 'driver', 'microsoft', 'install', 'desktop', 'registry', 'error', 'system'],
  },
  {
    name: 'comp.sys.ibm.pc.hardware',
    keywords: ['motherboard', 'memory', 'processor', 'bus', 'adapter', 'hardware', 'upgrade', 'bios'],
  },
  {
    name: 'comp.sys.mac.hardware',
    keywords: ['macintosh', 'apple', 'powerbook', 'monitor', 'drive', 'hardware', 'keyboard', 'model'],
  },
  {
    name: 'comp.windows.x',
    keywords: ['x11', 'window', 'server', 'client', 'display', 'motif', 'widget', 'library'],
  },
  {
    name: 'misc.forsale',
    keywords: ['sale', 'price', 'offer', 'shipping', 'item', 'condition', 'interested', 'email'],
  },
  {
    name: 'rec.autos',
    keywords: ['car', 'engine', 'transmission', 'brake', 'dealer', 'model', 'mileage', 'drive'],
  },
  {
    name: 'rec.motorcycles',
    keywords: ['bike', 'motorcycle', 'helmet', 'rider', 'engine', 'road', 'ride', 'gear'],
  },
  {
    name: 'rec.sport.baseball',
    keywords: ['baseball', 'team', 'pitcher', 'inning', 'season', 'game', 'player', 'score'],
  },
  {
    name: 'rec.sport.hockey',
    keywords: ['hockey', 'team', 'goal', 'puck', 'player', 'season', 'ice', 'game'],
  },
  {
    name: 'sci.crypt',
    keywords: ['encryption', 'key', 'cipher', 'security', 'algorithm', 'public', 'private', 'message'],
  },
  {
    name: 'sci.electronics',
    keywords: ['circuit', 'voltage', 'signal', 'resistor', 'power', 'board', 'current', 'design'],
  },
  {
    name: 'sci.med',
    keywords: ['medicine', 'patient', 'doctor', 'treatment', 'disease', 'health', 'study', 'symptom'],
  },
  {
    name: 'sci.space',
    keywords: ['space', 'orbit', 'shuttle', 'launch', 'satellite', 'mission', 'nasa', 'planet'],
  },
  {
    name: 'soc.religion.christian',
    keywords: ['christian', 'bible', 'jesus', 'church', 'faith', 'prayer', 'god', 'scripture'],
  },
  {
    name: 'talk.politics.guns',
    keywords: ['gun', 'firearm', 'law', 'rights', 'control', 'weapon', 'crime', 'debate'],
  },
  {
    name: 'talk.politics.mideast',
    keywords: ['peace', 'israel', 'arab', 'conflict', 'territory', 'government', 'policy', 'region'],
  },
  {
    name: 'talk.politics.misc',
    keywords: ['politics', 'government', 'policy', 'election', 'party', 'senator', 'vote', 'law'],
  },
  {
    name: 'talk.religion.misc',
    keywords: ['religion', 'god', 'faith', 'belief', 'moral', 'church', 'spiritual', 'discussion'],
  },
]

export const CATEGORY_NAMES = CATEGORY_SEEDS.map((category) => category.name)

const GENERIC_KEYWORDS = [
  'system',
  'problem',
  'question',
  'information',
  'message',
  'group',
  'readers',
  'discussion',
  'software',
  'hardware',
  'experience',
  'work',
  'help',
  'people',
  'email',
  'article',
  'posting',
  'reply',
  'opinion',
  'example',
  'issue',
  'solution',
  'technology',
  'computer',
  'network',
  'data',
  'service',
  'program',
  'report',
  'community',
  'support',
  'documentation',
]

const SENTENCE_TEMPLATES = [
  'The {a} discussion continues with several readers sharing their experience about {b}.',
  'One reader asked how {a} affects {b} in a typical {g} environment.',
  'A detailed reply explained that {a} depends on the {b} configuration and careful testing.',
  'In my opinion the {g} around {a} is more important than the {b} details.',
  'We compared {a} and {b} last week and the {g} results were surprisingly consistent.',
  'Does anyone have documentation about {a} or a working example of {b}?',
  'The latest {g} report suggests that {a} may improve when {b} is updated.',
  'Please reply by email if you have hands-on experience with {a} and {b}.',
  'The group agreed that {a} is useful, although {b} still causes problems for beginners.',
  'A short summary of the {a} thread: check the {b} first, then review the {g} notes.',
  'Several {g} questions about {a} were answered with practical advice on {b}.',
  'The {g} team posted a short update describing the current state of {a} and {b}.',
]

const TITLE_TEMPLATES = [
  '{a} and {b}: a short {g} note',
  'Question about {a} configuration',
  'Re: {a} problem with {b}',
  '{a} report for the {g} group',
  'Looking for advice on {a}',
]

function mulberry32(seed: number): () => number {
  let value = seed
  return () => {
    value |= 0
    value = (value + 0x6d2b79f5) | 0
    let t = Math.imul(value ^ (value >>> 15), 1 | value)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function generateDocs(count: number, seed: number, idPrefix = 'doc'): TextDoc[] {
  const random = mulberry32(seed)
  const pick = <T,>(values: T[]): T => values[Math.floor(random() * values.length)]
  const docs: TextDoc[] = []

  for (let index = 0; index < count; index += 1) {
    const category = CATEGORY_SEEDS[index % CATEGORY_SEEDS.length]
    const otherCategory = pick(CATEGORY_SEEDS)
    const keyword = (): string => {
      const roll = random()
      if (roll < 0.72) return pick(category.keywords)
      if (roll < 0.9) return pick(GENERIC_KEYWORDS)
      return pick(otherCategory.keywords)
    }
    const fill = (template: string): string =>
      template.replace(/\{a\}/g, keyword).replace(/\{b\}/g, keyword).replace(/\{g\}/g, () => pick(GENERIC_KEYWORDS))

    const sentenceCount = 6 + Math.floor(random() * 4)
    const sentences = Array.from({ length: sentenceCount }, () => fill(pick(SENTENCE_TEMPLATES)))
    const body = capitalize(sentences.join(' '))
    const title = capitalize(fill(pick(TITLE_TEMPLATES)))
    const id = `${idPrefix}-${String(index + 1).padStart(3, '0')}`

    docs.push({
      id,
      title,
      category: category.name,
      text: body,
    })
  }

  return docs
}
