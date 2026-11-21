import { useMemo } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  getBezierPath,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Cpu, GitMerge, Server } from 'lucide-react'
import type { MasterNode, Task, WorkerNode } from '../../types'
import { useSimulation } from '../../engine/SimulationProvider'
import { formatNumber } from '../../lib/format'
import { StatusBadge, cx } from '../ui/Primitives'
import { MiniArray } from '../charts/ArrayBars'

interface WorkerData {
  worker: WorkerNode
  task?: Task
}

interface MasterData {
  master: MasterNode
  registered: number
  total: number
  queue: number
  mergeGroups: number
  mergeMode: string
}

const NODE_WIDTH = 232
const COLUMN_GAP = 270

function WorkerFlowNode({ data, selected }: NodeProps) {
  const { worker, task } = data as unknown as WorkerData
  const isReturning = worker.status === 'returning'
  const isSorting = worker.status === 'processing' || worker.status === 'receiving'
  const isMerging = worker.status === 'merging'
  const isFailed = worker.status === 'failed'

  return (
    <div
      className={cx(
        'w-[232px] rounded-lg border bg-ink-900 px-3.5 py-3 shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-colors',
        selected
          ? 'border-accent'
          : isFailed
            ? 'border-rose-500/40'
            : isSorting || isMerging
              ? 'border-cyan-500/40'
              : 'border-line',
      )}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-mist">
          <Cpu size={13} className={isFailed ? 'text-bad' : 'text-info'} />
          {worker.id}
        </div>
        <StatusBadge status={worker.status} />
      </div>
      <p className="mt-1 truncate font-mono text-[9px] text-faint">
        {worker.hostname} · {worker.ip}
      </p>
      <div className="mt-2 flex items-center justify-between text-[9px] text-muted">
        <span>{worker.cores} simulated cores</span>
        <span className="font-mono text-faint">{worker.currentTaskId ?? 'no chunk'}</span>
      </div>
      {task && (
        <div className="mt-1.5">
          <MiniArray
            values={task.values}
            tone={isReturning ? 'emerald' : isMerging ? 'violet' : 'cyan'}
            height={22}
            maxBars={16}
          />
        </div>
      )}
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink-700">
        <div
          className={cx(
            'h-full rounded-full transition-[width] duration-300',
            isFailed
              ? 'bg-bad'
              : isReturning
                ? 'bg-warn'
                : isMerging
                  ? 'bg-violet-400'
                  : isSorting
                    ? 'bg-accent'
                    : 'bg-info/70',
          )}
          style={{ width: `${worker.progress}%` }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between text-[9px] text-faint">
        <span>{formatNumber(worker.itemsProcessed)} items sorted</span>
        <span className="tabular-nums">{Math.round(worker.progress)}%</span>
      </div>
    </div>
  )
}

function MasterFlowNode({ data, selected }: NodeProps) {
  const { master, registered, total, queue, mergeGroups, mergeMode } = data as unknown as MasterData

  return (
    <div
      className={cx(
        'w-[232px] rounded-lg border bg-ink-900 px-3.5 py-3.5 shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-colors',
        selected ? 'border-accent' : master.status === 'completed' ? 'border-emerald-500/40' : 'border-master/40',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-mist">
          <Server size={13} className="text-master" />
          Master Node
        </div>
        <StatusBadge status={master.status} />
      </div>
      <p className="mt-1 truncate font-mono text-[9px] text-faint">
        {master.hostname} · {master.ip}
      </p>
      <div className="mt-2 flex items-center justify-between text-[9px] text-muted">
        <span>{master.cores} simulated cores</span>
        <span className="font-mono text-faint">{registered}/{total} nodes</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1">
        <div className="rounded border border-line-soft bg-ink-850 px-2 py-1">
          <p className="text-[8px] text-faint">queue</p>
          <p className="text-[11px] font-semibold text-mist tabular-nums">{queue} chunks</p>
        </div>
        <div className="rounded border border-line-soft bg-ink-850 px-2 py-1">
          <p className="text-[8px] text-faint">merge</p>
          <p className="text-[11px] font-semibold text-mist">{mergeMode === 'tiered' ? 'tiered' : 'master'}</p>
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[8px] text-faint">
        <span className="inline-flex items-center gap-1">
          <GitMerge size={9} className="text-violet-300" /> {mergeGroups} merge groups
        </span>
        <span>split → sort → merge</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  )
}

const nodeTypes = {
  worker: WorkerFlowNode,
  master: MasterFlowNode,
}

interface PacketEdgeData {
  active: boolean
  returning: boolean
  failed: boolean
}

function PacketEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.35,
  })
  const packet = data as unknown as PacketEdgeData | undefined
  const active = Boolean(packet?.active)
  const returning = Boolean(packet?.returning)
  const failed = Boolean(packet?.failed)
  const color = failed ? '#fb7185' : returning ? '#fbbf24' : '#22d3ee'

  return (
    <>
      <path
        id={id}
        d={path}
        fill="none"
        stroke={failed ? '#7f1d1d' : active ? color : '#2b4a6e'}
        strokeWidth={failed ? 1.4 : active ? 1.6 : 1.2}
        strokeDasharray={failed ? '3 3' : active ? '5 4' : undefined}
        className={active && !failed ? 'sim-edge-active' : undefined}
      />
      {active && !failed && (
        <circle r={3.5} fill={color} opacity={0.95}>
          <animateMotion
            dur={returning ? '1.4s' : '1s'}
            repeatCount="indefinite"
            path={path}
            keyPoints={returning ? '1;0' : '0;1'}
            keyTimes="0;1"
            calcMode="linear"
          />
        </circle>
      )}
    </>
  )
}

