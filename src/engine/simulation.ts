import {
  BASE_TICK_SECONDS,
  MAX_WORKERS,
  MIN_WORKERS,
  type LocalRun,
  type LogEvent,
  type MergeGroup,
  type NodeStatus,
  type SimulationSettings,
  type SimulationState,
  type SortAggregate,
  type Speed,
  type Task,
  type TaskStatus,
  type WorkerNode,
} from '../types'
import {
  buildBaseline,
  buildHistogram,
  buildLocalRuns,
  buildMergeGroups,
  checksum,
  completeLocalRuns,
  isSorted,
  localRunProgress,
  medianSorted,
  mergeLocalRuns,
  mergeManySorted,
  sampleValues,
  sortNumeric,
  splitValues,
  taskDurationTicks,
} from './sorting'

const MAX_EVENTS = 320
const MERGE_BATCH = 4
const FAILURE_AFTER_TICK = 10
const FAILURE_RECOVERY_TICKS = 4

export const DEFAULT_SETTINGS: SimulationSettings = {
  workerCount: 9,
  schedule: 'dynamic',
  mergeMode: 'master',
  chunksPerWorker: 4,
  faultInjection: false,
}

interface WorkerSpec {
  id: string
  name: string
  hostname: string
  ip: string
  cores: number
}

export const WORKER_SPECS: WorkerSpec[] = [
  { id: 'w-01', name: 'Worker 01', hostname: 'worker-01.sim.local', ip: '10.20.0.11', cores: 4 },
  { id: 'w-02', name: 'Worker 02', hostname: 'worker-02.sim.local', ip: '10.20.0.12', cores: 8 },
  { id: 'w-03', name: 'Worker 03', hostname: 'worker-03.sim.local', ip: '10.20.0.13', cores: 2 },
  { id: 'w-04', name: 'Worker 04', hostname: 'worker-04.sim.local', ip: '10.20.0.14', cores: 6 },
  { id: 'w-05', name: 'Worker 05', hostname: 'worker-05.sim.local', ip: '10.20.0.15', cores: 4 },
  { id: 'w-06', name: 'Worker 06', hostname: 'worker-06.sim.local', ip: '10.20.0.16', cores: 8 },
  { id: 'w-07', name: 'Worker 07', hostname: 'worker-07.sim.local', ip: '10.20.0.17', cores: 2 },
  { id: 'w-08', name: 'Worker 08', hostname: 'worker-08.sim.local', ip: '10.20.0.18', cores: 4 },
  { id: 'w-09', name: 'Worker 09', hostname: 'worker-09.sim.local', ip: '10.20.0.19', cores: 6 },
]

export const WORKER_COUNT = WORKER_SPECS.length

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)))
}

export function normalizeSettings(settings: SimulationSettings): SimulationSettings {
  return {
    ...settings,
    workerCount: clamp(settings.workerCount, MIN_WORKERS, MAX_WORKERS),
    chunksPerWorker: clamp(settings.chunksPerWorker, 1, 4),
  }
}

export function createWorkers(count = WORKER_COUNT): WorkerNode[] {
  return WORKER_SPECS.slice(0, clamp(count, MIN_WORKERS, MAX_WORKERS)).map((spec) => ({
    ...spec,
    status: 'idle',
    currentTaskId: null,
    progress: 0,
    itemsProcessed: 0,
    tasksCompleted: 0,
    lastTaskDurationSec: null,
    localMergeProgress: 0,
    completedRuns: [],
    timeline: [],
    failures: 0,
    recoverAtTick: null,
  }))
}

function staticChunks(values: number[], workers: WorkerNode[]): Array<{ values: number[]; owner: string }> {
  const totalCores = workers.reduce((sum, worker) => sum + worker.cores, 0)
  const chunks: Array<{ values: number[]; owner: string }> = []
  let start = 0

  workers.forEach((worker, index) => {
    const workersLeft = workers.length - index
    if (workersLeft === 1) {
      chunks.push({ values: values.slice(start), owner: worker.id })
      start = values.length
      return
    }
    const remaining = values.length - start
    const proportional = Math.round((values.length * worker.cores) / totalCores)
    const take = Math.max(1, Math.min(remaining - (workersLeft - 1), proportional))
    chunks.push({ values: values.slice(start, start + take), owner: worker.id })
    start += take
  })

  return chunks
}

