import { Fragment, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, GitMerge, ListChecks, RefreshCw, Timer } from 'lucide-react'
import { useSimulation } from '../engine/SimulationProvider'
import { formatNumber, scheduleLabel } from '../lib/format'
import {
  DetailRow,
  Note,
  Panel,
  ProgressBar,
  Stat,
  Tag,
  TaskStatusBadge,
  cx,
} from '../components/ui/Primitives'
import { MiniArray } from '../components/charts/ArrayBars'
import { RunLanes } from '../components/charts/RunLanes'

export function TasksPage() {
  const { state, stats } = useSimulation()
  const [expanded, setExpanded] = useState<string | null>(null)

  const assignedPerWorker = useMemo(
    () =>
      state.workers.map((worker) => {
        const tasks = state.tasks.filter((task) => task.workerId === worker.id)
        return { worker, assigned: tasks.length }
      }),
    [state.tasks, state.workers],
  )
  const maxAssigned = Math.max(1, ...assignedPerWorker.map((entry) => entry.assigned))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Items" value={formatNumber(stats.itemsTotal)} hint="In active array" />
        <Stat label="Chunks" value={stats.tasksTotal} hint={scheduleLabel(state.settings.schedule)} />
        <Stat label="In queue" value={stats.queued} hint="Waiting for a free worker" />
        <Stat
          label="Items returned"
          value={formatNumber(stats.returnedItems)}
          hint={`${stats.returned} / ${stats.tasksTotal} chunks`}
        />
        <Stat
          label="Active workers"
          value={stats.activeWorkers}
          hint={`${stats.failures} fail · ${stats.requeued} requeued`}
          accent
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Master chunk queue"
          subtitle="Chunk yang belum dipegang worker mana pun"
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
                    title={`Items ${task.startIndex + 1}–${task.endIndex + 1}`}
                  >
                    {task.id}
                    <span className="text-faint">{formatNumber(task.itemCount)}i</span>
                  </span>
                )
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-line px-3 py-8 text-center text-[11px] text-faint">
              Queue kosong. Semua chunk sudah diambil atau selesai.
            </div>
          )}
          <div className="mt-3">
            <Note tone="neutral">
              Mode dynamic: worker menarik chunk berikutnya begitu selesai. Mode static: setiap
              worker hanya menerima chunk miliknya sejak awal. Referensi Python memakai pull dynamic
              dengan target {state.settings.chunksPerWorker} chunk per worker.
            </Note>
          </div>
        </Panel>

        <Panel
          title="Worker load"
          subtitle="Chunk yang pernah/sedang dikerjakan tiap worker"
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
                    {assigned} chunks · {formatNumber(worker.itemsProcessed)} items sorted
                  </span>
                </div>
                <ProgressBar
                  value={(assigned / maxAssigned) * 100}
                  tone={
                    worker.status === 'processing' || worker.status === 'merging'
                      ? 'cyan'
                      : worker.status === 'returning'
                        ? 'amber'
                        : worker.status === 'completed'
                          ? 'emerald'
                          : 'slate'
                  }
                  className="mt-1"
                  height="h-1"
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-start gap-2 text-[10px] leading-relaxed text-faint">
            <RefreshCw size={12} className="mt-0.5 shrink-0 text-accent" />
            Dynamic pull membuat worker cepat otomatis mengambil lebih banyak chunk. Static
            menetapkan kepemilikan di awal untuk perbandingan.
          </div>
        </Panel>
      </div>

      <Panel
        title="Chunk table"
        subtitle="Setiap baris adalah satu unit kerja hasil decomposition master"
        action={
          <Tag tone="cyan">
            <ListChecks size={10} /> {state.tasks.length} chunks
          </Tag>
        }
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-[11px]">
            <thead>
              <tr className="border-b border-line-soft text-[9px] tracking-[0.12em] text-faint uppercase">
                <th className="px-4 py-2.5 font-medium">Chunk</th>
                <th className="px-4 py-2.5 font-medium">Item range</th>
                <th className="px-4 py-2.5 font-medium">Payload</th>
                <th className="px-4 py-2.5 font-medium">Worker</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Progress</th>
                <th className="px-4 py-2.5 font-medium">Local runs</th>
                <th className="px-4 py-2.5 font-medium">Checksum</th>
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
                        {task.startIndex + 1}–{task.endIndex + 1}
                        <span className="ml-1 text-faint">({formatNumber(task.itemCount)})</span>
                      </td>
                      <td className="px-4 py-2 text-faint">
                        {formatNumber(task.itemCount)} int32 values
                      </td>
                      <td className="px-4 py-2 font-mono text-muted">{task.workerId ?? '—'}</td>
                      <td className="px-4 py-2">
                        <TaskStatusBadge status={task.status} />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <ProgressBar value={task.progress} height="h-1" className="w-24" />
                          <span className="w-8 text-[9px] text-faint tabular-nums">
                            {Math.round(task.progress)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-faint tabular-nums">
                        {task.localRuns.length > 0
                          ? `${task.localRuns.filter((run) => run.sorted).length}/${task.localRuns.length}`
                          : '—'}
                      </td>
                      <td className="px-4 py-2 font-mono text-[10px] text-muted">
                        {formatNumber(task.checksum)}
                      </td>
                      <td className="px-3 py-2 text-right text-faint">
                        {isOpen ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${task.id}-detail`} className="border-b border-line-soft/60 bg-ink-925/60">
                        <td colSpan={9} className="px-4 py-3">
                          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_0.9fr]">
                            <div>
                              <p className="mb-1.5 text-[9px] tracking-wide text-faint uppercase">
                                Payload samples
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <p className="mb-1 text-[8px] text-faint">input</p>
                                  <MiniArray values={task.values} tone="cyan" height={30} maxBars={14} />
                                </div>
                                <div>
                                  <p className="mb-1 text-[8px] text-faint">sorted</p>
                                  <MiniArray
                                    values={task.sortedValues ?? task.values}
                                    tone={task.sortedValues ? 'emerald' : 'amber'}
                                    height={30}
                                    maxBars={14}
                                  />
                                </div>
                              </div>
                              <p className="mt-2 text-[10px] leading-relaxed text-muted">
                                {formatNumber(task.itemCount)} values · checksum{' '}
                                {formatNumber(task.checksum)}. Checksum dihitung dari payload yang
                                diproses browser.
                              </p>
                            </div>

                            <div>
                              <p className="mb-1.5 flex items-center gap-1 text-[9px] tracking-wide text-faint uppercase">
                                <GitMerge size={10} /> Local core runs
                              </p>
                              <RunLanes runs={task.localRuns} compact />
                            </div>

                            <div>
                              <p className="mb-1.5 flex items-center gap-1 text-[9px] tracking-wide text-faint uppercase">
                                <Timer size={10} /> Timing & ownership
                              </p>
                              <DetailRow label="Initial owner" value={task.owner ?? 'Unassigned'} />
                              <DetailRow label="Current worker" value={task.workerId ?? '—'} />
                              <DetailRow label="Start tick" value={task.startedTick ?? '—'} />
                              <DetailRow label="Finish tick" value={task.finishedTick ?? '—'} />
                              <DetailRow label="Duration" value={`${task.durationTicks} simulated ticks`} />
                              <DetailRow
                                label="Retries"
                                value={
                                  <span className={task.retries > 0 ? 'text-amber-300' : undefined}>
                                    {task.retries}
                                  </span>
                                }
                              />
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

      <Note tone="warning" title="Scheduling semantics">
        Tabel dan animasi mengikuti state simulator deterministik. Angka item dan checksum nyata
        dihitung dari array lokal, tetapi tick, durasi, dan kegagalan worker adalah model simulasi,
        bukan pengukuran CPU atau jaringan.
      </Note>
    </div>
  )
}
