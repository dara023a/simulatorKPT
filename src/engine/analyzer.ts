import type { AggregateResult, TaskAnalysis, TextDoc, WordCount } from '../types'

const STOPWORDS = new Set(
  `a an and are as at be been being but by can could did do does for from had has have
  he her here him his how i if in into is it its just like may me more most much must my
  no not of on one only or other our out over same she should so some such than that the
  their them then there these they this those through to too under up us very was we were
  what when where which while who why will with would you your yours also about above after
  again against all am any because before below between both down during each few further
  once own s t until yourself yourselves itself ourselves themselves myself himself herself
  isn aren wasn weren doesn didn won wouldn shouldn couldn hasn haven hadn having doing done
  get got make made many much let lets say says said see seen new use used using way well
  thing things people time times day days week weeks also still even ever never now today
  back first last long much little good great big small high low old young own says`
    .split(/\s+/)
    .filter(Boolean),
)

export function tokenize(text: string): string[] {
  const matches = text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? []
  const tokens: string[] = []
  for (const match of matches) {
    const token = match.replace(/['-]+$/g, '')
    if (token.length < 3) continue
    if (STOPWORDS.has(token)) continue
    tokens.push(token)
  }
  return tokens
}

export function topWords(frequencies: Record<string, number>, limit: number): WordCount[] {
  return Object.entries(frequencies)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }))
}

export function mergeInto(target: Record<string, number>, source: Record<string, number>): void {
  for (const [word, count] of Object.entries(source)) {
    target[word] = (target[word] ?? 0) + count
  }
}

export function analyzeDocs(docs: TextDoc[]): TaskAnalysis {
  const frequencies: Record<string, number> = {}
  let wordCount = 0
  for (const doc of docs) {
    for (const token of tokenize(`${doc.title} ${doc.text}`)) {
      frequencies[token] = (frequencies[token] ?? 0) + 1
      wordCount += 1
    }
  }
  return {
    wordCount,
    uniqueWords: Object.keys(frequencies).length,
    frequencies,
    topWords: topWords(frequencies, 8),
  }
}

export function summarize(
  frequencies: Record<string, number>,
  totalDocs: number,
  limit = 12,
): AggregateResult {
  const totalWords = Object.values(frequencies).reduce((sum, value) => sum + value, 0)
  return {
    totalDocs,
    totalWords,
    uniqueWords: Object.keys(frequencies).length,
    frequencies,
    topWords: topWords(frequencies, limit),
  }
}
