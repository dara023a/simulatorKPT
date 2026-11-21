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
import { Cpu, Server } from 'lucide-react'
import type { MasterNode, NodeStatus, Phase, WorkerNode } from '../../types'
import { useSimulation } from '../../engine/SimulationProvider'
import { StatusBadge, cx } from '../ui/Primitives'

interface WorkerData {
  worker: WorkerNode
}

interface MasterData {
  master: MasterNode
  phase: Phase
  registered: number
  total: number
}

const NODE_WIDTH = 232

function WorkerFlowNode({ data, selected }: NodeProps) {
  const { worker } = data as unknown as WorkerData
  const isReturning = worker.status === 'returning'
  const isProcessing = worker.status === 'processing' || worker.status === 'receiving'

  return (
    <div
      className={cx(
        'w-[232px] rounded-lg border bg-ink-900 px-3.5 py-3 shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-colors',
        selected ? 'border-accent' : isProcessing ? 'border-cyan-500/40' : 'border-line',
      )}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-mist">
          <Cpu size={13} className="text-info" />
          {worker.id}
        </div>
        <StatusBadge status={worker.status} />
      </div>
      <p className="mt-1 truncate font-mono text-[9px] text-faint">
        {worker.hostname} · {worker.ip}
      </p>
      <div className="mt-2 flex items-center justify-between text-[9px] text-muted">
        <span>{worker.cores} simulated cores</span>
        <span className="font-mono text-faint">{worker.currentTaskId ?? 'no task'}</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink-700">
        <div
          className={cx(
            'h-full rounded-full transition-[width] duration-300',
            isReturning ? 'bg-warn' : isProcessing ? 'bg-accent' : 'bg-info/70',
          )}
          style={{ width: `${worker.progress}%` }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between text-[9px] text-faint">
        <span>{worker.docsProcessed} docs done</span>
        <span className="tabular-nums">{Math.round(worker.progress)}%</span>
      </div>
    </div>
  )
}

function MasterFlowNode({ data, selected }: NodeProps) {
  const { master, phase, registered, total } = data as unknown as MasterData
  const status: NodeStatus =
    phase === 'completed'
      ? 'completed'
      : phase === 'discovery'
        ? 'discovering'
        : phase === 'ready' || phase === 'initialization'
          ? 'idle'
          : 'processing'

  return (
    <div
      className={cx(
        'w-[232px] rounded-lg border bg-ink-900 px-3.5 py-3.5 shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-colors',
        selected ? 'border-accent' : phase === 'completed' ? 'border-emerald-500/40' : 'border-master/40',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-mist">
          <Server size={13} className="text-master" />
          Master Node
        </div>
        <StatusBadge status={status} />
      </div>
      <p className="mt-1 truncate font-mono text-[9px] text-faint">
        {master.hostname} · {master.ip}
      </p>
      <div className="mt-2 flex items-center justify-between text-[9px] text-muted">
        <span>{master.cores} simulated cores</span>
        <span className="font-mono text-faint">{registered}/{total} nodes</span>
      </div>
      <div className="mt-2 rounded border border-line-soft bg-ink-850 px-2 py-1 text-[9px] text-faint">
        Task queue owner · result aggregator
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
  const color = returning ? '#fbbf24' : '#22d3ee'

  return (
    <>
      <path
        id={id}
        d={path}
        fill="none"
        stroke={active ? color : '#1b2f4a'}
        strokeWidth={active ? 1.6 : 1}
        strokeDasharray={active ? '5 4' : undefined}
        className={active ? 'sim-edge-active' : undefined}
      />
      {active && (
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

const MASTER_POSITION = { x: 270, y: 0 }

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
          phase: state.phase,
          registered,
          total: state.workers.length,
        },
      },
      ...state.workers.map((worker, index) => ({
        id: worker.id,
        type: 'worker',
        position: { x: (index % 3) * 270, y: 150 + Math.floor(index / 3) * 140 },
        draggable: false,
        data: { worker },
      })),
    ]
  }, [state])

  const edges = useMemo<Edge[]>(
    () =>
      state.workers.map((worker) => {
        const active = ['receiving', 'processing', 'returning'].includes(worker.status)
        return {
          id: `edge-${worker.id}`,
          source: 'master',
          target: worker.id,
          type: 'packet',
          data: { active, returning: worker.status === 'returning' },
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
        fitViewOptions={{ padding: 0.16 }}
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
