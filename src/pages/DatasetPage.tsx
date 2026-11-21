import { Check, Database, Layers, SlidersHorizontal } from 'lucide-react'
import { useSimulation } from '../engine/SimulationProvider'
import { SORTING_DATASETS, sampleValues } from '../engine/sorting'
import { formatNumber, scheduleLabel } from '../lib/format'
import { Note, Panel, ProgressBar, Stat, Tag } from '../components/ui/Primitives'
import { ArrayBars, MiniArray } from '../components/charts/ArrayBars'
import { HistogramChart } from '../components/charts/HistogramChart'
import { BenchmarkImportCard } from '../components/benchmark/BenchmarkPanels'

function patternTone(pattern: string): 'cyan' | 'blue' | 'amber' {
  if (pattern === 'duplicates') return 'blue'
  if (pattern === 'nearly-sorted') return 'amber'
  return 'cyan'
}

export function DatasetPage() {
  const { state, stats, selectDataset } = useSimulation()
  const dataset = state.dataset
  const chunkSizes = state.tasks.map((task) => task.itemCount)
  const minChunk = chunkSizes.length > 0 ? Math.min(...chunkSizes) : 0
  const maxChunk = chunkSizes.length > 0 ? Math.max(...chunkSizes) : 0
  const totalCores = state.workers.reduce((sum, worker) => sum + worker.cores, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Items" value={formatNumber(dataset.totalItems)} hint="Deterministic int32 array" />
        <Stat label="Value range" value={`${formatNumber(state.baseline.min)}–${formatNumber(state.baseline.max)}`} hint="Min / max input" />
        <Stat label="Unique values" value={formatNumber(state.baseline.uniqueValues)} hint="Merged membership" />
        <Stat label="Chunks" value={stats.tasksTotal} hint={`${state.settings.schedule} schedule`} />
        <Stat label="Simulated cores" value={totalCores} hint={`${stats.workerCount} workers`} accent />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Panel
          title="Choose a sorting dataset"
          subtitle="Memilih dataset mereset simulasi agar seluruh halaman memakai array yang sama"
          action={<Tag tone="emerald">Offline · deterministic</Tag>}
        >
          <div className="grid gap-2.5 md:grid-cols-2">
            {SORTING_DATASETS.map((option) => {
              const selected = dataset.id === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => selectDataset(option)}
                  className={`rounded-lg border p-3 text-left transition ${
                    selected
                      ? 'border-accent/60 bg-cyan-500/[0.06]'
                      : 'border-line bg-ink-850/60 hover:border-cyan-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <Tag tone={patternTone(option.pattern)}>{option.pattern}</Tag>
                    {selected && <Check size={14} className="text-accent" />}
                  </div>
                  <p className="mt-2 text-[12px] font-semibold text-mist">{option.shortName}</p>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted">
                    {option.description}
                  </p>
                  <div className="mt-2">
                    <MiniArray values={sampleValues(option.values, 120)} tone="mixed" height={22} maxBars={36} />
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[9px] text-faint">
                    <span className="inline-flex items-center gap-1">
                      <Database size={10} /> {formatNumber(option.totalItems)} items
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Layers size={10} /> seed {option.seed}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-3">
            <Note tone="neutral">{dataset.note}</Note>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel
            title="Array preview"
            subtitle="Input dan proyeksi output terurut dari dataset aktif"
            action={<Tag tone="cyan">Simulated input</Tag>}
          >
            <p className="mb-1 text-[9px] tracking-wide text-faint uppercase">Input sample</p>
            <div className="rounded-md border border-line-soft bg-ink-850/60 p-1.5">
              <ArrayBars values={dataset.values} height={52} maxBars={52} tone="mixed" />
            </div>
            <p className="mt-3 mb-1 text-[9px] tracking-wide text-faint uppercase">Sorted target</p>
            <div className="rounded-md border border-line-soft bg-ink-850/60 p-1.5">
              <ArrayBars values={state.baseline.sortedSample} height={52} maxBars={52} tone="emerald" />
            </div>
            <div className="mt-2 flex items-center justify-between text-[9px] text-faint">
              <span>{formatNumber(dataset.totalItems)} values</span>
              <span className="font-mono">checksum {formatNumber(state.baseline.checksum)}</span>
            </div>
          </Panel>

          <Panel title="Decomposition plan" subtitle="Master memotong array menjadi unit kerja">
            <div className="space-y-2 text-[11px] text-muted">
              <div className="flex items-center justify-between">
                <span>Schedule</span>
                <span className="font-mono text-mist">{scheduleLabel(state.settings.schedule)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Chunks generated</span>
                <span className="font-mono text-mist">{stats.tasksTotal}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Chunk size</span>
                <span className="font-mono text-mist">
                  {minChunk === maxChunk ? formatNumber(minChunk) : `${formatNumber(minChunk)}–${formatNumber(maxChunk)}`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Chunks / worker target</span>
                <span className="font-mono text-mist">{state.settings.chunksPerWorker}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Worker cores</span>
                <span className="font-mono text-mist">
                  {state.workers.map((worker) => worker.cores).join(' / ')}
                </span>
              </div>
            </div>
            <div className="mt-3">
              <ProgressBar value={stats.progressPct} tone="emerald" />
              <p className="mt-1.5 text-[10px] text-faint">
                {stats.returned} of {stats.tasksTotal} chunks sudah kembali ke master.
              </p>
            </div>
            <div className="mt-3 flex items-start gap-2 text-[10px] leading-relaxed text-faint">
              <SlidersHorizontal size={12} className="mt-0.5 shrink-0 text-accent" />
              Ubah worker, schedule, chunk ratio, merge mode, dan fault injection di sidebar.
            </div>
          </Panel>
        </div>
      </div>

      <Panel
        title="Value distribution"
        subtitle="Histogram input aktif · dihitung dari array yang benar-benar diproses"
        action={<Tag tone="cyan">{state.baseline.histogram.length} bins</Tag>}
      >
        <HistogramChart bins={state.baseline.histogram} height={220} />
      </Panel>

      <BenchmarkImportCard />

      <Note tone="warning" title="Dataset honesty">
        Ketiga array adalah data simulasi deterministik yang dibangkitkan dari seed tetap; bukan
        hasil benchmark perangkat. File results.csv yang diimpor di panel atas berasal dari eksekusi
        Python Anda dan tidak mengubah array yang dianimasikan.
      </Note>
    </div>
  )
}
