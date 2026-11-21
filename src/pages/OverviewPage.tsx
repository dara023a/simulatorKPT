import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Cpu,
  Database,
  GitMerge,
  ListChecks,
  Network,
  Play,
  Server,
} from 'lucide-react'
import { useSimulation } from '../engine/SimulationProvider'
import { formatNumber, phaseLabel } from '../lib/format'
import { Note, Panel, ProgressBar, Stat, Tag } from '../components/ui/Primitives'

const FLOW = [
  {
    title: '1 · Dataset enters the master',
    body: 'The master loads the selected local corpus, preprocesses it, and prepares document indexes.',
  },
  {
    title: '2 · Decompose into tasks',
    body: 'Documents are grouped into fixed-size chunks. Each chunk becomes an independent task in the queue.',
  },
  {
    title: '3 · Dispatch to workers',
    body: 'The master sends tasks over simulated links. Free workers pull the next queued task when they finish.',
  },
  {
    title: '4 · Parallel processing',
    body: 'Every worker counts terms, unique words and documents for its own chunk using the same simple algorithm.',
  },
  {
    title: '5 · Return and aggregate',
    body: 'Workers return word Counters. The master merges counters additively into one deterministic aggregate.',
  },
]

export function OverviewPage() {
  const { state, stats, play, reset } = useSimulation()
  const navigate = useNavigate()

  const startSimulation = () => {
    if (state.phase === 'completed') reset()
    play()
    navigate('/simulation')
  }

  return (
    <div className="space-y-5">
      <Panel bodyClassName="p-0">
        <div className="grid gap-0 lg:grid-cols-[1.25fr_1fr]">
          <div className="p-6 lg:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Tag tone="cyan">Simulation Mode</Tag>
              <Tag>UAS · Komputasi Paralel</Tag>
              <Tag tone="emerald">Deterministic demo data</Tag>
            </div>
            <h2 className="mt-4 max-w-2xl text-2xl leading-tight font-semibold tracking-tight text-mist lg:text-3xl">
              Distributed Text Analytics
              <span className="block text-base font-medium text-accent lg:text-lg">
                Master–Worker Simulation
              </span>
            </h2>
            <p className="mt-3 max-w-xl text-[12px] leading-relaxed text-muted">
              Watch one master coordinate nine workers as a document corpus moves through
              discovery, decomposition, parallel word-frequency counting, result return and
              aggregation. Everything runs locally in the browser with deterministic simulation
              data.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={startSimulation}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-2 text-xs font-medium text-cyan-200 transition hover:bg-cyan-500/15"
              >
                <Play size={14} />
                Start Simulation
              </button>
              <Link
                to="/simulation"
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-850 px-3.5 py-2 text-xs font-medium text-muted transition hover:bg-ink-800 hover:text-mist"
              >
                Open controls
                <ArrowRight size={13} />
              </Link>
              <Link
                to="/topology"
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-850 px-3.5 py-2 text-xs font-medium text-muted transition hover:bg-ink-800 hover:text-mist"
              >
                <Network size={13} />
                View topology
              </Link>
            </div>

            <p className="mt-4 text-[10px] leading-relaxed text-faint">
              Not a benchmark. No real devices are connected, no real CPU usage is measured, and all
              IP addresses are simulated fixtures.
            </p>
          </div>

          <div className="border-t border-line-soft bg-ink-850/30 p-6 lg:border-t-0 lg:border-l">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-faint uppercase">
                Architecture
              </p>
              <Tag tone="cyan">1 master · 9 workers</Tag>
            </div>

            <div className="mt-4 rounded-lg border border-master/30 bg-ink-900 p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-mist">
                  <Server size={13} className="text-master" />
                  Master Node
                </span>
                <span className="font-mono text-[9px] text-faint">10.20.0.1</span>
              </div>
              <p className="mt-1 text-[9px] text-faint">
                Discovery · task queue · result aggregation
              </p>
            </div>

            <div className="my-2 flex items-center justify-center gap-1 text-[9px] text-faint">
              <span className="h-px w-10 bg-line" />
              dispatch &amp; return
              <span className="h-px w-10 bg-line" />
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {state.workers.map((worker) => (
                <div
                  key={worker.id}
                  className="flex items-center gap-1 rounded border border-line bg-ink-900 px-1.5 py-1.5"
                >
                  <Cpu size={10} className="text-info" />
                  <span className="font-mono text-[9px] text-muted">{worker.id}</span>
                  <span
                    className={`ml-auto h-1 w-1 rounded-full ${
                      ['receiving', 'processing', 'returning'].includes(worker.status)
                        ? 'animate-pulse bg-accent'
                        : worker.status === 'registered'
                          ? 'bg-info'
                          : 'bg-slate-600'
                    }`}
                  />
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between rounded-md border border-line-soft bg-ink-900/70 px-2 py-1.5 text-[9px] text-faint">
              <span className="flex items-center gap-1">
                <GitMerge size={10} className="text-emerald-400" />
                Additive Counter merge
              </span>
              <span>queue → workers → master</span>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Master nodes" value={stats.masterCount} hint="Coordinator (simulated)" />
        <Stat label="Worker nodes" value={stats.workerCount} hint="Simulated in browser" />
        <Stat label="Documents" value={formatNumber(stats.docsTotal)} hint={state.dataset.shortName} />
        <Stat label="Tasks" value={stats.tasksTotal} hint={`${state.dataset.taskSize} docs / task`} />
        <Stat
          label="Simulation"
          value={phaseLabel(state.phase)}
          hint={`${stats.returned} / ${stats.tasksTotal} tasks returned`}
          accent={state.running}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Panel
          title="What the simulation demonstrates"
          subtitle="Each tick advances one deterministic step of the distributed pipeline"
          action={<Tag tone="cyan">Educational flow</Tag>}
        >
          <ol className="space-y-3">
            {FLOW.map((step) => (
              <li key={step.title} className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70" />
                <div>
                  <p className="text-[12px] font-medium text-mist">{step.title}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>

        <div className="space-y-4">
          <Panel
            title="Current session"
            subtitle="Shared state across every page"
            action={<Tag tone="emerald">Simulated</Tag>}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium text-mist">{state.dataset.name}</p>
                <p className="mt-0.5 text-[10px] text-faint">
                  {state.dataset.categories.length} categories ·{' '}
                  {formatNumber(state.dataset.docs.length)} documents
                </p>
              </div>
              <Link to="/dataset" className="text-[10px] font-medium text-accent hover:text-cyan-200">
                Change
              </Link>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-[10px] text-faint">
                <span>Completion</span>
                <span className="tabular-nums">{stats.progressPct}%</span>
              </div>
              <ProgressBar value={stats.progressPct} className="mt-1.5" tone="emerald" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border border-line bg-ink-850 py-2">
                <p className="text-sm font-semibold text-mist tabular-nums">{stats.queued}</p>
                <p className="text-[9px] text-faint">queued</p>
              </div>
              <div className="rounded-md border border-line bg-ink-850 py-2">
                <p className="text-sm font-semibold text-mist tabular-nums">{stats.activeWorkers}</p>
                <p className="text-[9px] text-faint">active</p>
              </div>
              <div className="rounded-md border border-line bg-ink-850 py-2">
                <p className="text-sm font-semibold text-mist tabular-nums">
                  {stats.aggregatedTasks}
                </p>
                <p className="text-[9px] text-faint">merged</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to="/tasks"
                className="inline-flex items-center gap-1 text-[10px] font-medium text-muted hover:text-mist"
              >
                <ListChecks size={11} /> Task queue
              </Link>
              <Link
                to="/dataset"
                className="inline-flex items-center gap-1 text-[10px] font-medium text-muted hover:text-mist"
              >
                <Database size={11} /> Dataset
              </Link>
              <Link
                to="/results"
                className="inline-flex items-center gap-1 text-[10px] font-medium text-muted hover:text-mist"
              >
                <GitMerge size={11} /> Results
              </Link>
            </div>
          </Panel>

          <Note tone="warning" title="Honest scope">
            This build is a Simulation Mode demo. The reference Python master/worker processes are
            not running here, so no real UDP discovery, TCP transfer, multiprocessing or benchmark
            numbers are claimed. The dynamic task queue is a simulator behaviour, not a claim about
            the original course code.
          </Note>
        </div>
      </div>
    </div>
  )
}
