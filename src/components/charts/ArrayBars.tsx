import { sampleValues } from '../../engine/sorting'
import { cx } from '../ui/Primitives'

type Tone = 'cyan' | 'emerald' | 'amber' | 'violet' | 'mixed'

const TONES: Record<Tone, string> = {
  cyan: 'bg-cyan-400/80',
  emerald: 'bg-emerald-400/80',
  amber: 'bg-amber-400/80',
  violet: 'bg-violet-400/80',
  mixed: 'bg-cyan-400/75',
}

const MIXED_STOPS = ['bg-cyan-400/80', 'bg-sky-400/80', 'bg-emerald-400/75', 'bg-violet-400/75']

export function ArrayBars({
  values,
  maxBars = 48,
  height = 72,
  tone = 'cyan',
  className,
  showAxis = false,
  animate = false,
}: {
  values: number[]
  maxBars?: number
  height?: number
  tone?: Tone
  className?: string
  showAxis?: boolean
  animate?: boolean
}) {
  const sample = sampleValues(values, maxBars)
  const max = Math.max(1, ...sample)
  const min = Math.min(...sample)
  const span = Math.max(1, max - min)

  if (sample.length === 0) {
    return (
      <div
        className={cx('flex items-center justify-center rounded border border-dashed border-line text-[10px] text-faint', className)}
        style={{ height }}
      >
        No values
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="flex items-end gap-[2px]" style={{ height }}>
        {sample.map((value, index) => {
          const normalized = (value - min) / span
          const barHeight = 8 + normalized * 92
          const color =
            tone === 'mixed' ? MIXED_STOPS[index % MIXED_STOPS.length] : TONES[tone]
          return (
            <div
              key={`${index}-${value}`}
              className={cx(
                'min-w-0 flex-1 rounded-t-[1px]',
                color,
                animate && 'transition-[height] duration-300',
              )}
              style={{ height: `${barHeight}%` }}
              title={`[${index}] = ${value.toLocaleString('en-US')}`}
            />
          )
        })}
      </div>
      {showAxis && (
        <div className="mt-1 flex justify-between font-mono text-[9px] text-faint">
          <span>{min.toLocaleString('en-US')}</span>
          <span>sampled {sample.length} values</span>
          <span>{max.toLocaleString('en-US')}</span>
        </div>
      )}
    </div>
  )
}

export function MiniArray({
  values,
  tone = 'cyan',
  height = 24,
  maxBars = 14,
}: {
  values: number[]
  tone?: Tone
  height?: number
  maxBars?: number
}) {
  return <ArrayBars values={values} tone={tone} height={height} maxBars={maxBars} />
}
