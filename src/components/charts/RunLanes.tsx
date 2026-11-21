import { Check, Loader2 } from 'lucide-react'
import type { LocalRun } from '../../types'
import { ProgressBar, Tag, cx } from '../ui/Primitives'
import { MiniArray } from './ArrayBars'

export function RunLanes({
  runs,
  maxRuns = 8,
  compact = false,
}: {
  runs: LocalRun[]
  maxRuns?: number
  compact?: boolean
}) {
  if (runs.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-line px-4 py-5 text-center text-[10px] text-faint">
        Local core runs appear when a worker receives a chunk.
      </div>
    )
  }

  const visible = runs.slice(0, maxRuns)

  return (
    <div className="space-y-1.5">
      {visible.map((run) => (
        <div
          key={run.coreIndex}
          className={cx(
            'grid items-center gap-2 rounded-md border px-2 py-1.5',
            run.sorted
              ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
              : 'border-line-soft bg-ink-850/50',
          )}
          style={{ gridTemplateColumns: compact ? '64px 1fr 72px' : '76px 1fr 92px 100px' }}
        >
          <span className="font-mono text-[9px] text-faint">core {run.coreIndex}</span>
          <div className="min-w-0">
            <ProgressBar
              value={run.progress}
              tone={run.sorted ? 'emerald' : 'cyan'}
              height="h-1"
            />
            <div className="mt-1 flex items-center justify-between text-[8px] text-faint">
              <span>
                {run.start + 1}–{run.end}
              </span>
              <span>{Math.round(run.progress)}%</span>
            </div>
          </div>
          {!compact && (
            <div className="hidden sm:block">
              <MiniArray values={run.sample} tone={run.sorted ? 'emerald' : 'cyan'} height={18} maxBars={12} />
            </div>
          )}
          <div className="flex items-center justify-end gap-1">
            {run.sorted ? (
              <Tag tone="emerald" className="!px-1.5 !text-[8px]">
                <Check size={9} /> sorted
              </Tag>
            ) : (
              <Tag tone="cyan" className="!px-1.5 !text-[8px]">
                <Loader2 size={9} className="animate-spin" /> sort
              </Tag>
            )}
          </div>
        </div>
      ))}
      {runs.length > maxRuns && (
        <p className="text-[9px] text-faint">+{runs.length - maxRuns} core runs hidden</p>
      )}
    </div>
  )
}
