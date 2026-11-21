import type { WordCount } from '../../types'

const COLORS = [
  'text-cyan-300',
  'text-sky-300',
  'text-emerald-300',
  'text-blue-300',
  'text-teal-200',
  'text-indigo-300',
]

function hashWord(word: string): number {
  let hash = 0
  for (let index = 0; index < word.length; index += 1) {
    hash = (hash * 31 + word.charCodeAt(index)) >>> 0
  }
  return hash
}

export function WordCloud({ words }: { words: WordCount[] }) {
  const max = words[0]?.count ?? 1

  return (
    <div className="flex min-h-[260px] flex-wrap content-center items-center justify-center gap-x-4 gap-y-2 px-2 py-4">
      {words.map((word) => {
        const ratio = word.count / max
        const fontSize = 11 + Math.round(Math.pow(ratio, 0.75) * 27)
        const color = COLORS[hashWord(word.word) % COLORS.length]
        return (
          <span
            key={word.word}
            title={`${word.word}: ${word.count} occurrences`}
            className={`${color} leading-none font-medium transition hover:opacity-100`}
            style={{ fontSize, opacity: 0.55 + ratio * 0.45 }}
          >
            {word.word}
          </span>
        )
      })}
    </div>
  )
}
