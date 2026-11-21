import { Cpu, Inbox, RotateCw } from 'lucide-react'
import { useSimulation } from '../../engine/SimulationProvider'
import { getWorkerCurrentTask } from '../../engine/simulation'
import type { WorkerNode } from '../../types'
import { StatusBadge, ProgressBar, cx } from '../ui/Primitives'
import { formatNumber } from '../../lib/format'
import { MiniArray } from '../charts/ArrayBars'

function cardTone(worker: WorkerNode): 'cyan' | 'amber' | 'emerald' | 'blue' | 'slate' {
  if (worker.status === 'processing' || worker.status === 'receiving') return 'cyan'
  if (worker.status === 'merging') return 'blue'
  if (worker.status === 'returning') return 'amber'
  if (worker.status === 'completed') return 'emerald'
  if (worker.status === 'failed') return 'slate'
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
  const task = getWorkerCurrentTask(state, worker)
  const failed = worker.status === 'failed'

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cx(
        'flex flex-col rounded-lg border bg-ink-900/70 p-3 text-left transition-colors hover:border-cyan-500/40',
        selected
          ? 'border-accent/70 ring-1 ring-accent/20'
          : failed
            ? 'border-rose-500/30'
            : 'border-line',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-mist">
          <Cpu size={13} className={failed ? 'text-bad' : 'text-info'} />
          {worker.name}
        </span>
        <StatusBadge status={worker.status} />
      </div>
      <p className="mt-1 truncate font-mono text-[9px] text-faint">
        {worker.hostname} · {worker.ip}
      </p>

      <div className="mt-2 flex items-center justify-between text-[10px]">
        <span className="text-faint">{worker.cores} simulated cores</span>
        <span className="font-mono text-[9px] text-muted">{task?.id ?? '—'}</span>
      </div>

      {task ? (
        <>
          <p className="mt-1 text-[9px] text-faint">
            items {task.startIndex + 1}–{task.endIndex + 1} · {formatNumber(task.itemCount)} values
          </p>
          <div className="mt-1.5">
            <MiniArray
              values={task.values}
              tone={worker.status === 'returning' || worker.status === 'completed' ? 'emerald' : 'cyan'}
              height={26}
              maxBars={18}
            />
          </div>
          <div className="mt-1.5 flex gap-0.5">
            {task.localRuns.slice(0, 8).map((run) => (
              <span
                key={run.coreIndex}
                title={`Core ${run.coreIndex}: ${run.start + 1}–${run.end} · ${Math.round(run.progress)}%`}
                className={cx(
                  'h-1 flex-1 rounded-full',
                  run.sorted ? 'bg-emerald-400/80' : 'bg-cyan-400/60',
                )}
                style={{ opacity: 0.35 + (run.progress / 100) * 0.65 }}
              />
            ))}
          </div>
        </>
      ) : (
        <p className="mt-1 text-[9px] text-faint">
          {failed
            ? `Heartbeat timeout · rejoining at tick ${worker.recoverAtTick ?? '—'}`
            : worker.status === 'completed'
              ? 'Sorted run returned; ready for another chunk'
              : worker.status === 'registered'
                ? 'Awaiting task assignment'
                : 'No active task'}
        </p>
      )}

      <ProgressBar value={worker.progress} tone={cardTone(worker)} className="mt-2" height="h-1" />

      <div className="mt-1.5 flex items-center justify-between text-[9px] text-faint">
        <span>{formatNumber(worker.itemsProcessed)} items sorted</span>
        <span className="tabular-nums">
          {worker.tasksCompleted} chunk{worker.tasksCompleted === 1 ? '' : 's'}
          {worker.failures > 0 && (
            <span className="ml-1 inline-flex items-center gap-0.5 text-rose-300">
              <RotateCw size={8} /> {worker.failures}
            </span>
          )}
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
