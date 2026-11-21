import { Cpu, Inbox } from 'lucide-react'
import { useSimulation } from '../../engine/SimulationProvider'
import type { WorkerNode } from '../../types'
import { StatusBadge, ProgressBar, cx } from '../ui/Primitives'
import { formatNumber } from '../../lib/format'

function cardTone(worker: WorkerNode): 'cyan' | 'amber' | 'emerald' | 'blue' | 'slate' {
  if (worker.status === 'processing' || worker.status === 'receiving') return 'cyan'
  if (worker.status === 'returning') return 'amber'
  if (worker.status === 'completed') return 'emerald'
  if (worker.status === 'registered') return 'blue'
  return 'slate'
}

function WorkerCard({
  worker,
  selected,
  onSelect,
}: {
  worker: WorkerNode
  selected: boolean
  onSelect: () => void
}) {
  const { state } = useSimulation()
  const task = state.tasks.find((candidate) => candidate.id === worker.currentTaskId)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cx(
        'flex flex-col rounded-lg border bg-ink-900/70 p-3 text-left transition-colors hover:border-cyan-500/40',
        selected ? 'border-accent/70 ring-1 ring-accent/20' : 'border-line',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-mist">
          <Cpu size={13} className="text-info" />
          {worker.name}
        </span>
        <StatusBadge status={worker.status} />
      </div>
      <p className="mt-1 truncate font-mono text-[9px] text-faint">
        {worker.hostname} · {worker.ip}
      </p>

      <div className="mt-2 flex items-center justify-between text-[10px]">
        <span className="text-faint">{worker.cores} simulated cores</span>
        <span className="font-mono text-[9px] text-muted">{worker.currentTaskId ?? '—'}</span>
      </div>

      {task ? (
        <p className="mt-1 text-[9px] text-faint">
          Docs {task.startDoc + 1}–{task.endDoc + 1} · {task.docCount} documents
        </p>
      ) : (
        <p className="mt-1 text-[9px] text-faint">
          {worker.status === 'registered' ? 'Awaiting task assignment' : 'No active task'}
        </p>
      )}

      <ProgressBar value={worker.progress} tone={cardTone(worker)} className="mt-2" height="h-1" />

      <div className="mt-1.5 flex items-center justify-between text-[9px] text-faint">
        <span>{formatNumber(worker.docsProcessed)} docs done</span>
        <span className="tabular-nums">
          {Math.round(worker.progress)}% · {worker.tasksCompleted} task
          {worker.tasksCompleted === 1 ? '' : 's'}
        </span>
      </div>
    </button>
  )
}

export function WorkerGrid({
  selectedId,
  onSelect,
}: {
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const { state } = useSimulation()

  return (
    <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
      {state.workers.map((worker) => (
        <WorkerCard
          key={worker.id}
          worker={worker}
          selected={selectedId === worker.id}
          onSelect={() => onSelect(worker.id)}
        />
      ))}
    </div>
  )
}

export function WorkerGridEmpty() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-line px-3 py-6 text-[11px] text-faint">
      <Inbox size={14} />
      Workers appear here once the simulation is initialised.
    </div>
  )
}
