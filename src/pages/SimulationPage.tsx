import { useState } from 'react'
import { ArrowRight, ListChecks } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSimulation } from '../engine/SimulationProvider'
import { SimulationControls } from '../components/simulation/SimulationControls'
import { PhaseStrip } from '../components/simulation/PhaseStrip'
import { WorkerGrid } from '../components/simulation/WorkerGrid'
import { EventLog } from '../components/simulation/EventLog'
import { MasterSummary } from '../components/simulation/MasterSummary'
import { NodeDetailPanel } from '../components/network/NodeDetailPanel'
import { Note, Panel, Tag } from '../components/ui/Primitives'
import { formatNumber } from '../lib/format'

function QueuePreview() {
  const { state } = useSimulation()
  const queued = state.queue
    .map((taskId) => state.tasks.find((task) => task.id === taskId))
    .filter((task): task is NonNullable<typeof task> => Boolean(task))

  return (
    <div>
      <div className="flex items-center justify-between text-[10px] text-faint">
        <span>Waiting chunks</span>
        <span className="tabular-nums">{queued.length} tasks</span>
      </div>
      {queued.length > 0 ? (
        <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto pr-1">
          {queued.slice(0, 18).map((task) => (
            <span
              key={task.id}
              className="inline-flex items-center gap-1 rounded border border-line bg-ink-850 px-1.5 py-0.5 font-mono text-[9px] text-muted"
              title={`Documents ${task.startDoc + 1}–${task.endDoc + 1}`}
            >
              {task.id}
              <span className="text-faint">{task.docCount}d</span>
            </span>
          ))}
          {queued.length > 18 && (
            <span className="px-1 py-0.5 text-[9px] text-faint">+{queued.length - 18} more</span>
          )}
        </div>
      ) : (
        <p className="mt-2 rounded-md border border-dashed border-line px-3 py-4 text-center text-[10px] text-faint">
          Queue drained — all tasks are assigned or finished.
        </p>
      )}
      <div className="mt-3 flex items-center justify-between text-[10px] text-faint">
        <span>Result payloads returned</span>
        <span className="tabular-nums">
          {state.tasks.filter((task) => task.status === 'returned' || task.status === 'aggregated').length} /{' '}
          {state.tasks.length}
        </span>
      </div>
      <Link
        to="/tasks"
        className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-accent hover:text-cyan-200"
      >
        Open task distribution
        <ArrowRight size={11} />
      </Link>
    </div>
  )
}

export function SimulationPage() {
  const { state, stats } = useSimulation()
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <Panel bodyClassName="p-3.5">
        <SimulationControls />
      </Panel>

      <Panel
        title="Process phases"
        subtitle="Phase progress is derived from the shared simulation state, not wall-clock animation"
        action={
          <Tag tone={state.phase === 'completed' ? 'emerald' : state.running ? 'cyan' : 'slate'}>
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                state.phase === 'completed'
                  ? 'bg-emerald-400'
                  : state.running
                    ? 'animate-pulse bg-cyan-400'
                    : 'bg-slate-500'
              }`}
            />
            {stats.progressPct}% tasks returned
          </Tag>
        }
      >
        <PhaseStrip />
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Panel
            title="Worker fleet"
            subtitle="Click any worker to inspect its task, progress and returned Counter"
            action={<Tag tone="cyan">{formatNumber(stats.docsTotal)} docs</Tag>}
          >
            <WorkerGrid selectedId={selectedNode} onSelect={setSelectedNode} />
          </Panel>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel
              title="Task queue"
              subtitle="Dynamic refill simulated by the scheduler"
              action={<Tag tone="slate">{state.queue.length} waiting</Tag>}
            >
              <QueuePreview />
            </Panel>

            <Panel
              title="Event log"
              subtitle="Timestamps use the simulated clock"
              action={
                <Tag tone="cyan">
                  <ListChecks size={10} /> {state.events.length} events
                </Tag>
              }
              bodyClassName="p-4"
            >
              <EventLog limit={14} />
            </Panel>
          </div>
        </div>

        <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <MasterSummary />
          <NodeDetailPanel selectedId={selectedNode} onClose={() => setSelectedNode(null)} />
        </div>
      </div>

      <Note tone="warning" title="Simulation scope">
        Play/Pause/Step/Reset drive a deterministic local state machine. The animated packets,
        discovery ticks and processing durations are illustrative; they are not measured network or
        CPU timings. Resetting rebuilds the same initial state, so results are reproducible.
      </Note>
    </div>
  )
}