function createTasks(datasetValues: number[], workers: WorkerNode[], settings: SimulationSettings): Task[] {
  const chunks =
    settings.schedule === 'static'
      ? staticChunks(datasetValues, workers)
      : splitValues(datasetValues, workers.length * settings.chunksPerWorker).map((values) => ({
          values,
          owner: null,
        }))

  let cursor = 0
  return chunks.map((chunk, index) => {
    const startIndex = cursor
    cursor += chunk.values.length
    return {
      id: `${settings.schedule === 'static' ? 'S' : 'T'}-${String(index + 1).padStart(3, '0')}`,
      index,
      startIndex,
      endIndex: startIndex + chunk.values.length - 1,
      itemCount: chunk.values.length,
      status: 'queued',
      workerId: null,
      owner: chunk.owner,
      progress: 0,
      durationTicks: 0,
      startedTick: null,
      finishedTick: null,
      retries: 0,
      values: chunk.values,
      localRuns: [],
      sortedValues: null,
      checksum: checksum(chunk.values),
    }
  })
}

function cloneDataset(dataset: SimulationState['dataset']): SimulationState['dataset'] {
  return { ...dataset, values: [...dataset.values] }
}

export function createInitialState(
  dataset: SimulationState['dataset'],
  settings: SimulationSettings = DEFAULT_SETTINGS,
  speed: Speed = 1,
): SimulationState {
  const effective = normalizeSettings(settings)
  const workers = createWorkers(effective.workerCount)
  const localDataset = cloneDataset(dataset)
  const tasks = createTasks(localDataset.values, workers, effective)
  const baseline = buildBaseline(localDataset.values)

  return {
    dataset: localDataset,
    settings: effective,
    phase: 'ready',
    tick: 0,
    running: false,
    speed,
    master: {
      id: 'master',
      hostname: 'master.sim.local',
      ip: '10.20.0.1',
      cores: 8,
      status: 'idle',
      mergeProgress: 0,
    },
    workers,
    tasks,
    queue: tasks.map((task) => task.id),
    events: [
      {
        id: 1,
        tick: 0,
        timeSec: 0,
        message: `Simulation ready. ${localDataset.totalItems.toLocaleString('en-US')} items will be split into ${tasks.length} chunks across ${workers.length} workers.`,
        kind: 'system',
      },
    ],
    eventSeq: 2,
    aggregate: null,
    aggregationMerged: 0,
    aggregationStartedTick: null,
    mergeGroups: [],
    baseline,
    completedTick: null,
    faultsInjected: 0,
    requeued: 0,
    recoveredAtTick: null,
  }
}

function log(state: SimulationState, message: string, kind: LogEvent['kind'], nodeId?: string): void {
  const event: LogEvent = {
    id: state.eventSeq,
    tick: state.tick,
    timeSec: Number((state.tick * BASE_TICK_SECONDS).toFixed(1)),
    message,
    kind,
    nodeId,
  }
  state.eventSeq += 1
  state.events = [...state.events, event].slice(-MAX_EVENTS)
}

function findTask(state: SimulationState, taskId: string | null): Task | undefined {
  if (!taskId) return undefined
  return state.tasks.find((task) => task.id === taskId)
}

function workerReady(state: SimulationState, worker: WorkerNode): boolean {
  if (worker.status === 'idle' || worker.status === 'registered') return true
  if (worker.status !== 'completed') return false
  const lastEndTick = worker.timeline[worker.timeline.length - 1]?.endTick
  return lastEndTick === undefined || lastEndTick < state.tick - 1
}

function assignQueuedTasks(state: SimulationState): number {
  let assigned = 0

  for (const worker of state.workers) {
    if (!workerReady(state, worker)) continue
    const queueIndex = state.queue.findIndex((taskId) => {
      const task = state.tasks.find((candidate) => candidate.id === taskId)
      if (!task) return false
      return state.settings.schedule === 'dynamic' || task.owner === null || task.owner === worker.id
    })
    if (queueIndex < 0) continue

    const [taskId] = state.queue.splice(queueIndex, 1)
    const task = state.tasks.find((candidate) => candidate.id === taskId)
    if (!task) continue

    task.status = 'assigned'
    task.workerId = worker.id
    task.progress = 0
    task.startedTick = null
    task.finishedTick = null
    task.sortedValues = null
    task.durationTicks = taskDurationTicks(task.itemCount, worker.cores)
    task.localRuns = buildLocalRuns(task.values, worker.cores)

    worker.currentTaskId = task.id
    worker.progress = 0
    worker.localMergeProgress = 0
    worker.status = 'receiving'

    log(
      state,
      `[DISPATCH] ${task.id} -> ${worker.id} · ${task.itemCount.toLocaleString('en-US')} items across ${task.localRuns.length} simulated cores (attempt ${task.retries + 1}).`,
      'task',
      worker.id,
    )
    assigned += 1
  }

  return assigned
}

