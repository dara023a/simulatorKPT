import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Radio, Wifi } from 'lucide-react'
import { NetworkGraph } from '../components/network/NetworkGraph'
import { NodeDetailPanel } from '../components/network/NodeDetailPanel'
import { useSimulation } from '../engine/SimulationProvider'
import { Note, Panel, StatusBadge, Tag } from '../components/ui/Primitives'
import type { NodeStatus } from '../types'

const LEGEND_STATUSES: NodeStatus[] = [
  'idle',
  'registered',
  'receiving',
  'processing',
  'returning',
  'completed',
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
          subtitle="Click a node to inspect simulated hostname, IP, cores, task and result payload"
          action={
            <Tag tone={state.running ? 'cyan' : 'slate'}>
              <span
                className={`h-1.5 w-1.5 rounded-full ${state.running ? 'animate-pulse bg-cyan-400' : 'bg-slate-500'}`}
              />
              {state.running ? 'Live simulation' : 'Static state'}
            </Tag>
          }
          bodyClassName="p-0"
        >
          <NetworkGraph onSelect={setSelectedId} height={660} />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft px-5 py-3">
            <div className="flex items-center gap-4 text-[10px] text-faint">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-5 rounded bg-accent" /> known link
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" /> task packet (master → worker)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-warn" /> result packet (worker → master)
              </span>
            </div>
            <span className="text-[10px] text-faint">
              {stats.workerCount} workers · {stats.queued} tasks queued
            </span>
          </div>
        </Panel>

        <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <NodeDetailPanel selectedId={selectedId} onClose={() => setSelectedId(null)} />

          <Panel title="Fleet status" subtitle="Simulated worker states right now">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-line bg-ink-850 px-2.5 py-2">
                <p className="text-[9px] text-faint">Idle / registered</p>
                <p className="text-sm font-semibold text-mist tabular-nums">
                  {(counts.idle ?? 0) + (counts.registered ?? 0)}
                </p>
              </div>
              <div className="rounded-md border border-line bg-ink-850 px-2.5 py-2">
                <p className="text-[9px] text-faint">Receiving / processing</p>
                <p className="text-sm font-semibold text-mist tabular-nums">
                  {(counts.receiving ?? 0) + (counts.processing ?? 0)}
                </p>
              </div>
              <div className="rounded-md border border-line bg-ink-850 px-2.5 py-2">
                <p className="text-[9px] text-faint">Returning result</p>
                <p className="text-sm font-semibold text-mist tabular-nums">
                  {counts.returning ?? 0}
                </p>
              </div>
              <div className="rounded-md border border-line bg-ink-850 px-2.5 py-2">
                <p className="text-[9px] text-faint">Completed</p>
                <p className="text-sm font-semibold text-mist tabular-nums">
                  {counts.completed ?? 0}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2 text-[10px] leading-relaxed text-faint">
              <Radio size={12} className="mt-0.5 shrink-0 text-accent" />
              Links represent logical TCP-style transfer to simulated workers. Node IPs
              (10.20.0.x) are fixtures, not addresses of real machines.
            </div>
          </Panel>
        </div>
      </div>

      <Note tone="warning" title="What this page is not">
        This is not a live LAN scan. The original Python worker uses a UDP discovery responder on
        port 9999 and a TCP task server on port 9998; the simulator visualises that same
        Master–Worker concept without opening sockets.
      </Note>
    </div>
  )
}
