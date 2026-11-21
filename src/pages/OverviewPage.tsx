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
import { formatNumber, mergeLabel, phaseLabel, scheduleLabel } from '../lib/format'
import { Note, Panel, ProgressBar, Stat, Tag } from '../components/ui/Primitives'
import { ArrayBars } from '../components/charts/ArrayBars'

const FLOW = [
  {
    title: '1 · Array enters the master',
    body: 'Master memuat array integer yang deterministik dan menghitung checksum awal.',
  },
  {
    title: '2 · Decompose into chunks',
    body: 'Array dipotong menjadi chunk. Static memakai satu chunk per worker; dynamic memakai beberapa chunk per worker.',
  },
  {
    title: '3 · Dispatch to workers',
    body: 'Chunk dikirim ke worker melalui link simulasi. Worker yang selesai dapat mengambil chunk berikutnya dari antrean.',
  },
  {
    title: '4 · Parallel local sort',
    body: 'Setiap worker membagi chunk ke beberapa core run, menyortir run secara paralel, lalu merge lokal menjadi satu sorted run.',
  },
  {
    title: '5 · Return, merge, verify',
    body: 'Sorted run kembali ke master. Master membangun merge tree, lalu memverifikasi urutan dan checksum akhir.',
  },
]

export function OverviewPage() {
  const { state, stats, play, reset, benchmark } = useSimulation()
  const navigate = useNavigate()

  const startSimulation = () => {
    if (state.phase === 'completed') reset()
    play()
    navigate('/simulation')
  }

  const totalCores = state.workers.reduce((sum, worker) => sum + worker.cores, 0)

  return (
    <div className="space-y-5">
      <Panel bodyClassName="p-0">
        <div className="grid gap-0 lg:grid-cols-[1.25fr_1fr]">
          <div className="p-6 lg:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Tag tone="cyan">Simulation Mode</Tag>
              <Tag>UAS · Komputasi Paralel</Tag>
              <Tag tone="emerald">Deterministic sorting</Tag>
            </div>
            <h2 className="mt-4 max-w-2xl text-2xl leading-tight font-semibold tracking-tight text-mist lg:text-3xl">
              Distributed Sorting
              <span className="block text-base font-medium text-accent lg:text-lg">
                Master–Worker Simulation
              </span>
            </h2>
            <p className="mt-3 max-w-xl text-[12px] leading-relaxed text-muted">
              Amati satu master membagi array menjadi chunk, beberapa worker menyortir secara
              paralel per core, lalu seluruh sorted run digabung kembali. Simulasi berjalan lokal di
              browser dengan data deterministik; results.csv Python dapat diimpor terpisah untuk
              analitik benchmark.
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
              Bukan benchmark cluster. Node, IP, core, dan timing adalah simulasi. File results.csv
              yang diimpor tetap diberi label sebagai data pengukuran Python Anda.
            </p>
          </div>

          <div className="border-t border-line-soft bg-ink-850/30 p-6 lg:border-t-0 lg:border-l">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-faint uppercase">
                Architecture
              </p>
              <Tag tone="cyan">
                1 master · {state.settings.workerCount} workers
              </Tag>
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
                discovery · chunk queue · merge tree · checksum verification
              </p>
            </div>

            <div className="my-2 flex items-center justify-center gap-1 text-[9px] text-faint">
              <span className="h-px w-10 bg-line" />
              chunks &amp; sorted runs
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
                      ['receiving', 'processing', 'merging', 'returning'].includes(worker.status)
                        ? 'animate-pulse bg-accent'
                        : worker.status === 'failed'
                          ? 'bg-rose-400'
                          : worker.status === 'completed'
                            ? 'bg-emerald-400'
                            : worker.status === 'registered'
                              ? 'bg-info'
                              : 'bg-slate-600'
                    }`}
                  />
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-md border border-line-soft bg-ink-900/70 px-2 py-1.5 text-[9px] text-faint">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1">
                  <GitMerge size={10} className="text-violet-300" />
                  {mergeLabel(state.settings.mergeMode)}
                </span>
                <span>{scheduleLabel(state.settings.schedule)}</span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <p className="mb-1 text-[8px] tracking-wide text-faint uppercase">Input sample</p>
                <ArrayBars values={state.dataset.values} height={30} maxBars={28} tone="mixed" />
              </div>
              <div>
                <p className="mb-1 text-[8px] tracking-wide text-faint uppercase">Sorted target</p>
                <ArrayBars values={state.baseline.sortedSample} height={30} maxBars={28} tone="emerald" />
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Worker nodes" value={stats.workerCount} hint={`${totalCores} simulated cores`} />
        <Stat label="Items" value={formatNumber(stats.itemsTotal)} hint={state.dataset.shortName} />
        <Stat label="Chunks" value={stats.tasksTotal} hint={`${state.settings.schedule} schedule`} />
        <Stat label="Merge groups" value={stats.mergeGroupsTotal || '—'} hint={mergeLabel(state.settings.mergeMode)} />
        <Stat
          label="Simulation"
          value={phaseLabel(state.phase)}
          hint={`${stats.returned} / ${stats.tasksTotal} chunks returned`}
          accent={state.running}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Panel
          title="What the simulation demonstrates"
          subtitle="Setiap tick memajukan satu langkah deterministik dari pipeline sorting"
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
            subtitle="Shared state di seluruh halaman"
            action={<Tag tone="emerald">Simulated</Tag>}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium text-mist">{state.dataset.name}</p>
                <p className="mt-0.5 text-[10px] text-faint">
                  {formatNumber(state.dataset.totalItems)} items · {state.dataset.pattern} pattern
                </p>
              </div>
              <Link to="/dataset" className="text-[10px] font-medium text-accent hover:text-cyan-200">
                Change
              </Link>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-[10px] text-faint">
                <span>Chunk completion</span>
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
                <p className="text-sm font-semibold text-mist tabular-nums">{stats.merged}</p>
                <p className="text-[9px] text-faint">merged</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to="/tasks" className="inline-flex items-center gap-1 text-[10px] font-medium text-muted hover:text-mist">
                <ListChecks size={11} /> Task queue
              </Link>
              <Link to="/dataset" className="inline-flex items-center gap-1 text-[10px] font-medium text-muted hover:text-mist">
                <Database size={11} /> Dataset
              </Link>
              <Link to="/results" className="inline-flex items-center gap-1 text-[10px] font-medium text-muted hover:text-mist">
                <GitMerge size={11} /> Results
              </Link>
            </div>
            {benchmark.rows.length > 0 && (
              <div className="mt-3 rounded-md border border-amber-400/20 bg-amber-400/[0.05] px-2.5 py-2 text-[10px] text-amber-100/80">
                {benchmark.rows.length} baris results.csv sudah diimpor untuk benchmark analytics.
              </div>
            )}
          </Panel>

          <Note tone="warning" title="Honest scope">
            Ini adalah Simulation Mode di browser. Kode Python asli tersedia di folder{' '}
            <span className="font-mono text-amber-100">python/</span>, tetapi tidak dijalankan oleh
            halaman ini. Dynamic queue, fault injection, dan timing adalah perilaku simulator;
            results.csv yang diimpor adalah satu-satunya data benchmark nyata di UI.
          </Note>
        </div>
      </div>
    </div>
  )
}
