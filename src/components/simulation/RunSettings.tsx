import type { ReactNode } from 'react'
import { AlertTriangle, Cpu, GitMerge, Layers3, ListChecks, ShieldAlert } from 'lucide-react'
import { MAX_WORKERS, MIN_WORKERS, type MergeMode, type ScheduleMode } from '../../types'
import { useSimulation } from '../../engine/SimulationProvider'
import { mergeLabel, scheduleLabel } from '../../lib/format'
import { Tag, cx } from '../ui/Primitives'

const WORKER_OPTIONS = Array.from(
  { length: MAX_WORKERS - MIN_WORKERS + 1 },
  (_, index) => MIN_WORKERS + index,
)

function Chip({
  active,
  onClick,
  children,
  disabled,
  title,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cx(
        'rounded-md border px-2.5 py-1.5 text-[10px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40',
        active
          ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
          : 'border-line bg-ink-850 text-faint hover:border-cyan-500/20 hover:text-mist',
      )}
    >
      {children}
    </button>
  )
}

export function RunSettings({ compact = false }: { compact?: boolean }) {
  const { state, updateSettings } = useSimulation()
  const { settings } = state

  return (
    <div className={cx('space-y-3', compact && 'space-y-2')}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold tracking-[0.1em] text-faint uppercase">
            <Cpu size={10} /> Workers
          </span>
          {WORKER_OPTIONS.map((count) => (
            <Chip
              key={count}
              active={settings.workerCount === count}
              onClick={() => updateSettings({ workerCount: count })}
            >
              {count}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold tracking-[0.1em] text-faint uppercase">
            <ListChecks size={10} /> Schedule
          </span>
          {(['dynamic', 'static'] as ScheduleMode[]).map((mode) => (
            <Chip
              key={mode}
              active={settings.schedule === mode}
              onClick={() => updateSettings({ schedule: mode })}
              title={scheduleLabel(mode)}
            >
              {mode}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold tracking-[0.1em] text-faint uppercase">
            <GitMerge size={10} /> Merge
          </span>
          {(['master', 'tiered'] as MergeMode[]).map((mode) => (
            <Chip
              key={mode}
              active={settings.mergeMode === mode}
              onClick={() => updateSettings({ mergeMode: mode })}
              title={mergeLabel(mode)}
            >
              {mode}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold tracking-[0.1em] text-faint uppercase">
            <Layers3 size={10} /> Chunks/worker
          </span>
          {[1, 2, 3, 4].map((count) => (
            <Chip
              key={count}
              active={settings.chunksPerWorker === count}
              onClick={() => updateSettings({ chunksPerWorker: count })}
              disabled={settings.schedule === 'static'}
              title={settings.schedule === 'static' ? 'Static schedule memakai satu chunk per worker' : undefined}
            >
              {count}
            </Chip>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold tracking-[0.1em] text-faint uppercase">
            <ShieldAlert size={10} /> Fault
          </span>
          <Chip
            active={settings.faultInjection}
            onClick={() => updateSettings({ faultInjection: !settings.faultInjection })}
          >
            {settings.faultInjection ? 'inject' : 'off'}
          </Chip>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[9px] text-faint">
        <Tag tone="cyan">{settings.workerCount} workers</Tag>
        <Tag tone={settings.schedule === 'dynamic' ? 'emerald' : 'slate'}>{scheduleLabel(settings.schedule)}</Tag>
        <Tag tone={settings.mergeMode === 'tiered' ? 'blue' : 'cyan'}>{mergeLabel(settings.mergeMode)}</Tag>
        <Tag tone="slate">
          {settings.schedule === 'static' ? settings.workerCount : settings.workerCount * settings.chunksPerWorker} chunks
        </Tag>
        {settings.faultInjection && (
          <span className="inline-flex items-center gap-1 text-amber-300">
            <AlertTriangle size={10} /> worker failure akan disimulasikan sekali
          </span>
        )}
        <span className="text-faint/70">Mengubah konfigurasi me-reset simulasi.</span>
      </div>
    </div>
  )
}
