import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, GitMerge, Network, Radio, Wifi } from 'lucide-react'
import { NetworkGraph } from '../components/network/NetworkGraph'
import { NodeDetailPanel } from '../components/network/NodeDetailPanel'
import { useSimulation } from '../engine/SimulationProvider'
import { mergeLabel, scheduleLabel } from '../lib/format'
import { Note, Panel, StatusBadge, Tag } from '../components/ui/Primitives'
import type { NodeStatus } from '../types'

const LEGEND_STATUSES: NodeStatus[] = [
  'idle',
  'registered',
  'receiving',
  'processing',
  'merging',
  'returning',
  'completed',
  'failed',
]

export function TopologyPage() {
  const { state, stats } = useSimulation()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const counts = state.workers.reduce<Record<string, number>>((accumulator, worker) => {
    accumulator[worker.status] = (accumulator[worker.status] ?? 0) + 1
    return accumulator
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {LEGEND_STATUSES.map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Tag tone="cyan">
            <Wifi size={10} /> simulated network
          </Tag>
          <Link
            to="/simulation"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-850 px-3 py-1.5 text-[11px] font-medium text-muted transition hover:bg-ink-800 hover:text-mist"
          >
            Open simulation
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel
          title="Master–Worker topology"
          subtitle="Klik node untuk melihat hostname, IP, core, chunk, local runs, dan checksum"
          action={
            <Tag tone={state.running ? 'cyan' : 'slate'}>
              <span
                className={`h-1.5 w-1.5 rounded-full ${state.running ? 'animate-pulse bg-cyan-400' : 'bg-slate-500'}`}
              />
              {state.running ? 'Simulation running' : 'Static state'}
            </Tag>
          }
          bodyClassName="p-0"
        >
          <NetworkGraph onSelect={setSelectedId} height={660} />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft px-5 py-3">
            <div className="flex flex-wrap items-center gap-4 text-[10px] text-faint">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-5 rounded bg-info" /> known link
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" /> chunk packet (master → worker)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-warn" /> sorted run (worker → master)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-5 rounded border-t border-dashed border-rose-400" /> heartbeat lost
              </span>
            </div>
            <span className="text-[10px] text-faint">
              {stats.workerCount} workers · {state.queue.length} chunks queued
            </span>
          </div>
        </Panel>

        <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <NodeDetailPanel selectedId={selectedId} onClose={() => setSelectedId(null)} />

          <Panel title="Fleet status" subtitle="Keadaan worker simulasi saat ini">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-line bg-ink-850 px-2.5 py-2">
                <p className="text-[9px] text-faint">Idle / registered</p>
                <p className="text-sm font-semibold text-mist tabular-nums">
                  {(counts.idle ?? 0) + (counts.registered ?? 0)}
                </p>
              </div>
              <div className="rounded-md border border-line bg-ink-850 px-2.5 py-2">
                <p className="text-[9px] text-faint">Sorting / merging</p>
                <p className="text-sm font-semibold text-mist tabular-nums">
                  {(counts.receiving ?? 0) + (counts.processing ?? 0) + (counts.merging ?? 0)}
                </p>
              </div>
              <div className="rounded-md border border-line bg-ink-850 px-2.5 py-2">
                <p className="text-[9px] text-faint">Returning run</p>
                <p className="text-sm font-semibold text-mist tabular-nums">
                  {counts.returning ?? 0}
                </p>
              </div>
              <div className="rounded-md border border-line bg-ink-850 px-2.5 py-2">
                <p className="text-[9px] text-faint">Completed / failed</p>
                <p className="text-sm font-semibold text-mist tabular-nums">
                  {counts.completed ?? 0}
                  {counts.failed > 0 && <span className="ml-1 text-rose-300">/ {counts.failed}</span>}
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-1.5 rounded-md border border-line-soft bg-ink-850/60 px-2.5 py-2 text-[10px] text-muted">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1">
                  <Network size={10} className="text-accent" /> Schedule
                </span>
                <span className="text-mist">{scheduleLabel(state.settings.schedule)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1">
                  <GitMerge size={10} className="text-violet-300" /> Merge
                </span>
                <span className="text-mist">{mergeLabel(state.settings.mergeMode)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Items sorted</span>
                <span className="tabular-nums text-mist">
                  {stats.returnedItems.toLocaleString('en-US')} / {stats.itemsTotal.toLocaleString('en-US')}
                </span>
              </div>
            </div>

            <div className="mt-3 flex items-start gap-2 text-[10px] leading-relaxed text-faint">
              <Radio size={12} className="mt-0.5 shrink-0 text-accent" />
              Link merepresentasikan transfer TCP-style ke worker simulasi. IP 10.20.0.x adalah
              fixture, bukan alamat perangkat nyata.
            </div>
          </Panel>
        </div>
      </div>

      <Note tone="warning" title="What this page is not">
        Ini bukan pemindaian LAN. Referensi Python di folder <span className="font-mono text-amber-100">python/</span>{' '}
        memakai UDP discovery dan TCP task transfer; halaman ini hanya memvisualisasikan konsep
        Master–Worker yang sama tanpa membuka socket.
      </Note>
    </div>
  )
}
