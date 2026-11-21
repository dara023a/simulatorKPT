import { Link } from 'react-router-dom'
import { ArrowUpRight, Server } from 'lucide-react'
import { useSimulation } from '../../engine/SimulationProvider'
import { getAggregatePreview } from '../../engine/simulation'
import { formatNumber } from '../../lib/format'
import { Note, Panel, ProgressBar, Tag } from '../ui/Primitives'

export function MasterSummary() {
  const { state, stats } = useSimulation()
  const preview = getAggregatePreview(state)
  const finished = state.phase === 'completed'
  const merging = state.phase === 'aggregation'
  const mergePct = Math.round((state.aggregationMerged / state.workers.length) * 100)

  return (
    <Panel
      title={
        <span className="flex items-center gap-1.5">
          <Server size={14} className="text-master" />
          Master Node
        </span>
      }
      subtitle="Coordinates discovery, queueing, dispatch and aggregation"
      action={<Tag tone={finished ? 'emerald' : 'cyan'}>Simulated</Tag>}
    >
      <div className="flex items-center justify-between text-[10px] text-faint">
        <span>Documents returned to master</span>
        <span className="tabular-nums">
          {formatNumber(stats.returnedDocs)} / {formatNumber(stats.docsTotal)}
        </span>
      </div>
      <ProgressBar value={stats.docsTotal === 0 ? 0 : (stats.returnedDocs / stats.docsTotal) * 100} className="mt-1.5" />

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-md border border-line bg-ink-850 px-2.5 py-2">
          <p className="text-[9px] text-faint">Tasks returned</p>
          <p className="text-sm font-semibold text-mist tabular-nums">
            {stats.returned}
            <span className="text-[10px] font-normal text-faint"> / {stats.tasksTotal}</span>
          </p>
        </div>
        <div className="rounded-md border border-line bg-ink-850 px-2.5 py-2">
          <p className="text-[9px] text-faint">Queue length</p>
          <p className="text-sm font-semibold text-mist tabular-nums">{state.queue.length}</p>
        </div>
        <div className="rounded-md border border-line bg-ink-850 px-2.5 py-2">
          <p className="text-[9px] text-faint">Active workers</p>
          <p className="text-sm font-semibold text-mist tabular-nums">
            {stats.activeWorkers}
            <span className="text-[10px] font-normal text-faint"> / {stats.workerCount}</span>
          </p>
        </div>
        <div className="rounded-md border border-line bg-ink-850 px-2.5 py-2">
          <p className="text-[9px] text-faint">Unique words</p>
          <p className="text-sm font-semibold text-mist tabular-nums">
            {preview ? formatNumber(preview.uniqueWords) : '—'}
          </p>
        </div>
      </div>

      {(merging || finished) && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-faint">
            <span>Merged worker counters</span>
            <span className="tabular-nums">
              {state.aggregationMerged} / {state.workers.length}
            </span>
          </div>
          <ProgressBar value={mergePct} tone="emerald" className="mt-1.5" />
        </div>
      )}

      <div className="mt-3">
        <p className="mb-1.5 text-[9px] font-semibold tracking-[0.12em] text-faint uppercase">
          Top keywords in aggregate
        </p>
        {preview ? (
          <div className="flex flex-wrap gap-1">
            {preview.topWords.slice(0, 6).map((word) => (
              <Tag key={word.word} tone="cyan">
                {word.word}
                <span className="text-cyan-200/60">{word.count}</span>
              </Tag>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-faint">Aggregate appears after results return.</p>
        )}
      </div>

      {finished ? (
        <Link
          to="/results"
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:text-cyan-200"
        >
          Open final analytics
          <ArrowUpRight size={12} />
        </Link>
      ) : (
        <div className="mt-3">
          <Note tone="neutral">
            Result previews come from counters already returned. Final numbers are produced only
            after the aggregation phase.
          </Note>
        </div>
      )}
    </Panel>
  )
}
