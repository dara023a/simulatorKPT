import { Link } from 'react-router-dom'
import { ArrowUpRight, GitMerge, Server } from 'lucide-react'
import { useSimulation } from '../../engine/SimulationProvider'
import { formatNumber } from '../../lib/format'
import { Note, Panel, ProgressBar, Tag } from '../ui/Primitives'
import { ArrayBars } from '../charts/ArrayBars'

export function MasterSummary() {
  const { state, stats } = useSimulation()
  const finished = state.phase === 'completed'
  const merging = state.phase === 'aggregation'
  const mergePct =
    stats.mergeGroupsTotal === 0
      ? finished
        ? 100
        : 0
      : Math.round((stats.mergeGroupsMerged / stats.mergeGroupsTotal) * 100)
  const sortedPreview = state.aggregate?.sortedSample ?? state.baseline.sortedSample

  return (
    <Panel
      title={
        <span className="flex items-center gap-1.5">
          <Server size={14} className="text-master" />
          Master Node
        </span>
      }
      subtitle="Owns the queue, dispatches chunks, and builds the merge tree"
      action={<Tag tone={finished ? 'emerald' : 'cyan'}>Simulated</Tag>}
    >
      <div className="flex items-center justify-between text-[10px] text-faint">
        <span>Items returned to master</span>
        <span className="tabular-nums">
          {formatNumber(stats.returnedItems)} / {formatNumber(stats.itemsTotal)}
        </span>
      </div>
      <ProgressBar
        value={stats.itemsTotal === 0 ? 0 : (stats.returnedItems / stats.itemsTotal) * 100}
        className="mt-1.5"
      />

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-md border border-line bg-ink-850 px-2.5 py-2">
          <p className="text-[9px] text-faint">Chunks returned</p>
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
          <p className="text-[9px] text-faint">Mode</p>
          <p className="text-[11px] font-semibold text-mist">
            {state.settings.mergeMode === 'tiered' ? 'Tiered merge' : 'Master merge'}
          </p>
        </div>
      </div>

      {(merging || finished) && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-faint">
            <span className="inline-flex items-center gap-1">
              <GitMerge size={10} className="text-violet-300" /> Merge groups
            </span>
            <span className="tabular-nums">
              {stats.mergeGroupsMerged} / {stats.mergeGroupsTotal}
            </span>
          </div>
          <ProgressBar value={mergePct} tone="emerald" className="mt-1.5" />
        </div>
      )}

      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[9px] font-semibold tracking-[0.12em] text-faint uppercase">
            Sorted output preview
          </p>
          <Tag tone={finished ? 'emerald' : 'slate'}>
            {finished ? 'verified' : 'projection'}
          </Tag>
        </div>
        <div className="rounded-md border border-line-soft bg-ink-850/60 p-1.5">
          <ArrayBars values={sortedPreview} tone={finished ? 'emerald' : 'cyan'} height={34} maxBars={54} />
        </div>
        <div className="mt-1 flex items-center justify-between text-[9px] text-faint">
          <span>{formatNumber(state.baseline.totalItems)} items</span>
          <span className="font-mono">checksum {formatNumber(state.aggregate?.checksum ?? state.baseline.checksum)}</span>
        </div>
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
            Preview memakai array terurut yang diproyeksikan dari dataset. Angka final baru
            dipublikasikan setelah merge dan verifikasi checksum selesai.
          </Note>
        </div>
      )}
    </Panel>
  )
}
