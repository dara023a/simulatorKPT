import { useState } from 'react'
import { ArrowRight, ListChecks, Cpu } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSimulation } from '../engine/SimulationProvider'
import { SimulationControls } from '../components/simulation/SimulationControls'
import { RunSettings } from '../components/simulation/RunSettings'
import { PhaseStrip } from '../components/simulation/PhaseStrip'
import { WorkerGrid } from '../components/simulation/WorkerGrid'
import { EventLog } from '../components/simulation/EventLog'
import { MasterSummary } from '../components/simulation/MasterSummary'
import { NodeDetailPanel } from '../components/network/NodeDetailPanel'
import { EmptyState, Note, Panel, Tag } from '../components/ui/Primitives'
import { RunLanes } from '../components/charts/RunLanes'
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
        <span className="tabular-nums">{queued.length} chunks</span>
      </div>
      {queued.length > 0 ? (
        <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto pr-1">
          {queued.slice(0, 18).map((task) => (
            <span
              key={task.id}
              className="inline-flex items-center gap-1 rounded border border-line bg-ink-850 px-1.5 py-0.5 font-mono text-[9px] text-muted"
              title={`Items ${task.startIndex + 1}–${task.endIndex + 1}`}
            >
              {task.id}
              <span className="text-faint">{formatNumber(task.itemCount)}i</span>
            </span>
          ))}
          {queued.length > 18 && (
            <span className="px-1 py-0.5 text-[9px] text-faint">+{queued.length - 18} more</span>
          )}
        </div>
      ) : (
        <p className="mt-2 rounded-md border border-dashed border-line px-3 py-4 text-center text-[10px] text-faint">
          Queue drained — semua chunk sudah diambil atau selesai.
        </p>
      )}
      <div className="mt-3 flex items-center justify-between text-[10px] text-faint">
        <span>Sorted runs returned</span>
        <span className="tabular-nums">
          {state.tasks.filter((task) => task.status === 'returned' || task.status === 'merged').length} /{' '}
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

function ParallelRunsPanel() {
  const { state } = useSimulation()
  const active = state.tasks.filter(
    (task) =>
      task.localRuns.length > 0 &&
      (task.status === 'assigned' || task.status === 'processing' || task.status === 'returned'),
  )
  const visible = active.slice(-3)

  return (
    <Panel
      title="Parallel local sort"
      subtitle="Satu baris per core · run disortir paralel lalu digabung di worker"
      action={<Tag tone="cyan">{active.length} active chunks</Tag>}
    >
      {visible.length > 0 ? (
        <div className="space-y-3">
          {visible.map((task) => {
            const worker = state.workers.find((candidate) => candidate.id === task.workerId)
            return (
              <div key={task.id} className="rounded-md border border-line bg-ink-850/60 px-3 py-2.5">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[10px] text-muted">
                    <Cpu size={11} className="text-accent" />
                    <span className="font-mono text-mist">{task.id}</span>
                    <span className="text-faint">on {worker?.id ?? 'unassigned'}</span>
                  </span>
                  <span className="text-[9px] text-faint">
                    {formatNumber(task.itemCount)} items · {task.localRuns.length} core runs ·{' '}
                    {Math.round(task.progress)}%
                  </span>
                </div>
                <RunLanes runs={task.localRuns} compact />
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyState
          title="No active local runs"
          hint="Local runs muncul saat chunk sampai di worker; setiap core mendapat rentang tersendiri."
        />
      )}
    </Panel>
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
        title="Run configuration"
        subtitle="Mengubah nilai di bawah mereset simulasi; kontrol Play/Pause tetap tersedia"
        action={<Tag tone="amber">Reset on change</Tag>}
      >
        <RunSettings />
      </Panel>

      <Panel
        title="Process phases"
        subtitle="Progress diturunkan dari shared simulation state, bukan animasi wall-clock"
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
            {stats.progressPct}% chunks returned
          </Tag>
        }
      >
        <PhaseStrip />
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Panel
            title="Worker fleet"
            subtitle="Klik worker untuk melihat chunk, input/sorted sample, local runs, dan checksum"
            action={<Tag tone="cyan">{formatNumber(stats.itemsTotal)} items</Tag>}
          >
            <WorkerGrid selectedId={selectedNode} onSelect={setSelectedNode} />
          </Panel>

          <ParallelRunsPanel />

          <div className="grid gap-4 md:grid-cols-2">
            <Panel
              title="Chunk queue"
              subtitle="Dynamic pull atau static ownership sesuai konfigurasi"
              action={<Tag tone="slate">{state.queue.length} waiting</Tag>}
            >
              <QueuePreview />
            </Panel>

            <Panel
              title="Event log"
              subtitle="Timestamp memakai simulated clock"
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
        Play/Pause/Step/Reset menjalankan state machine deterministik. Paket, discovery tick,
        durasi, dan kegagalan worker adalah ilustrasi; bukan pengukuran CPU atau jaringan. Reset
        membangun state awal yang sama sehingga hasil dapat direproduksi.
      </Note>
    </div>
  )
}
