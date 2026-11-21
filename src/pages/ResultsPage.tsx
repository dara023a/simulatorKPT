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
import { ArrowRight, Timer } from 'lucide-react'
import { useSimulation } from '../engine/SimulationProvider'
import { topWords } from '../engine/analyzer'
import { WordCloud } from '../components/charts/WordCloud'
import { BASE_TICK_SECONDS } from '../types'
import { formatNumber } from '../lib/format'
import { EmptyState, Note, Panel, Stat, Tag } from '../components/ui/Primitives'

const TOOLTIP_PROPS = {
  contentStyle: {
    background: '#0a1322',
    border: '1px solid #1d3350',
    borderRadius: 8,
    fontSize: 11,
    color: '#c9d8ee',
  },
  labelStyle: { color: '#c9d8ee', fontSize: 11 },
  itemStyle: { color: '#8fa3c2', fontSize: 11 },
}

const PIE_COLORS = ['#22d3ee', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#fb7185', '#2dd4bf', '#93c5fd', '#f0abfc']

export function ResultsPage() {
  const { state } = useSimulation()
  const aggregate = state.aggregate ?? state.baseline
  const isPreview = !state.aggregate

  const topTen = aggregate.topWords.slice(0, 10)
  const cloudWords = topWords(aggregate.frequencies, 45)
  const successfulWorkers = state.workers.filter((worker) => worker.tasksCompleted > 0).length
  const docsData = state.workers.map((worker) => ({ worker: worker.id, docs: worker.docsProcessed }))
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
        <Stat label="Documents" value={formatNumber(aggregate.totalDocs)} hint="In aggregate" />
        <Stat label="Tasks" value={state.tasks.length} hint="Decomposed units" />
        <Stat
          label="Successful workers"
          value={successfulWorkers}
          hint={`of ${state.workers.length} workers`}
        />
        <Stat label="Total words" value={formatNumber(aggregate.totalWords)} hint="Filtered tokens" />
        <Stat
          label="Unique words"
          value={formatNumber(aggregate.uniqueWords)}
          hint="Merged Counter keys"
          accent
        />
        <Stat
          label="Duration"
          value={`${durationSec.toFixed(1)}s`}
          hint="Simulated clock"
        />
      </div>

      {isPreview && (
        <Note tone="warning" title="Preview — simulation not completed">
          The charts below use the deterministic full-corpus projection computed from the selected
          dataset. Per-worker payloads stay empty until workers return results. Open the{' '}
          <Link to="/simulation" className="font-medium text-cyan-200 underline decoration-cyan-500/40">
            simulation page
          </Link>{' '}
          and run it to populate the worker-level analytics.
        </Note>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Top 10 most frequent words"
          subtitle="After stopword filtering · additive aggregate of worker Counters"
          action={<Tag tone={isPreview ? 'amber' : 'emerald'}>{isPreview ? 'Preview' : 'Simulation result'}</Tag>}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topTen} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 4 }}>
              <CartesianGrid stroke="#162a44" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: '#5f7492', fontSize: 10 }}
                axisLine={{ stroke: '#1d3350' }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="word"
                width={90}
                tick={{ fill: '#8fa3c2', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip {...TOOLTIP_PROPS} />
              <Bar dataKey="count" fill="#22d3ee" radius={[0, 4, 4, 0]} barSize={12} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel
          title="Word cloud"
          subtitle="Top terms sized by merged frequency"
          action={<Tag tone="cyan">Simulated</Tag>}
        >
          <WordCloud words={cloudWords} />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Documents processed per worker"
          subtitle="Only documents returned by each worker are counted"
          action={<Tag tone={isPreview ? 'slate' : 'emerald'}>{isPreview ? 'Awaiting run' : 'Live result'}</Tag>}
        >
          {successfulWorkers > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={docsData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#162a44" vertical={false} />
                <XAxis
                  dataKey="worker"
                  tick={{ fill: '#5f7492', fontSize: 9 }}
                  axisLine={{ stroke: '#1d3350' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#5f7492', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={34}
                />
                <Tooltip {...TOOLTIP_PROPS} />
                <Bar dataKey="docs" fill="#60a5fa" radius={[4, 4, 0, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              title="No worker payloads yet"
              hint="Run the simulation so each worker returns its document count and word Counter."
            />
          )}
        </Panel>

        <Panel
          title="Task completion distribution"
          subtitle="Completed tasks attributed to each simulated worker"
          action={<Tag tone={isPreview ? 'slate' : 'emerald'}>{isPreview ? 'Awaiting run' : 'Live result'}</Tag>}
        >
          {taskData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie
                    data={taskData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={92}
                    paddingAngle={2}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {taskData.map((entry, index) => (
                      <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...TOOLTIP_PROPS} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
                {taskData.map((entry, index) => (
                  <span key={entry.name} className="inline-flex items-center gap-1.5 text-[10px] text-muted">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: PIE_COLORS[index % PIE_COLORS.length] }}
                    />
                    {entry.name} · {entry.value}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              title="Nothing distributed yet"
              hint="Completed tasks will be grouped by worker after the simulation processes them."
            />
          )}
        </Panel>
      </div>

      <Panel
        title="Per-worker result payloads"
        subtitle="Each row shows the Counter contribution before the master merges everything"
        action={<Tag tone="cyan">Before aggregation</Tag>}
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[11px]">
            <thead>
              <tr className="border-b border-line-soft text-[9px] tracking-[0.12em] text-faint uppercase">
                <th className="px-4 py-2.5 font-medium">Worker</th>
                <th className="px-4 py-2.5 font-medium">Cores</th>
                <th className="px-4 py-2.5 font-medium">Tasks</th>
                <th className="px-4 py-2.5 font-medium">Documents</th>
                <th className="px-4 py-2.5 font-medium">Words</th>
                <th className="px-4 py-2.5 font-medium">Unique</th>
                <th className="px-4 py-2.5 font-medium">Top terms</th>
                <th className="px-4 py-2.5 font-medium">Last task</th>
              </tr>
            </thead>
            <tbody>
              {state.workers.map((worker) => {
                const terms = topWords(worker.frequencies, 3)
                return (
                  <tr
                    key={worker.id}
                    className="border-b border-line-soft/60 last:border-0 hover:bg-ink-850/40"
                  >
                    <td className="px-4 py-2 font-mono text-accent">{worker.id}</td>
                    <td className="px-4 py-2 text-muted">{worker.cores}</td>
                    <td className="px-4 py-2 text-muted tabular-nums">{worker.tasksCompleted}</td>
                    <td className="px-4 py-2 text-muted tabular-nums">
                      {formatNumber(worker.docsProcessed)}
                    </td>
                    <td className="px-4 py-2 text-muted tabular-nums">
                      {formatNumber(worker.wordsProcessed)}
                    </td>
                    <td className="px-4 py-2 text-muted tabular-nums">
                      {worker.tasksCompleted > 0 ? formatNumber(Object.keys(worker.frequencies).length) : '—'}
                    </td>
                    <td className="px-4 py-2">
                      {terms.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {terms.map((term) => (
                            <span
                              key={term.word}
                              className="rounded border border-line bg-ink-850 px-1 py-0.5 text-[9px] text-muted"
                            >
                              {term.word}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-faint">
                      {worker.lastTaskDurationSec === null ? '—' : `${worker.lastTaskDurationSec}s`}
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
        subtitle="Simulated task windows per worker · each tick is 0.7s of simulated time"
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
              <span>{((maxTick * BASE_TICK_SECONDS) / 2).toFixed(1)}s</span>
              <span>{(maxTick * BASE_TICK_SECONDS).toFixed(1)}s</span>
            </div>
          </div>
        ) : (
          <EmptyState
            title="Timeline is empty"
            hint="Simulated task windows appear after workers finish their first tasks."
          />
        )}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="How the aggregate is built" subtitle="Master–Worker merge semantics">
          <div className="space-y-2 text-[11px] leading-relaxed text-muted">
            <p>
              Each worker returns a JSON-style payload with its document count, filtered word count
              and a word frequency Counter. The master merges Counters by adding counts for the same
              term.
            </p>
            <p>
              Because every task covers a disjoint document range, the sum of worker Counters equals
              the Counter of the whole corpus. Unique words are the number of keys in the merged
              Counter, not the sum of per-worker unique counts.
            </p>
            <p className="text-faint">
              All numbers are simulation results computed deterministically from the selected
              corpus. They are not benchmarks of a real cluster.
            </p>
          </div>
        </Panel>

        <Note tone="warning" title="Result labels">
          Values on this page are labelled Simulation Result or Preview. There are no random values
          per render: resetting and running the same dataset reproduces the same aggregate, task
          counts and top keywords.
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
    </div>
  )
}
