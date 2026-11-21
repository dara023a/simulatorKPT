import { useMemo, useState, type ChangeEvent } from 'react'
import { Check, Database, FileText, Layers, Upload } from 'lucide-react'
import { useSimulation } from '../engine/SimulationProvider'
import { BUILT_IN_DATASETS, createUploadedDataset } from '../data/datasets'
import type { Dataset } from '../types'
import { formatNumber, truncateText } from '../lib/format'
import { Note, Panel, ProgressBar, Stat, Tag } from '../components/ui/Primitives'

function SourceTag({ source }: { source: Dataset['source'] }) {
  if (source === 'upload') return <Tag tone="amber">Uploaded · local</Tag>
  if (source === 'demo') return <Tag tone="blue">Built-in demo</Tag>
  return <Tag tone="cyan">Simulated sample</Tag>
}

export function DatasetPage() {
  const { state, selectDataset, stats } = useSimulation()
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const options = useMemo(() => {
    const list = [...BUILT_IN_DATASETS]
    if (state.dataset.source === 'upload' && !list.some((dataset) => dataset.id === state.dataset.id)) {
      list.push(state.dataset)
    }
    return list
  }, [state.dataset])

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const doc of state.dataset.docs) {
      counts.set(doc.category, (counts.get(doc.category) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [state.dataset])

  const maxCategoryCount = categoryCounts[0]?.[1] ?? 1

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const dataset = createUploadedDataset(file.name, text)
      selectDataset(dataset)
      setFileName(file.name)
      setError(null)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not read the file.')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Documents" value={formatNumber(state.dataset.docs.length)} hint="Local corpus" />
        <Stat label="Categories" value={state.dataset.categories.length} hint="Topic labels" />
        <Stat label="Words" value={formatNumber(state.baseline.totalWords)} hint="After stopword filtering" />
        <Stat label="Tasks" value={stats.tasksTotal} hint={`${state.dataset.taskSize} docs / task`} />
        <Stat
          label="Unique words"
          value={formatNumber(state.baseline.uniqueWords)}
          hint="Full-corpus projection"
          accent
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Choose a dataset"
          subtitle="Selecting a dataset resets the simulation so analytics stay consistent"
          action={<Tag tone="emerald">Offline fallback ready</Tag>}
        >
          <div className="grid gap-2.5 md:grid-cols-2">
            {options.map((dataset) => {
              const selected = state.dataset.id === dataset.id
              const taskCount = Math.ceil(dataset.docs.length / dataset.taskSize)
              return (
                <button
                  key={dataset.id}
                  type="button"
                  onClick={() => {
                    selectDataset(dataset)
                    setFileName(null)
                    setError(null)
                  }}
                  className={`rounded-lg border p-3 text-left transition ${
                    selected
                      ? 'border-accent/60 bg-cyan-500/[0.06]'
                      : 'border-line bg-ink-850/60 hover:border-cyan-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <SourceTag source={dataset.source} />
                    {selected && <Check size={14} className="text-accent" />}
                  </div>
                  <p className="mt-2 text-[12px] font-semibold text-mist">{dataset.name}</p>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted">
                    {dataset.description}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-[9px] text-faint">
                    <span className="inline-flex items-center gap-1">
                      <Database size={10} /> {formatNumber(dataset.docs.length)} docs
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Layers size={10} /> {dataset.categories.length} cats
                    </span>
                    <span>{taskCount} tasks</span>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-3">
            <Note tone="neutral">{state.dataset.note}</Note>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel
            title="Upload your own text"
            subtitle="Parsed locally in the browser · documents separated by blank lines"
            action={<Tag tone="amber">Optional</Tag>}
          >
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-ink-850/60 px-4 py-6 text-[11px] text-muted transition hover:border-cyan-500/40 hover:text-mist">
              <Upload size={15} className="text-accent" />
              <span>Choose a .txt or .md file</span>
              <input
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                onChange={handleFile}
                className="hidden"
              />
            </label>
            {fileName && !error && (
              <p className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-300">
                <Check size={11} /> Loaded {fileName} as the active dataset.
              </p>
            )}
            {error && <p className="mt-2 text-[10px] text-rose-300">{error}</p>}
            <p className="mt-2 text-[10px] leading-relaxed text-faint">
              Empty lines split documents. The upload is capped at 250 documents and never leaves
              your device.
            </p>
          </Panel>

          <Panel title="Dataset split" subtitle="How the master will decompose the corpus">
            <div className="space-y-2 text-[11px] text-muted">
              <div className="flex items-center justify-between">
                <span>Documents</span>
                <span className="font-mono text-mist">{formatNumber(state.dataset.docs.length)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Task size</span>
                <span className="font-mono text-mist">{state.dataset.taskSize} docs</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Tasks generated</span>
                <span className="font-mono text-mist">{stats.tasksTotal}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Worker count</span>
                <span className="font-mono text-mist">{stats.workerCount}</span>
              </div>
            </div>
            <div className="mt-3">
              <ProgressBar value={stats.progressPct} tone="emerald" />
              <p className="mt-1.5 text-[10px] text-faint">
                {stats.returned} of {stats.tasksTotal} tasks returned to the master.
              </p>
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.5fr]">
        <Panel title="Category distribution" subtitle="Documents per topic label">
          <div className="space-y-2">
            {categoryCounts.slice(0, 10).map(([category, count]) => (
              <div key={category}>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="truncate font-mono text-muted">{category}</span>
                  <span className="ml-2 shrink-0 text-faint tabular-nums">{count} docs</span>
                </div>
                <ProgressBar
                  value={(count / maxCategoryCount) * 100}
                  tone="blue"
                  className="mt-1"
                  height="h-1"
                />
              </div>
            ))}
            {categoryCounts.length === 0 && (
              <p className="text-[11px] text-faint">No documents in this dataset.</p>
            )}
          </div>
        </Panel>

        <Panel
          title="Document preview"
          subtitle="First documents in the corpus · content is simulated text"
          action={<Tag tone="cyan">{state.dataset.source === 'upload' ? 'Uploaded' : 'Sample'}</Tag>}
        >
          <div className="grid gap-2.5 md:grid-cols-2">
            {state.dataset.docs.slice(0, 6).map((doc) => (
              <div key={doc.id} className="rounded-lg border border-line bg-ink-850/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-[11px] font-medium text-mist">{doc.title}</p>
                  <Tag tone="slate">{doc.text.split(/\s+/).length}w</Tag>
                </div>
                <p className="mt-0.5 font-mono text-[9px] text-faint">{doc.category}</p>
                <p className="mt-1.5 text-[10px] leading-relaxed text-muted">
                  {truncateText(doc.text, 190)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-start gap-2 text-[10px] text-faint">
            <FileText size={12} className="mt-0.5 shrink-0" />
            Showing {Math.min(6, state.dataset.docs.length)} of {formatNumber(state.dataset.docs.length)}{' '}
            documents. Word counts exclude common English stopwords using the simulator tokenizer.
          </div>
        </Panel>
      </div>

      <Note tone="warning" title="Dataset honesty">
        The bundled datasets are generated simulations (240 and 90 documents), inspired by the 20
        Newsgroups topic list but not the real 18,846-document archive. They exist so the demo runs
        offline without scikit-learn or a network connection. Uploaded files are read locally in
        your browser.
      </Note>
    </div>
  )
}
