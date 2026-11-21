export type NodeStatus =
  | 'idle'
  | 'discovering'
  | 'registered'
  | 'receiving'
  | 'processing'
  | 'merging'
  | 'returning'
  | 'completed'
  | 'failed'

export type Phase =
  | 'ready'
  | 'initialization'
  | 'discovery'
  | 'decomposition'
  | 'distribution'
  | 'processing'
  | 'aggregation'
  | 'completed'

export type Speed = 0.5 | 1 | 2 | 4
export type ScheduleMode = 'dynamic' | 'static'
export type MergeMode = 'master' | 'tiered'
export type ArrayPattern = 'random' | 'duplicates' | 'nearly-sorted'

export interface SortingDataset {
  id: string
  name: string
  shortName: string
  description: string
  source: 'synthetic' | 'preset'
  totalItems: number
  values: number[]
  pattern: ArrayPattern
  seed: number
  note: string
}

export interface HistogramBin {
  label: string
  from: number
  to: number
  count: number
}

export interface LocalRun {
  coreIndex: number
  start: number
  end: number
  itemCount: number
  progress: number
  sorted: boolean
  min: number
  max: number
  sample: number[]
}

export type TaskStatus = 'queued' | 'assigned' | 'processing' | 'returned' | 'merged'

export interface Task {
  id: string
  index: number
  startIndex: number
  endIndex: number
  itemCount: number
  status: TaskStatus
  workerId: string | null
  owner: string | null
  progress: number
  durationTicks: number
  startedTick: number | null
  finishedTick: number | null
  retries: number
  values: number[]
  localRuns: LocalRun[]
  sortedValues: number[] | null
  checksum: number
}

export interface TimelineEntry {
  taskId: string
  startTick: number
  endTick: number
}

export interface WorkerRun {
  taskId: string
  values: number[]
  checksum: number
  itemCount: number
}

export interface WorkerNode {
  id: string
  name: string
  hostname: string
  ip: string
  cores: number
  status: NodeStatus
  currentTaskId: string | null
  progress: number
  itemsProcessed: number
  tasksCompleted: number
  lastTaskDurationSec: number | null
  localMergeProgress: number
  completedRuns: WorkerRun[]
  timeline: TimelineEntry[]
  failures: number
  recoverAtTick: number | null
}

export interface MasterNode {
  id: string
  hostname: string
  ip: string
  cores: number
  status: NodeStatus
  mergeProgress: number
}

export interface MergeGroup {
  id: string
  level: number
  workerId: string | null
  inputIds: string[]
  inputSizes: number[]
  outputSize: number
  status: 'pending' | 'merged'
}

export interface MergeLayer {
  level: number
  label: string
  groups: MergeGroup[]
}

export interface SortAggregate {
  totalItems: number
  chunkCount: number
  uniqueValues: number
  min: number
  max: number
  median: number
  checksum: number
  sorted: boolean
  checksumVerified: boolean
  sortedSample: number[]
  histogram: HistogramBin[]
  mergeMode: MergeMode
  mergeGroups: MergeGroup[]
  workerRuns: number
  tieredMerges: number
  mergeDurationTicks: number
}

export interface SortBaseline {
  totalItems: number
  uniqueValues: number
  min: number
  max: number
  median: number
  checksum: number
  sortedSample: number[]
  histogram: HistogramBin[]
}

export type LogKind =
  | 'system'
  | 'discovery'
  | 'task'
  | 'sort'
  | 'result'
  | 'merge'
  | 'error'
  | 'recovery'

export interface LogEvent {
  id: number
  tick: number
  timeSec: number
  message: string
  kind: LogKind
  nodeId?: string
}

export interface SimulationSettings {
  workerCount: number
  schedule: ScheduleMode
  mergeMode: MergeMode
  chunksPerWorker: number
  faultInjection: boolean
}

export interface SimulationState {
  dataset: SortingDataset
  settings: SimulationSettings
  phase: Phase
  tick: number
  running: boolean
  speed: Speed
  master: MasterNode
  workers: WorkerNode[]
  tasks: Task[]
  queue: string[]
  events: LogEvent[]
  eventSeq: number
  aggregate: SortAggregate | null
  aggregationMerged: number
  aggregationStartedTick: number | null
  mergeGroups: MergeGroup[]
  baseline: SortBaseline
  completedTick: number | null
  faultsInjected: number
  requeued: number
  recoveredAtTick: number | null
}

export const BASE_TICK_SECONDS = 0.7
export const MIN_WORKERS = 3
export const MAX_WORKERS = 9
