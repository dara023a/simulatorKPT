import { Cpu, GitMerge, Server } from 'lucide-react'
import { useSimulation } from '../../engine/SimulationProvider'
import { formatNumber } from '../../lib/format'
import {
  DetailRow,
  DrawerShell,
  EmptyState,
  Note,
  ProgressBar,
  StatusBadge,
  Tag,
} from '../ui/Primitives'
import { ArrayBars, MiniArray } from '../charts/ArrayBars'
import { RunLanes } from '../charts/RunLanes'

function MasterDetails({ onClose }: { onClose?: () => void }) {
  const { state, stats } = useSimulation()
  const registered = state.workers.filter((worker) => worker.status !== 'idle').length
  const sortedPreview = state.aggregate?.sortedSample ?? state.baseline.sortedSample
  const mergePct =
    stats.mergeGroupsTotal === 0
      ? state.phase === 'completed'
        ? 100
        : 0
      : Math.round((stats.mergeGroupsMerged / stats.mergeGroupsTotal) * 100)

  return (
    <DrawerShell
      title="Master Node"
      subtitle={`${state.master.hostname} · ${state.master.ip}`}
      onClose={onClose}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <Server size={14} className="text-master" />
          Coordinator, queue owner &amp; merger
        </div>
        <StatusBadge status={state.master.status} />
      </div>

      <div>
        <DetailRow label="Node ID" value="master" />
        <DetailRow label="Simulated cores" value={state.master.cores} />
        <DetailRow label="Registered workers" value={`${registered} / ${state.workers.length}`} />
        <DetailRow label="Chunks returned" value={`${stats.returned} / ${stats.tasksTotal}`} />
        <DetailRow label="Task queue" value={`${state.queue.length} waiting`} />
        <DetailRow label="Schedule" value={state.settings.schedule} />
        <DetailRow label="Merge mode" value={state.settings.mergeMode} />
        <DetailRow label="Merge groups" value={`${stats.mergeGroupsMerged} / ${stats.mergeGroupsTotal}`} />
        <DetailRow label="Simulated tick" value={state.tick} />
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] text-faint">
          <span className="inline-flex items-center gap-1">
            <GitMerge size={10} className="text-violet-300" /> Merge progress
          </span>
          <span className="tabular-nums">{mergePct}%</span>
        </div>
        <ProgressBar value={mergePct} tone="emerald" className="mt-1.5" />
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[10px] font-semibold tracking-[0.12em] text-faint uppercase">
            Sorted output
          </p>
          <Tag tone={state.aggregate?.checksumVerified ? 'emerald' : 'slate'}>
            {state.aggregate?.checksumVerified ? 'checksum verified' : 'projection'}
          </Tag>
        </div>
        <div className="rounded-md border border-line-soft bg-ink-850/60 p-1.5">
          <ArrayBars values={sortedPreview} tone="emerald" height={42} maxBars={48} />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[9px] text-faint">
          <span>{formatNumber(state.baseline.totalItems)} items</span>
          <span>checksum {formatNumber(state.aggregate?.checksum ?? state.baseline.checksum)}</span>
        </div>
      </div>

      <div className="mt-4">
        <Note tone="neutral">
          IP, cores, dan timing adalah fixture simulasi. Merge tree dan checksum dihitung dari
          array yang benar-benar diproses di browser; bukan benchmark cluster.
        </Note>
      </div>
    </DrawerShell>
  )
}