const edgeTypes = {
  packet: PacketEdge,
}

const MASTER_POSITION = { x: COLUMN_GAP, y: 0 }

export function NetworkGraph({
  onSelect,
  height = 640,
}: {
  onSelect: (id: string | null) => void
  height?: number
}) {
  const { state } = useSimulation()

  const nodes = useMemo<Node[]>(() => {
    const registered = state.workers.filter((worker) => worker.status !== 'idle').length
    return [
      {
        id: 'master',
        type: 'master',
        position: MASTER_POSITION,
        draggable: false,
        data: {
          master: state.master,
          registered,
          total: state.workers.length,
          queue: state.queue.length,
          mergeGroups: state.mergeGroups.length,
          mergeMode: state.settings.mergeMode,
        },
      },
      ...state.workers.map((worker, index) => ({
        id: worker.id,
        type: 'worker',
        position: {
          x: (index % 3) * COLUMN_GAP,
          y: 155 + Math.floor(index / 3) * 145,
        },
        draggable: false,
        data: {
          worker,
          task: state.tasks.find((task) => task.id === worker.currentTaskId),
        },
      })),
    ]
  }, [state])

  const edges = useMemo<Edge[]>(
    () =>
      state.workers.map((worker) => {
        const active = ['receiving', 'processing', 'merging', 'returning'].includes(worker.status)
        return {
          id: `edge-${worker.id}`,
          source: 'master',
          target: worker.id,
          type: 'packet',
          data: {
            active,
            returning: worker.status === 'returning',
            failed: worker.status === 'failed',
          },
        }
      }),
    [state.workers],
  )

  return (
    <div className="relative w-full" style={{ height }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.16, maxZoom: 1.15 }}
        minZoom={0.35}
        maxZoom={1.4}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        onNodeClick={(_, node) => onSelect(node.id)}
        onPaneClick={() => onSelect(null)}
        className="[&_.react-flow__node]:cursor-pointer"
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#132238" />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
      <div className="pointer-events-none absolute right-3 top-3 rounded-md border border-line bg-ink-950/80 px-2 py-1 text-[9px] tracking-wide text-faint">
        Simulated topology · not a real network scan
      </div>
    </div>
  )
}

export const NETWORK_NODE_WIDTH = NODE_WIDTH
