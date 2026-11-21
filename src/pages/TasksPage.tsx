import { Fragment, useState } from 'react'
import { ArrowDown, ArrowUp, Layers, ListChecks, Radio } from 'lucide-react'
import { useSimulation } from '../engine/SimulationProvider'
import { formatNumber } from '../lib/format'
import {
  Note,
  Panel,
  ProgressBar,
  Stat,
  Tag,
  TaskStatusBadge,
  cx,
} from '../components/ui/Primitives'

export function TasksPage() {
  const { state, stats } = useSimulation()
  const [expanded, setExpanded] = useState<string | null>(null)

  const assignedPerWorker = state.workers.map((worker) => {
    const tasks = state.tasks.filter((task) => task.workerId === worker.id)
    return { worker, tasks, assigned: tasks.length }
  })
  const maxAssigned = Math.max(1, ...assignedPerWorker.map((entry) => entry.assigned))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Documents" value={formatNumber(stats.docsTotal)} hint="In selected dataset" />
        <Stat label="Tasks" value={stats.tasksTotal} hint={`${state.dataset.taskSize} docs / task`} />
        <Stat label="In queue" value={stats.queued} hint="Waiting for a free worker" />
        <Stat label="Returned docs" value={formatNumber(stats.returnedDocs)} hint="Simulated results" />
        <Stat label="Active workers" value={stats.activeWorkers} hint={`of ${stats.workerCount}`} accent />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Master task queue"
          subtitle="Queued chunks not yet assigned to any worker"
          action={<Tag tone="cyan">{state.queue.length} waiting</Tag>}
        >
          {state.queue.length > 0 ? (
            <div className="flex max-h-56 flex-wrap gap-1.5 overflow-y-auto pr-1">
              {state.queue.map((taskId) => {
                const task = state.tasks.find((candidate) => candidate.id === taskId)
                if (!task) return null
                return (
                  <span
                    key={taskId}
                    className="inline-flex items-center gap-1.5 rounded-md border border-line bg-ink-850 px-2 py-1 font-mono text-[10px] text-muted"
                    title={`Documents ${task.startDoc + 1}–${task.endDoc + 1}`}
                  >
                    {task.id}
                    <span className="text-faint">{task.docCount}d</span>
                  </span>
                )
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-line px-3 py-8 text-center text-[11px] text-faint">
              Queue is empty. Every task has been assigned or completed.
            </div>
          )}
          <div className="mt-3">
            <Note tone="neutral">
              The simulator keeps a queue and refills free workers. The reference Python code
              allocates work proportionally to CPU cores up front; this dynamic refill is a
              simulator enhancement and is labelled as such.
            </Note>
          </div>
        </Panel>

        <Panel
          title="Worker load"
          subtitle="Tasks assigned per simulated worker and current utilisation"
          action={<Tag tone="emerald">Simulated</Tag>}
        >
          <div className="space-y-2">
            {assignedPerWorker.map(({ worker, assigned }) => (
              <div key={worker.id}>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-mono text-muted">
                    {worker.id} · {worker.cores} cores
                  </span>
                  <span className="text-faint tabular-nums">
                    {assigned} tasks · {formatNumber(worker.docsProcessed)} docs done
                  </span>
                </div>
                <ProgressBar
                  value={(assigned / maxAssigned) * 100}
                  tone={worker.status === 'processing' ? 'cyan' : worker.status === 'completed' ? 'emerald' : 'slate'}
                  className="mt-1"
                  height="h-1"
                />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        title="Task table"
        subtitle="Each row is one unit of work created by the master during decomposition"
        action={
          <Tag tone="cyan">
            <ListChecks size={10} /> {state.tasks.length} tasks
          </Tag>
        }
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-[11px]">
            <thead>
              <tr className="border-b border-line-soft text-[9px] tracking-[0.12em] text-faint uppercase">
                <th className="px-4 py-2.5 font-medium">Task</th>
                <th className="px-4 py-2.5 font-medium">Document range</th>
                <th className="px-4 py-2.5 font-medium">Payload</th>
                <th className="px-4 py-2.5 font-medium">Worker</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Progress</th>
                <th className="px-4 py-2.5 font-medium">Top terms</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {state.tasks.map((task) => {
                const isOpen = expanded === task.id
                return (
                  <Fragment key={task.id}>
                    <tr
                      onClick={() => setExpanded(isOpen ? null : task.id)}
                      className={cx(
                        'cursor-pointer border-b border-line-soft/60 transition hover:bg-ink-850/50',
                        isOpen && 'bg-ink-850/40',
                      )}
                    >
                      <td className="px-4 py-2 font-mono text-accent">{task.id}</td>
                      <td className="px-4 py-2 text-muted">
                        {task.startDoc + 1}–{task.endDoc + 1}
                        <span className="ml-1 text-faint">({task.docCount} docs)</span>
                      </td>
                      <td className="px-4 py-2 text-faint">
                        {formatNumber(task.analysis.wordCount)} words ·{' '}
                        {formatNumber(task.analysis.uniqueWords)} unique
                      </td>
                      <td className="px-4 py-2 font-mono text-muted">{task.workerId ?? '—'}</td>
                      <td className="px-4 py-2">
                        <TaskStatusBadge status={task.status} />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <ProgressBar value={task.progress} height="h-1" className="w-24" />
                          <span className="w-8 text-[9px] text-faint tabular-nums">
                            {task.progress}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1">
                          {task.analysis.topWords.slice(0, 3).map((word) => (
                            <span
                              key={word.word}
                              className="rounded border border-line bg-ink-850 px-1 py-0.5 text-[9px] text-muted"
                            >
                              {word.word}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-faint">
                        {isOpen ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${task.id}-detail`} className="border-b border-line-soft/60 bg-ink-925/60">
                        <td colSpan={8} className="px-4 py-3">
                          <div className="grid gap-3 md:grid-cols-3">
                            <div>
                              <p className="mb-1 flex items-center gap-1 text-[9px] tracking-wide text-faint uppercase">
                                <Layers size={10} /> Task analysis
                              </p>
                              <p className="text-[10px] leading-relaxed text-muted">
                                {formatNumber(task.analysis.wordCount)} filtered words,{' '}
                                {formatNumber(task.analysis.uniqueWords)} unique terms,{' '}
                                {task.docCount} documents.
                              </p>
                            </div>
                            <div>
                              <p className="mb-1 flex items-center gap-1 text-[9px] tracking-wide text-faint uppercase">
                                <Radio size={10} /> Simulated timing
                              </p>
                              <p className="text-[10px] leading-relaxed text-muted">
                                Start tick {task.startedTick ?? '—'} · finish tick{' '}
                                {task.finishedTick ?? '—'} · duration estimate{' '}
                                {task.durationTicks || '—'} ticks for the assigned worker cores.
                              </p>
                            </div>
                            <div>
                              <p className="mb-1 text-[9px] tracking-wide text-faint uppercase">
                                Top terms
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {task.analysis.topWords.slice(0, 6).map((word) => (
                                  <Tag key={word.word}>
                                    {word.word}
                                    <span className="text-faint">{word.count}</span>
                                  </Tag>
                                ))}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