export function NodeDetailPanel({
  selectedId,
  onClose,
}: {
  selectedId: string | null
  onClose?: () => void
}) {
  const { state } = useSimulation()

  if (!selectedId) {
    return (
      <DrawerShell title="Node Inspector" subtitle="Select a node on the graph">
        <EmptyState
          title="No node selected"
          hint="Klik master atau worker untuk melihat status, chunk, local runs, progress, dan checksum."
        />
        <div className="mt-4">
          <Note tone="neutral">
            Node worker adalah simulasi. Tidak ada koneksi TCP/UDP nyata yang dibuka oleh halaman
            ini; port 9999/9998 hanya direpresentasikan secara visual.
          </Note>
        </div>
      </DrawerShell>
    )
  }

  if (selectedId === 'master') {
    return <MasterDetails onClose={onClose} />
  }

  const worker = state.workers.find((candidate) => candidate.id === selectedId)
  if (!worker) {
    return (
      <DrawerShell title="Unknown node" onClose={onClose}>
        <EmptyState title="Node not found" hint="The selected node is not part of this simulation." />
      </DrawerShell>
    )
  }

  const task = state.tasks.find((candidate) => candidate.id === worker.currentTaskId)
  const lastRun = worker.completedRuns[worker.completedRuns.length - 1]

  return (
    <DrawerShell
      title={`${worker.name} · ${worker.id}`}
      subtitle={`${worker.hostname} · ${worker.ip}`}
      onClose={onClose}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <Cpu size={14} className="text-info" />
          Worker node
        </div>
        <StatusBadge status={worker.status} />
      </div>

      <div>
        <DetailRow label="Node ID" value={worker.id} />
        <DetailRow label="Simulated cores" value={worker.cores} />
        <DetailRow label="Current chunk" value={worker.currentTaskId ?? 'None'} />
        <DetailRow
          label="Chunk progress"
          value={
            <span className="inline-flex w-32 items-center justify-end gap-2">
              <ProgressBar value={worker.progress} height="h-1" />
              <span className="w-8 tabular-nums">{Math.round(worker.progress)}%</span>
            </span>
          }
        />
        <DetailRow label="Items sorted" value={formatNumber(worker.itemsProcessed)} />
        <DetailRow label="Chunks completed" value={worker.tasksCompleted} />
        <DetailRow
          label="Last chunk time"
          value={worker.lastTaskDurationSec === null ? '—' : `${worker.lastTaskDurationSec}s (simulated)`}
        />
        <DetailRow label="Failures" value={worker.failures} />
        {worker.recoverAtTick !== null && (
          <DetailRow label="Rejoin at tick" value={worker.recoverAtTick} />
        )}
      </div>

      {task && (
        <div className="mt-3 rounded-md border border-line bg-ink-850 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] text-accent">{task.id}</p>
            <Tag tone={task.status === 'returned' ? 'emerald' : 'cyan'}>{task.status}</Tag>
          </div>
          <p className="mt-1 text-[11px] text-muted">
            Items {task.startIndex + 1}–{task.endIndex + 1} · {formatNumber(task.itemCount)} values ·
            checksum {formatNumber(task.checksum)}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <p className="mb-1 text-[8px] tracking-wide text-faint uppercase">Input sample</p>
              <MiniArray values={task.values} tone="cyan" height={26} maxBars={16} />
            </div>
            <div>
              <p className="mb-1 text-[8px] tracking-wide text-faint uppercase">Sorted sample</p>
              <MiniArray
                values={task.sortedValues ?? task.values}
                tone={task.sortedValues ? 'emerald' : 'amber'}
                height={26}
                maxBars={16}
              />
            </div>
          </div>
        </div>
      )}

      <div className="mt-4">
        <p className="mb-2 text-[10px] font-semibold tracking-[0.12em] text-faint uppercase">
          Parallel local runs
        </p>
        <RunLanes runs={task?.localRuns ?? []} compact />
      </div>

      <div className="mt-4">
        <p className="mb-2 text-[10px] font-semibold tracking-[0.12em] text-faint uppercase">
          Last returned run
        </p>
        {lastRun ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              <Tag tone="emerald">{lastRun.taskId}</Tag>
              <Tag tone="slate">{formatNumber(lastRun.itemCount)} items</Tag>
              <Tag tone="cyan">checksum {formatNumber(lastRun.checksum)}</Tag>
            </div>
            <div className="mt-2">
              <MiniArray values={lastRun.values} tone="emerald" height={34} maxBars={32} />
            </div>
          </>
        ) : (
          <EmptyState
            title="No returned run yet"
            hint="Sorted run muncul setelah worker menyelesaikan local sort dan merge."
          />
        )}
      </div>

      <div className="mt-4">
        <Note tone="neutral">
          Worker ini adalah visualisasi proses Python worker. Local runs merepresentasikan
          pembagian kerja per core; hasil dan checksum dihitung deterministik di browser.
        </Note>
      </div>
    </DrawerShell>
  )
}
