export type NodeStatus =
  | 'idle'
  | 'discovering'
  | 'registered'
  | 'receiving'
  | 'processing'
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

export interface WordCount {
  word: string
  count: number
}

export interface TextDoc {
  id: string
  title: string
  category: string
  text: string
}

export interface Dataset {
  id: string
  name: string
  shortName: string
  description: string
  source: 'demo' | 'sample' | 'upload'
  categories: string[]
  docs: TextDoc[]
  taskSize: number
  note: string
}

export interface TaskAnalysis {
  wordCount: number
  uniqueWords: number
  frequencies: Record<string, number>
  topWords: WordCount[]
}

export type TaskStatus = 'queued' | 'assigned' | 'processing' | 'returned' | 'aggregated'

export interface Task {
  id: string
  index: number
  startDoc: number
  endDoc: number
  docCount: number
  status: TaskStatus
  workerId: string | null
  progress: number
  durationTicks: number
  startedTick: number | null
  finishedTick: number | null
  analysis: TaskAnalysis
}

export interface TimelineEntry {
  taskId: string
  startTick: number
  endTick: number
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
  docsProcessed: number
  wordsProcessed: number
  tasksCompleted: number
  lastTaskDurationSec: number | null
  frequencies: Record<string, number>
  timeline: TimelineEntry[]
}

export interface MasterNode {
  id: string
  hostname: string
  ip: string
  cores: number
  status: NodeStatus
}

export type LogKind = 'system' | 'discovery' | 'task' | 'result' | 'error'

export interface LogEvent {
  id: number
  tick: number
  timeSec: number
  message: string
  kind: LogKind
  nodeId?: string
}

export interface AggregateResult {
  totalDocs: number
  totalWords: number
  uniqueWords: number
  frequencies: Record<string, number>
  topWords: WordCount[]
}

export interface SimulationState {
  dataset: Dataset
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
  masterFrequencies: Record<string, number>
  aggregate: AggregateResult | null
  aggregationMerged: number
  baseline: AggregateResult
  completedTick: number | null
}

export const BASE_TICK_SECONDS = 0.7
