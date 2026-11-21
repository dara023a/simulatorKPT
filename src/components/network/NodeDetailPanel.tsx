import { Cpu, Server } from 'lucide-react'
import { useSimulation } from '../../engine/SimulationProvider'
import { topWords } from '../../engine/analyzer'
import { getAggregatePreview } from '../../engine/simulation'
import { formatNumber } from '../../lib/format'
import {
  DetailRow,
  DrawerShell,
  EmptyState,
  Note,
  ProgressBar,
  StatusBadge,
  Tag,
} from '../ui/Primitives'

function MasterDetails({ onClose }: { onClose?: () => void }) {
  const { state } = useSimulation()
  const preview = getAggregatePreview(state)
  const registered = state.workers.filter((worker) => worker.status !== 'idle').length
  const returnedTasks = state.tasks.filter(
    (task) => task.status === 'returned' || task.status === 'aggregated',
  ).length
  const status =
    state.phase === 'completed'
      ? 'completed'
      : state.phase === 'discovery'
        ? 'discovering'
        : state.phase === 'ready' || state.phase === 'initialization'
          ? 'idle'
          : 'processing'

  return (
    <DrawerShell
      title="Master Node"
      subtitle={`${state.master.hostname} · ${state.master.ip}`}
      onClose={onClose}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <Server size={14} className="text-master" />
          Coordinator &amp; aggregator
        </div>
        <StatusBadge status={status} />
      </div>

      <div>
        <DetailRow label="Node ID" value="master" />
        <DetailRow label="Simulated cores" value={state.master.cores} />
        <DetailRow label="Registered workers" value={`${registered} / ${state.workers.length}`} />
        <DetailRow label="Tasks returned" value={`${returnedTasks} / ${state.tasks.length}`} />
        <DetailRow label="Task queue" value={`${state.queue.length} waiting`} />
        <DetailRow label="Simulated tick" value={state.tick} />
        <DetailRow
          label="Aggregation"
          value={`${state.aggregationMerged} / ${state.workers.length} workers merged`}
        />
      </div>

      <div className="mt-4">
        <p className="mb-2 text-[10px] font-semibold tracking-[0.12em] text-faint uppercase">
          Aggregate snapshot
        </p>
        {preview ? (
          <>
            <div className="mb-2 grid grid-cols-3 gap-2">
              <div className="rounded-md border border-line bg-ink-850 px-2 py-1.5">
                <p className="text-[9px] text-faint">Docs</p>
                <p className="text-xs font-semibold text-mist tabular-nums">
                  {formatNumber(preview.totalDocs)}
                </p>
              </div>
              <div className="rounded-md border border-line bg-ink-850 px-2 py-1.5">
                <p className="text-[9px] text-faint">Words</p>
                <p className="text-xs font-semibold text-mist tabular-nums">
                  {formatNumber(preview.totalWords)}
                </p>
              </div>
              <div className="rounded-md border border-line bg-ink-850 px-2 py-1.5">
                <p className="text-[9px] text-faint">Unique</p>
                <p className="text-xs font-semibold text-mist tabular-nums">
                  {formatNumber(preview.uniqueWords)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {preview.topWords.slice(0, 6).map((word) => (
                <Tag key={word.word} tone="cyan">
                  {word.word}
                  <span className="text-cyan-200/60">{word.count}</span>
                </Tag>
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            title="No results aggregated yet"
            hint="The master merges worker Counters after all task results are returned."
          />
        )}
      </div>

      <div className="mt-4">
        <Note tone="neutral">
          IP address, cores and timings are simulated fixture data. The master in the reference
          Python code uses UDP discovery and TCP task transfer; this page only visualises the flow.
        </Note>
      </div>
    </DrawerShell>
  )
}

export function NodeDetailPanel({
  selectedId,
  onClose,
}: {
  selectedId: string | null
  onClose?: () => void
}) {
  const { state } = useSimulation()

  if (!selectedId) {
    return (
      <DrawerShell title="Node Inspector" subtitle="Select a node on the graph">
        <EmptyState
          title="No node selected"
          hint="Click the master node or any worker to inspect its simulated status, task, progress and result payload."
        />
        <div className="mt-4">
          <Note tone="neutral">
            Nine worker nodes are simulated in the browser. They do not represent physical machines
            and do not open real TCP connections.
          </Note>
        </div>
      </DrawerShell>
    )
  }

  if (selectedId === 'master') {
    return <MasterDetails onClose={onClose} />
  }

  const worker = state.workers.find((candidate) => candidate.id === selectedId)
  if (!worker) {
    return (
      <DrawerShell title="Unknown node" onClose={onClose}>
        <EmptyState title="Node not found" hint="The selected node is not part of this simulation." />
      </DrawerShell>
    )
  }

  const task = state.tasks.find((candidate) => candidate.id === worker.currentTaskId)
  const keywords = topWords(worker.frequencies, 6)

  return (
    <DrawerShell
      title={`${worker.name} · ${worker.id}`}
      subtitle={`${worker.hostname} · ${worker.ip}`}
      onClose={onClose}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <Cpu size={14} className="text-info" />
          Worker node
        </div>
        <StatusBadge status={worker.status} />
      </div>

      <div>
        <DetailRow label="Node ID" value={worker.id} />
        <DetailRow label="Simulated cores" value={worker.cores} />
        <DetailRow label="Current task" value={worker.currentTaskId ?? 'None'} />
        <DetailRow
          label="Task progress"
          value={
            <span className="inline-flex w-32 items-center justify-end gap-2">
              <ProgressBar value={worker.progress} height="h-1" />
              <span className="w-8 tabular-nums">{Math.round(worker.progress)}%</span>
            </span>
          }
        />
        <DetailRow label="Documents processed" value={formatNumber(worker.docsProcessed)} />
        <DetailRow label="Words counted" value={formatNumber(worker.wordsProcessed)} />
        <DetailRow label="Tasks completed" value={worker.tasksCompleted} />
        <DetailRow
          label="Last task time"
          value={worker.lastTaskDurationSec === null ? '—' : `${worker.lastTaskDurationSec}s (simulated)`}
        />
      </div>

      {task && (
        <div className="mt-3 rounded-md border border-line bg-ink-850 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] text-accent">{task.id}</p>
            <Tag tone="cyan">Simulated</Tag>
          </div>
          <p className="mt-1 text-[11px] text-muted">
            Documents {task.startDoc + 1}–{task.endDoc + 1} · {task.docCount} docs ·{' '}
            {formatNumber(task.analysis.wordCount)} words
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {task.analysis.topWords.slice(0, 4).map((word) => (
              <Tag key={word.word}>
                {word.word} <span className="text-faint">{word.count}</span>
              </Tag>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <p className="mb-2 text-[10px] font-semibold tracking-[0.12em] text-faint uppercase">
          Returned result payload
        </p>
        {keywords.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((word) => (
                <Tag key={word.word} tone="emerald">
                  {word.word}
                  <span className="text-emerald-200/60">{word.count}</span>
                </Tag>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-faint">
              Merged word Counter from {worker.tasksCompleted} completed task
              {worker.tasksCompleted === 1 ? '' : 's'}.
            </p>
          </>
        ) : (
          <EmptyState
            title="No result payload yet"
            hint="A payload appears after this worker finishes a task and returns its word Counter."
          />
        )}
      </div>

      <div className="mt-4">
        <Note tone="neutral">
          This worker is a visual simulation of a Python worker process. Multiprocessing, UDP port
          9999 and TCP port 9998 are implementation details of the reference code, not live sockets
          in this demo.
        </Note>
      </div>
    </DrawerShell>
  )
}
