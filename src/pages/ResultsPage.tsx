import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowRight, CheckCircle2, GitMerge, ShieldCheck, Timer } from 'lucide-react'
import { useSimulation } from '../engine/SimulationProvider'
import { BASE_TICK_SECONDS } from '../types'
import { formatNumber, formatSeconds, mergeLabel, scheduleLabel } from '../lib/format'
import { EmptyState, Note, Panel, Stat, Tag } from '../components/ui/Primitives'
import { ArrayBars, MiniArray } from '../components/charts/ArrayBars'
import { HistogramChart } from '../components/charts/HistogramChart'
import { MergeTree } from '../components/charts/MergeTree'
import { CHART_COLORS, CHART_TOOLTIP } from '../components/charts/chartTheme'
import { BenchmarkAnalytics } from '../components/benchmark/BenchmarkPanels'

export function ResultsPage() {
  const { state, stats } = useSimulation()
  const aggregate = state.aggregate
  const isPreview = !aggregate
  const totalItems = aggregate?.totalItems ?? state.baseline.totalItems
  const uniqueValues = aggregate?.uniqueValues ?? state.baseline.uniqueValues
  const checksum = aggregate?.checksum ?? state.baseline.checksum
  const histogram = aggregate?.histogram ?? state.baseline.histogram
  const sortedSample = aggregate?.sortedSample ?? state.baseline.sortedSample
  const sorted = aggregate?.sorted ?? false
  const checksumVerified = aggregate?.checksumVerified ?? false
  const mergeMode = aggregate?.mergeMode ?? state.settings.mergeMode

  const successfulWorkers = state.workers.filter((worker) => worker.tasksCompleted > 0).length
  const contributionData = state.workers.map((worker) => ({
    worker: worker.id,
    items: worker.itemsProcessed,
    chunks: worker.tasksCompleted,
  }))
  const taskData = state.workers
    .filter((worker) => worker.tasksCompleted > 0)
    .map((worker) => ({ name: worker.id, value: worker.tasksCompleted }))

  const maxTick = Math.max(
    1,
    state.tick,
    ...state.workers.flatMap((worker) => worker.timeline.map((entry) => entry.endTick)),
  )
  const hasTimeline = state.workers.some((worker) => worker.timeline.length > 0)
  const durationSec = (state.completedTick ?? state.tick) * BASE_TICK_SECONDS

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Items sorted" value={formatNumber(totalItems)} hint="Final aggregate" />
        <Stat label="Chunks" value={state.tasks.length} hint={scheduleLabel(state.settings.schedule)} />
        <Stat label="Successful workers" value={successfulWorkers} hint={`of ${state.workers.length} workers`} />
        <Stat label="Unique values" value={formatNumber(uniqueValues)} hint="Membership of output" />
        <Stat label="Merge groups" value={stats.mergeGroupsTotal || '—'} hint={mergeLabel(mergeMode)} />
        <Stat label="Duration" value={formatSeconds(durationSec)} hint="Simulated clock" accent />
      </div>

      {isPreview && (
        <Note tone="warning" title="Preview — simulation not completed">
          Chart di bawah memakai proyeksi deterministik dari array aktif. Payload per worker dan
          merge tree baru terisi setelah run selesai. Buka{' '}
          <Link to="/simulation" className="font-medium text-cyan-200 underline decoration-cyan-500/40">
            halaman Simulation
          </Link>{' '}
          lalu jalankan simulasi.
        </Note>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Panel
          title="Sorted output"
          subtitle="Array final beserta verifikasi urutan dan checksum"
          action={
            <Tag tone={checksumVerified ? 'emerald' : 'amber'}>
              {checksumVerified ? 'verified' : isPreview ? 'preview' : 'in progress'}
            </Tag>
          }
        >
          <div className="rounded-lg border border-line-soft bg-ink-850/60 p-2">
            <ArrayBars values={sortedSample} tone="emerald" height={92} maxBars={60} showAxis />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-md border border-line bg-ink-850 px-2.5 py-2">
              <p className="text-[9px] text-faint">Order check</p>
              <p className={`mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium ${sorted ? 'text-emerald-300' : 'text-amber-300'}`}>
                <CheckCircle2 size={11} />
                {sorted ? 'monotonic non-decreasing' : 'awaiting final merge'}
              </p>
            </div>
            <div className="rounded-md border border-line bg-ink-850 px-2.5 py-2">
              <p className="text-[9px] text-faint">Checksum</p>
              <p className={`mt-0.5 inline-flex items-center gap-1 font-mono text-[11px] ${checksumVerified ? 'text-emerald-300' : 'text-muted'}`}>
                <ShieldCheck size={11} />
                {formatNumber(checksum)}
              </p>
            </div>
            <div className="rounded-md border border-line bg-ink-850 px-2.5 py-2">
              <p className="text-[9px] text-faint">Value range</p>
              <p className="mt-0.5 font-mono text-[11px] text-mist">
                {formatNumber(aggregate?.min ?? state.baseline.min)} –{' '}
                {formatNumber(aggregate?.max ?? state.baseline.max)}
              </p>
            </div>
            <div className="rounded-md border border-line bg-ink-850 px-2.5 py-2">
              <p className="text-[9px] text-faint">Median</p>
              <p className="mt-0.5 font-mono text-[11px] text-mist">
                {formatNumber(Math.round(aggregate?.median ?? state.baseline.median))}
              </p>
            </div>
          </div>
        </Panel>

        <Panel
          title="Output distribution"
          subtitle="Histogram array final setelah sorting"
          action={<Tag tone="cyan">{histogram.length} bins</Tag>}
        >
          <HistogramChart bins={histogram} height={250} color="#34d399" />
          <p className="mt-2 text-[10px] leading-relaxed text-faint">
            Histogram yang sama dengan input membuktikan sort tidak menambah atau menghilangkan
            elemen; checksum verification memeriksa jumlah nilai.
          </p>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Items sorted per worker"
          subtitle="Kontribusi worker sebelum digabung di master"
          action={<Tag tone={successfulWorkers > 0 ? 'emerald' : 'slate'}>{successfulWorkers} contributors</Tag>}
        >
          {successfulWorkers > 0 ? (
            <ResponsiveContainer width="100%" height={270}>
              <BarChart data={contributionData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#162a44" vertical={false} />
                <XAxis dataKey="worker" tick={{ fill: '#5f7492', fontSize: 9 }} axisLine={{ stroke: '#1d3350' }} tickLine={false} />
                <YAxis tick={{ fill: '#5f7492', fontSize: 10 }} axisLine={false} tickLine={false} width={44} />
                <Tooltip {...CHART_TOOLTIP} />
                <Bar dataKey="items" name="items sorted" fill="#22d3ee" radius={[4, 4, 0, 0]} barSize={22} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              title="Belum ada payload worker"
              hint="Jalankan simulasi agar setiap worker menyelesaikan local sort dan mengembalikan items."
            />
          )}
        </Panel>

        <Panel
          title="Chunk completion distribution"
          subtitle="Chunk yang diselesaikan tiap worker simulasi"
          action={<Tag tone={taskData.length > 0 ? 'emerald' : 'slate'}>{stats.returned} returned</Tag>}
        >
          {taskData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={taskData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={56}
                    outerRadius={88}
                    paddingAngle={2}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {taskData.map((entry, index) => (
                      <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...CHART_TOOLTIP} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
                {taskData.map((entry, index) => (
                  <span key={entry.name} className="inline-flex items-center gap-1.5 text-[10px] text-muted">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    {entry.name} · {entry.value}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              title="Belum ada chunk selesai"
              hint="Distribusi chunk muncul setelah worker mengembalikan hasil pertamanya."
            />
          )}
        </Panel>
      </div>

      <Panel
        title="Merge tree"
        subtitle="Bagaimana sorted run digabung di worker tier dan/atau master"
        action={<Tag tone={mergeMode === 'tiered' ? 'blue' : 'cyan'}>{mergeLabel(mergeMode)}</Tag>}
      >
        <MergeTree groups={state.mergeGroups} mergeMode={mergeMode} />
        {aggregate && (
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="rounded-md border border-line bg-ink-850 px-2.5 py-2">
              <p className="text-[9px] text-faint">Worker runs</p>
              <p className="text-sm font-semibold text-mist tabular-nums">{aggregate.workerRuns}</p>
            </div>
            <div className="rounded-md border border-line bg-ink-850 px-2.5 py-2">
              <p className="text-[9px] text-faint">Tiered merges</p>
              <p className="text-sm font-semibold text-mist tabular-nums">{aggregate.tieredMerges}</p>
            </div>
            <div className="rounded-md border border-line bg-ink-850 px-2.5 py-2">
              <p className="text-[9px] text-faint">Merge duration</p>
              <p className="text-sm font-semibold text-mist tabular-nums">{aggregate.mergeDurationTicks} ticks</p>
            </div>
            <div className="rounded-md border border-line bg-ink-850 px-2.5 py-2">
              <p className="text-[9px] text-faint">Checksum verified</p>
              <p className={`text-sm font-semibold ${aggregate.checksumVerified ? 'text-emerald-300' : 'text-amber-300'}`}>
                {aggregate.checksumVerified ? 'yes' : 'no'}
              </p>
            </div>
          </div>
        )}
      </Panel>

      <Panel
        title="Worker result payloads"
        subtitle="Sorted run terakhir dari setiap worker beserta checksum"
        action={<Tag tone="cyan">Before aggregation</Tag>}
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[11px]">
            <thead>
              <tr className="border-b border-line-soft text-[9px] tracking-[0.12em] text-faint uppercase">
                <th className="px-4 py-2.5 font-medium">Worker</th>
                <th className="px-4 py-2.5 font-medium">Cores</th>
                <th className="px-4 py-2.5 font-medium">Chunks</th>
                <th className="px-4 py-2.5 font-medium">Items</th>
                <th className="px-4 py-2.5 font-medium">Failures</th>
                <th className="px-4 py-2.5 font-medium">Last run</th>
                <th className="px-4 py-2.5 font-medium">Last duration</th>
                <th className="px-4 py-2.5 font-medium">Checksum</th>
              </tr>
            </thead>
            <tbody>
              {state.workers.map((worker) => {
                const lastRun = worker.completedRuns[worker.completedRuns.length - 1]
                return (
                  <tr key={worker.id} className="border-b border-line-soft/60 last:border-0 hover:bg-ink-850/40">
                    <td className="px-4 py-2 font-mono text-accent">{worker.id}</td>
                    <td className="px-4 py-2 text-muted">{worker.cores}</td>
                    <td className="px-4 py-2 text-muted tabular-nums">{worker.tasksCompleted}</td>
                    <td className="px-4 py-2 text-muted tabular-nums">{formatNumber(worker.itemsProcessed)}</td>
                    <td className="px-4 py-2 tabular-nums">
                      <span className={worker.failures > 0 ? 'text-rose-300' : 'text-muted'}>{worker.failures}</span>
                    </td>
                    <td className="px-4 py-2">
                      {lastRun ? (
                        <div className="flex items-center gap-2">
                          <MiniArray values={lastRun.values} tone="emerald" height={20} maxBars={16} />
                          <span className="font-mono text-[9px] text-faint">{lastRun.taskId}</span>
                        </div>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-faint">
                      {worker.lastTaskDurationSec === null ? '—' : `${worker.lastTaskDurationSec}s`}
                    </td>
                    <td className="px-4 py-2 font-mono text-[10px] text-muted">
                      {lastRun ? formatNumber(lastRun.checksum) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title="Processing timeline"
        subtitle="Window chunk per worker · 1 tick = 0.7s simulated time"
        action={
          <Tag tone="cyan">
            <Timer size={10} /> tick {state.tick}
          </Tag>
        }
      >
        {hasTimeline ? (
          <div className="space-y-1.5">
            {state.workers.map((worker) => (
              <div key={worker.id} className="grid grid-cols-[64px_1fr] items-center gap-2">
                <span className="font-mono text-[9px] text-faint">{worker.id}</span>
                <div className="relative h-5 overflow-hidden rounded border border-line-soft bg-ink-850">
                  {worker.timeline.map((entry, index) => {
                    const left = (entry.startTick / maxTick) * 100
                    const width = Math.max(1.5, ((entry.endTick - entry.startTick) / maxTick) * 100)
                    return (
                      <div
                        key={`${entry.taskId}-${entry.startTick}`}
                        title={`${entry.taskId} · ticks ${entry.startTick}–${entry.endTick}`}
                        className={`absolute inset-y-0.5 rounded-sm ${
                          index % 2 === 0 ? 'bg-cyan-500/60' : 'bg-blue-500/60'
                        } transition hover:bg-cyan-400/80`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
            <div className="ml-16 flex justify-between pt-1 text-[9px] text-faint">
              <span>0.0s</span>
              <span>{(maxTick * BASE_TICK_SECONDS / 2).toFixed(1)}s</span>
              <span>{(maxTick * BASE_TICK_SECONDS).toFixed(1)}s</span>
            </div>
          </div>
        ) : (
          <EmptyState
            title="Timeline masih kosong"
            hint="Window eksekusi muncul setelah worker menyelesaikan chunk pertamanya."
          />
        )}
      </Panel>

      <BenchmarkAnalytics />

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="How the aggregate is built" subtitle="Master–Worker merge semantics">
          <div className="space-y-2 text-[11px] leading-relaxed text-muted">
            <p>
              Setiap worker menyortir chunk menjadi beberapa local run per core, lalu menggabungkan
              run tersebut menjadi satu sorted run. Master menerima sorted run beserta checksum.
            </p>
            <p>
              Mode master merge menggabungkan semua run langsung di master. Mode tiered merge
              menggabungkan run di worker tier terlebih dahulu agar master menerima lebih sedikit
              input—pilihan trade-off yang bisa dibandingkan dari waktu merge.
            </p>
            <p className="text-faint">
              Seluruh angka sorting adalah Simulation Result deterministik. Angka benchmark di panel
              “Imported Python benchmarks” berasal dari results.csv dan diberi label Measured.
            </p>
          </div>
        </Panel>

        <Note tone="warning" title="Result labels">
          Values on this page are labelled Simulation Result atau Preview. Tidak ada angka acak per
          render: reset dan jalankan ulang dataset yang sama akan menghasilkan checksum, unique
          count, merge tree, dan timestamp simulasi yang sama.
        </Note>
      </div>

      {isPreview && (
        <Link
          to="/simulation"
          className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-2 text-xs font-medium text-cyan-200 transition hover:bg-cyan-500/15"
        >
          Run the simulation
          <ArrowRight size={13} />
        </Link>
      )}

      <div className="flex items-center gap-2 text-[10px] text-faint">
        <GitMerge size={12} />
        {state.tasks.length} chunks · {stats.mergeGroupsMerged}/{stats.mergeGroupsTotal} merge groups ·{' '}
        {state.faultsInjected} injected faults · {state.requeued} requeued
      </div>
    </div>
  )
}
