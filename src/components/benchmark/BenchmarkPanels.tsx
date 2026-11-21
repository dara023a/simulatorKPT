import { useRef, type ChangeEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowRight,
  Check,
  Download,
  FileSpreadsheet,
  RotateCcw,
  Upload,
} from 'lucide-react'
import { useSimulation } from '../../engine/SimulationProvider'
import { BENCHMARK_TEMPLATE, type BenchmarkSummary } from '../../engine/benchmark'
import { formatNumber, formatSeconds } from '../../lib/format'
import {
  EmptyState,
  Note,
  Panel,
  Stat,
  Tag,
  cx,
} from '../ui/Primitives'
import { CHART_COLORS, CHART_TOOLTIP } from '../charts/chartTheme'

function downloadTemplate(): void {
  const blob = new Blob([`${BENCHMARK_TEMPLATE}\n`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'results-template.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}

function ModeTag({ mode }: { mode: string }) {
  const tone = mode === 'dist' ? 'cyan' : mode === 'local' ? 'blue' : mode === 'seq' ? 'amber' : 'slate'
  return <Tag tone={tone}>{mode}</Tag>
}

export function BenchmarkCharts({ summary }: { summary: BenchmarkSummary }) {
  const throughputData = summary.byMode.map((entry) => ({
    mode: entry.mode,
    throughput: entry.bestThroughput ?? 0,
    rows: entry.rows,
  }))
  const scalabilityData = summary.scalability.map((entry) => ({
    workers: `W${entry.workers}`,
    tTotal: entry.medianTTotal ?? 0,
    throughput: entry.throughput ?? 0,
    rows: entry.rows,
  }))

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel
        title="Throughput by mode"
        subtitle="Nilai terbaik per mode dari results.csv · satuan juta elemen/detik"
        action={<Tag tone="cyan">Measured</Tag>}
      >
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={throughputData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#162a44" vertical={false} />
            <XAxis dataKey="mode" tick={{ fill: '#8fa3c2', fontSize: 11 }} axisLine={{ stroke: '#1d3350' }} tickLine={false} />
            <YAxis tick={{ fill: '#5f7492', fontSize: 10 }} axisLine={false} tickLine={false} width={38} />
            <Tooltip {...CHART_TOOLTIP} />
            <Bar dataKey="throughput" fill="#22d3ee" radius={[4, 4, 0, 0]} barSize={34} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel
        title="Scalability · distributed rows"
        subtitle="Median t_total dan throughput berdasarkan jumlah worker"
        action={<Tag tone="blue">results.csv</Tag>}
      >
        {scalabilityData.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={scalabilityData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#162a44" vertical={false} />
              <XAxis dataKey="workers" tick={{ fill: '#8fa3c2', fontSize: 10 }} axisLine={{ stroke: '#1d3350' }} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fill: '#5f7492', fontSize: 10 }} axisLine={false} tickLine={false} width={38} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#5f7492', fontSize: 10 }} axisLine={false} tickLine={false} width={38} />
              <Tooltip {...CHART_TOOLTIP} />
              <Legend wrapperStyle={{ fontSize: 10, color: '#8fa3c2' }} />
              <Line yAxisId="left" type="monotone" dataKey="tTotal" name="t_total (s)" stroke="#22d3ee" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line yAxisId="right" type="monotone" dataKey="throughput" name="M elem/s" stroke="#34d399" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState title="Belum ada baris mode dist" hint="CSV perlu berisi baris dengan mode=dist dan workers." />
        )}
      </Panel>

      <Panel
        title="Phase breakdown"
        subtitle="Sort/transfer, merge tier di worker, dan merge serial di master"
        action={<Tag tone="cyan">Measured</Tag>}
        className="xl:col-span-2"
      >
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={summary.phaseBreakdown} margin={{ top: 8, right: 8, bottom: 24, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#162a44" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#5f7492', fontSize: 9 }}
              axisLine={{ stroke: '#1d3350' }}
              tickLine={false}
              interval={0}
              angle={-16}
              textAnchor="end"
              height={48}
            />
            <YAxis tick={{ fill: '#5f7492', fontSize: 10 }} axisLine={false} tickLine={false} width={38} />
            <Tooltip {...CHART_TOOLTIP} />
            <Legend wrapperStyle={{ fontSize: 10, color: '#8fa3c2' }} />
            <Bar dataKey="sort" name="sort + transfer" stackId="phase" fill="#22d3ee" isAnimationActive={false} />
            <Bar dataKey="tier" name="worker tier merge" stackId="phase" fill="#60a5fa" isAnimationActive={false} />
            <Bar dataKey="merge" name="master merge" stackId="phase" fill="#fbbf24" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  )
}

export function BenchmarkTable({ summary, limit = 10 }: { summary: BenchmarkSummary; limit?: number }) {
  const rows = summary.rows.slice(-limit).reverse()
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-[11px]">
        <thead>
          <tr className="border-b border-line-soft text-[9px] tracking-[0.12em] text-faint uppercase">
            <th className="px-4 py-2.5 font-medium">Mode</th>
            <th className="px-4 py-2.5 font-medium">Algo</th>
            <th className="px-4 py-2.5 font-medium">Size</th>
            <th className="px-4 py-2.5 font-medium">Workers</th>
            <th className="px-4 py-2.5 font-medium">Schedule</th>
            <th className="px-4 py-2.5 font-medium">Merge</th>
            <th className="px-4 py-2.5 font-medium">t_total</th>
            <th className="px-4 py-2.5 font-medium">Throughput</th>
            <th className="px-4 py-2.5 font-medium">OK</th>
            <th className="px-4 py-2.5 font-medium">Fail / requeue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.timestamp}-${row.mode}-${index}`} className="border-b border-line-soft/60 last:border-0 hover:bg-ink-850/40">
              <td className="px-4 py-2"><ModeTag mode={row.mode} /></td>
              <td className="px-4 py-2 font-mono text-muted">{row.algo || '—'}</td>
              <td className="px-4 py-2 text-muted tabular-nums">{row.size === null ? '—' : formatNumber(row.size)}</td>
              <td className="px-4 py-2 text-muted tabular-nums">{row.workers ?? '—'}</td>
              <td className="px-4 py-2 text-muted">{row.schedule || '—'}</td>
              <td className="px-4 py-2 text-muted">{row.merge || '—'}</td>
              <td className="px-4 py-2 text-mist tabular-nums">{row.tTotal === null ? '—' : formatSeconds(row.tTotal)}</td>
              <td className="px-4 py-2 text-muted tabular-nums">{row.throughput === null ? '—' : `${row.throughput.toFixed(2)}M/s`}</td>
              <td className="px-4 py-2">
                {row.ok === null ? <span className="text-faint">—</span> : row.ok ? <Tag tone="emerald">yes</Tag> : <Tag tone="rose">no</Tag>}
              </td>
              <td className="px-4 py-2 text-muted tabular-nums">{row.failures ?? 0} / {row.requeued ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BenchmarkUpload() {
  const { benchmark, importBenchmark, clearBenchmark } = useSimulation()
  const inputRef = useRef<HTMLInputElement | null>(null)

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    await importBenchmark(file)
    event.target.value = ''
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-[11px] font-medium text-cyan-200 transition hover:bg-cyan-500/15"
        >
          <Upload size={13} /> Import results.csv
        </button>
        <button
          type="button"
          onClick={downloadTemplate}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-850 px-3 py-2 text-[11px] font-medium text-muted transition hover:bg-ink-800 hover:text-mist"
        >
          <Download size={13} /> Template CSV
        </button>
        {benchmark.rows.length > 0 && (
          <button
            type="button"
            onClick={clearBenchmark}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-850 px-3 py-2 text-[11px] font-medium text-faint transition hover:bg-ink-800 hover:text-mist"
          >
            <RotateCcw size={12} /> Clear
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="hidden"
        />
      </div>

      {benchmark.error && (
        <p className="mt-2 rounded-md border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-[10px] text-rose-200">
          {benchmark.error}
        </p>
      )}
      {benchmark.fileName && benchmark.rows.length > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-300">
          <Check size={11} /> {benchmark.fileName} · {benchmark.rows.length} baris · nilai diimpor
          dari file, bukan dibangkitkan simulator.
        </p>
      )}
      {benchmark.warnings.length > 0 && (
        <div className="mt-2 rounded-md border border-amber-400/20 bg-amber-400/[0.05] px-3 py-2 text-[10px] text-amber-100/80">
          {benchmark.warnings.slice(0, 3).map((warning) => (
            <p key={warning}>• {warning}</p>
          ))}
        </div>
      )}
      <p className="mt-2 text-[10px] leading-relaxed text-faint">
        Kolom yang dikenali: mode, t_total, workers, schedule, merge, t_phase1, t_tier, t_merge,
        throughput_Melem_s, failures, requeued, recovery_max_s, dan kolom resmi master_sort.py.
        File dibaca lokal di browser.
      </p>
    </div>
  )
}

export function BenchmarkImportCard() {
  const { benchmark, benchmarkSummary } = useSimulation()

  return (
    <Panel
      title="Import results.csv"
      subtitle="Metrik nyata dari eksekusi Python master_sort.py · bukan data simulator"
      action={<Tag tone="amber">Measured data</Tag>}
    >
      <BenchmarkUpload />

      {benchmarkSummary ? (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Rows" value={formatNumber(benchmarkSummary.rowCount)} hint={`${benchmarkSummary.modes.length} modes`} />
            <Stat label="Best throughput" value={benchmarkSummary.bestThroughput === null ? '—' : `${benchmarkSummary.bestThroughput.toFixed(2)}M`} unit="/s" hint="dari kolom CSV" />
            <Stat label="Median t_total" value={benchmarkSummary.medianTTotal === null ? '—' : formatSeconds(benchmarkSummary.medianTTotal)} hint="semua baris" />
            <Stat label="OK / fail" value={`${benchmarkSummary.okCount}/${benchmarkSummary.failCount}`} hint={`${benchmarkSummary.totalRequeued} requeued`} />
          </div>
          <BenchmarkCharts summary={benchmarkSummary} />
          <div className="overflow-hidden rounded-lg border border-line">
            <BenchmarkTable summary={benchmarkSummary} limit={6} />
          </div>
          <Link to="/results" className="inline-flex items-center gap-1 text-[10px] font-medium text-accent hover:text-cyan-200">
            Buka analitik benchmark lengkap <ArrowRight size={11} />
          </Link>
        </div>
      ) : (
        <div className="mt-4">
          <EmptyState
            title="Belum ada results.csv"
            hint="Jalankan master_sort.py di Python, lalu unggah results.csv untuk menampilkan scalability, throughput, dan fault-tolerance nyata."
          />
        </div>
      )}

      <div className="mt-3">
        <Note tone="neutral">
          File ini tidak mengubah array simulasi. Yang diimpor adalah metrik hasil pengukuran Python;
          animasi sorting tetap memakai array deterministik di browser.
        </Note>
      </div>
    </Panel>
  )
}

export function BenchmarkAnalytics() {
  const { benchmark, benchmarkSummary } = useSimulation()

  if (!benchmarkSummary) {
    return (
      <Panel
        title="Imported Python benchmarks"
        subtitle="Opsional · results.csv dari master_sort.py"
        action={<Tag tone="slate">No file</Tag>}
      >
        <EmptyState
          title="Belum ada benchmark yang diimpor"
          hint="Buka Dataset & Benchmarks, unggah results.csv, lalu chart scalability dan throughput akan muncul di sini."
        />
        <div className="mt-3">
          <Link to="/dataset" className="inline-flex items-center gap-1 text-[10px] font-medium text-accent hover:text-cyan-200">
            <FileSpreadsheet size={11} /> Buka Dataset &amp; Benchmarks <ArrowRight size={11} />
          </Link>
        </div>
      </Panel>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="CSV rows" value={formatNumber(benchmarkSummary.rowCount)} hint={benchmark.fileName ?? 'results.csv'} />
        <Stat label="Modes" value={benchmarkSummary.modes.length} hint={benchmarkSummary.modes.join(', ')} />
        <Stat label="OK rows" value={benchmarkSummary.okCount} hint={`${benchmarkSummary.failCount} failed`} />
        <Stat label="Best throughput" value={benchmarkSummary.bestThroughput === null ? '—' : `${benchmarkSummary.bestThroughput.toFixed(2)}M`} unit="/s" hint="measured" accent />
        <Stat label="Failures" value={benchmarkSummary.totalFailures} hint={`${benchmarkSummary.totalRequeued} requeued`} />
        <Stat label="Recovery max" value={benchmarkSummary.maxRecoveryS === null ? '—' : formatSeconds(benchmarkSummary.maxRecoveryS)} hint="dari CSV" />
      </div>
      <BenchmarkCharts summary={benchmarkSummary} />
      <Panel title="Imported rows" subtitle="Baris terakhir dari results.csv" action={<Tag tone="amber">Measured</Tag>} bodyClassName="p-0">
        <BenchmarkTable summary={benchmarkSummary} limit={12} />
      </Panel>
    </div>
  )
}

export function BenchmarkInline({ children }: { children?: ReactNode }) {
  return <div className={cx('text-[10px] text-faint')}>{children}</div>
}

export const BENCHMARK_COLORS = CHART_COLORS