function completeTask(state: SimulationState, worker: WorkerNode, task: Task): void {
  const sortedValues = mergeLocalRuns(task.values, task.localRuns)
  task.sortedValues = sortedValues
  task.status = 'returned'
  task.progress = 100
  task.finishedTick = state.tick

  const startedTick = task.startedTick ?? state.tick
  worker.status = 'returning'
  worker.progress = 100
  worker.localMergeProgress = 100
  worker.itemsProcessed += task.itemCount
  worker.tasksCompleted += 1
  worker.lastTaskDurationSec = Number(((state.tick - startedTick) * BASE_TICK_SECONDS).toFixed(1))
  worker.completedRuns.push({
    taskId: task.id,
    values: sortedValues,
    checksum: checksum(sortedValues),
    itemCount: sortedValues.length,
  })
  worker.timeline.push({ taskId: task.id, startTick: startedTick, endTick: state.tick })

  log(
    state,
    `[RETURN] ${worker.id} finished ${task.id} · ${task.itemCount.toLocaleString('en-US')} sorted items · checksum ${task.checksum.toLocaleString('en-US')}.`,
    'result',
    worker.id,
  )
}

function injectFailure(state: SimulationState): void {
  if (!state.settings.faultInjection || state.faultsInjected > 0) return
  if (state.tick < FAILURE_AFTER_TICK) return

  const victim = state.workers.find(
    (worker) => worker.status === 'processing' && worker.progress >= 25 && worker.currentTaskId,
  )
  if (!victim) return

  const task = findTask(state, victim.currentTaskId)
  if (!task) return

  victim.status = 'failed'
  victim.recoverAtTick = state.tick + FAILURE_RECOVERY_TICKS
  victim.currentTaskId = null
  victim.progress = 0
  victim.localMergeProgress = 0
  victim.failures += 1

  task.status = 'queued'
  task.workerId = null
  task.owner = null
  task.progress = 0
  task.startedTick = null
  task.finishedTick = null
  task.localRuns = []
  task.sortedValues = null
  task.retries += 1

  state.queue.unshift(task.id)
  state.faultsInjected += 1
  state.requeued += 1

  log(
    state,
    `[FAULT] ${victim.id} stopped responding while sorting ${task.id}. Heartbeat timeout detected; task requeued for another worker.`,
    'error',
    victim.id,
  )
}

function updateSorting(state: SimulationState): void {
  for (const worker of state.workers) {
    if (worker.status !== 'receiving') continue
    const task = findTask(state, worker.currentTaskId)
    if (!task) continue
    worker.status = 'processing'
    task.status = 'processing'
    task.startedTick = state.tick
    log(
      state,
      `[SORT] ${worker.id} starts ${task.id}; local chunks are processed in parallel by ${worker.cores} simulated cores.`,
      'sort',
      worker.id,
    )
  }

  for (const worker of state.workers) {
    if (worker.status !== 'processing') continue
    const task = findTask(state, worker.currentTaskId)
    if (!task) continue

    for (const run of task.localRuns) {
      const nextProgress = localRunProgress(run, task.durationTicks)
      if (nextProgress >= 100 && !run.sorted) {
        const sortedSlice = sortNumeric(task.values.slice(run.start, run.end))
        run.progress = 100
        run.sorted = true
        run.min = sortedSlice[0] ?? 0
        run.max = sortedSlice[sortedSlice.length - 1] ?? 0
        run.sample = sampleValues(sortedSlice, 14)
      } else {
        run.progress = nextProgress
      }
    }

    const average =
      task.localRuns.reduce((sum, run) => sum + run.progress, 0) / Math.max(1, task.localRuns.length)
    task.progress = Math.round(average)
    worker.progress = task.progress

    if (task.localRuns.every((run) => run.sorted)) {
      worker.status = 'merging'
      worker.localMergeProgress = 0
      task.progress = 100
      worker.progress = 100
      log(
        state,
        `[LOCAL-MERGE] ${worker.id} merges ${task.localRuns.length} sorted core runs for ${task.id}.`,
        'sort',
        worker.id,
      )
    }
  }

  for (const worker of state.workers) {
    if (worker.status !== 'merging') continue
    const task = findTask(state, worker.currentTaskId)
    if (!task) continue
    worker.localMergeProgress = Math.min(100, worker.localMergeProgress + 50)
    if (worker.localMergeProgress >= 100) completeTask(state, worker, task)
  }

  for (const worker of state.workers) {
    if (worker.status !== 'returning') continue
    const task = findTask(state, worker.currentTaskId)
    if (!task || task.finishedTick === null || task.finishedTick >= state.tick) continue
    worker.status = 'completed'
    worker.currentTaskId = null
    worker.progress = 0
    worker.localMergeProgress = 0
    log(state, `[RECEIVED] Master received the sorted run from ${worker.id}.`, 'result', 'master')
  }
}

function recoverWorkers(state: SimulationState): void {
  for (const worker of state.workers) {
    if (worker.status !== 'failed' || worker.recoverAtTick === null) continue
    if (state.tick < worker.recoverAtTick) continue
    worker.status = 'registered'
    worker.recoverAtTick = null
    state.recoveredAtTick = state.tick
    log(
      state,
      `[REJOIN] ${worker.id} is reachable again and rejoins the worker pool after recovery.`,
      'recovery',
      worker.id,
    )
  }
}

function allTasksReturned(state: SimulationState): boolean {
  return (
    state.queue.length === 0 &&
    state.tasks.every((task) => task.status === 'returned' || task.status === 'merged')
  )
}

function hasBusyWorker(state: SimulationState): boolean {
  return state.workers.some((worker) =>
    (['receiving', 'processing', 'merging', 'returning'] as NodeStatus[]).includes(worker.status),
  )
}

function startAggregation(state: SimulationState): void {
  state.phase = 'aggregation'
  state.master.status = 'merging'
  state.aggregationStartedTick = state.tick
  state.mergeGroups = buildMergeGroups(state.tasks, state.workers, state.settings.mergeMode)
  state.aggregationMerged = 0
  log(
    state,
    `All sorted runs are back. Starting ${state.settings.mergeMode} merge with ${state.mergeGroups.length} merge groups.`,
    'merge',
    'master',
  )
}

function finishAggregation(state: SimulationState): void {
  const runs = state.tasks
    .slice()
    .sort((left, right) => left.index - right.index)
    .map((task) => task.sortedValues)
    .filter((values): values is number[] => Boolean(values))
  const finalSorted = mergeManySorted(runs)
  const finalChecksum = checksum(finalSorted)
  const sortedOk = isSorted(finalSorted)
  const checksumOk = finalChecksum === state.baseline.checksum
  const mergeDurationTicks =
    state.aggregationStartedTick === null ? 0 : state.tick - state.aggregationStartedTick + 1

  const aggregate: SortAggregate = {
    totalItems: finalSorted.length,
    chunkCount: state.tasks.length,
    uniqueValues: new Set(finalSorted).size,
    min: finalSorted[0] ?? 0,
    max: finalSorted[finalSorted.length - 1] ?? 0,
    median: medianSorted(finalSorted),
    checksum: finalChecksum,
    sorted: sortedOk,
    checksumVerified: checksumOk,
    sortedSample: sampleValues(finalSorted, 48),
    histogram: buildHistogram(finalSorted),
    mergeMode: state.settings.mergeMode,
    mergeGroups: state.mergeGroups.map((group) => ({ ...group, status: 'merged' })),
    workerRuns: runs.length,
    tieredMerges: state.mergeGroups.filter((group) => group.workerId !== null).length,
    mergeDurationTicks,
  }

  for (const task of state.tasks) task.status = 'merged'
  for (const worker of state.workers) {
    if (worker.status !== 'failed') worker.status = 'completed'
    worker.currentTaskId = null
    worker.progress = 0
    worker.localMergeProgress = 0
  }

  state.aggregate = aggregate
  state.aggregationMerged = state.mergeGroups.length
  state.master.mergeProgress = 100
  state.master.status = 'completed'
  state.phase = 'completed'
  state.running = false
  state.completedTick = state.tick
  log(
    state,
    `Simulation completed. ${aggregate.totalItems.toLocaleString('en-US')} items sorted across ${aggregate.chunkCount} chunks; checksum ${checksumOk ? 'verified' : 'mismatch'}.`,
    'system',
    'master',
  )
}

function updateAggregation(state: SimulationState): void {
  const pending = state.mergeGroups.filter((group) => group.status === 'pending').slice(0, MERGE_BATCH)
  for (const group of pending) group.status = 'merged'

  if (pending.length > 0) {
    state.aggregationMerged = state.mergeGroups.filter((group) => group.status === 'merged').length
    state.master.mergeProgress =
      state.mergeGroups.length === 0
        ? 100
        : Math.round((state.aggregationMerged / state.mergeGroups.length) * 100)
    log(
      state,
      `[MERGE] ${pending.length} merge group${pending.length === 1 ? '' : 's'} completed · ${state.aggregationMerged}/${state.mergeGroups.length} total.`,
      'merge',
      'master',
    )
  }

  if (state.mergeGroups.every((group) => group.status === 'merged')) {
    finishAggregation(state)
  }
}

export function advance(state: SimulationState): SimulationState {
  if (state.phase === 'completed') return state
  const next = structuredClone(state)
  next.tick += 1

  switch (next.phase) {
    case 'ready': {
      next.phase = 'initialization'
      next.master.status = 'processing'
      log(
        next,
        `[INIT] Master loaded "${next.dataset.name}" with ${next.dataset.totalItems.toLocaleString('en-US')} integer items.`,
        'system',
        'master',
      )
      break
    }
    case 'initialization': {
      next.phase = 'discovery'
      next.master.status = 'discovering'
      log(
        next,
        '[DISCOVERY] Master broadcasts UDP discovery probes on simulated port 9999.',
        'discovery',
        'master',
      )
      break
    }
    case 'discovery': {
      const idleWorker = next.workers.find((worker) => worker.status === 'idle')
      if (idleWorker) {
        idleWorker.status = 'registered'
        log(
          next,
          `[DISCOVERY] ${idleWorker.id} answered · ${idleWorker.hostname} · ${idleWorker.ip} · ${idleWorker.cores} cores.`,
          'discovery',
          idleWorker.id,
        )
      }
      if (next.workers.every((worker) => worker.status === 'registered')) {
        next.phase = 'decomposition'
        next.master.status = 'processing'
        log(
          next,
          `All ${next.workers.length} workers registered. Master starts chunk decomposition.`,
          'system',
          'master',
        )
      }
      break
    }
    case 'decomposition': {
      next.phase = 'distribution'
      log(
        next,
        `[DECOMPOSE] ${next.dataset.totalItems.toLocaleString('en-US')} items split into ${next.tasks.length} chunks using ${next.settings.schedule} scheduling.`,
        'task',
        'master',
      )
      break
    }
    case 'distribution': {
      const assigned = assignQueuedTasks(next)
      next.phase = 'processing'
      log(
        next,
        assigned > 0
          ? `[DISTRIBUTE] First batch sent to ${assigned} workers. Sorting begins in parallel.`
          : '[DISTRIBUTE] No worker ready for the first batch; scheduler is waiting.',
        'task',
        'master',
      )
      break
    }
    case 'processing': {
      updateSorting(next)
      injectFailure(next)
      recoverWorkers(next)
      assignQueuedTasks(next)
      if (allTasksReturned(next) && !hasBusyWorker(next)) {
        startAggregation(next)
      }
      break
    }
    case 'aggregation': {
      updateAggregation(next)
      break
    }
    default:
      break
  }

  return next
}

export function getMergePreview(state: SimulationState): MergeGroup[] {
  return state.mergeGroups
}

export function getTaskStatusCounts(state: SimulationState): Record<TaskStatus, number> {
  const counts: Record<TaskStatus, number> = {
    queued: 0,
    assigned: 0,
    processing: 0,
    returned: 0,
    merged: 0,
  }
  for (const task of state.tasks) counts[task.status] += 1
  return counts
}

export function getLocalRunSummary(runs: LocalRun[]): { sorted: number; total: number } {
  return {
    sorted: runs.filter((run) => run.sorted).length,
    total: runs.length,
  }
}

export function getWorkerCurrentTask(state: SimulationState, worker: WorkerNode): Task | undefined {
  return worker.currentTaskId
    ? state.tasks.find((task) => task.id === worker.currentTaskId)
    : undefined
}

export function getSortedPreview(state: SimulationState): number[] {
  return state.aggregate?.sortedSample ?? state.baseline.sortedSample
}

export function getCompletedRuns(state: SimulationState): number[][] {
  return state.tasks.map((task) => task.sortedValues).filter((values): values is number[] => Boolean(values))
}

export function getCompletedRunCount(state: SimulationState): number {
  return state.tasks.filter((task) => task.sortedValues !== null).length
}

export function getCoreRunSamples(task: Task): LocalRun[] {
  return task.localRuns.length > 0 ? task.localRuns : completeLocalRuns(task.values, 1)
}
