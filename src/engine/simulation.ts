import {
  BASE_TICK_SECONDS,
  type Dataset,
  type LogEvent,
  type SimulationState,
  type Speed,
  type Task,
  type WorkerNode,
} from '../types'
import { analyzeDocs, mergeInto, summarize, topWords } from './analyzer'

const MAX_EVENTS = 240
const MERGE_BATCH = 3

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

function createWorkers(): WorkerNode[] {
  return WORKER_SPECS.map((spec) => ({
    ...spec,
    status: 'idle',
    currentTaskId: null,
    progress: 0,
    docsProcessed: 0,
    wordsProcessed: 0,
    tasksCompleted: 0,
    lastTaskDurationSec: null,
    frequencies: {},
    timeline: [],
  }))
}

function createTasks(dataset: Dataset): Task[] {
  const tasks: Task[] = []
  const taskCount = Math.max(1, Math.ceil(dataset.docs.length / dataset.taskSize))

  for (let index = 0; index < taskCount; index += 1) {
    const startDoc = index * dataset.taskSize
    const endDoc = Math.min(startDoc + dataset.taskSize, dataset.docs.length)
    const docs = dataset.docs.slice(startDoc, endDoc)
    tasks.push({
      id: `task-${String(index + 1).padStart(3, '0')}`,
      index,
      startDoc,
      endDoc: Math.max(startDoc, endDoc - 1),
      docCount: docs.length,
      status: 'queued',
      workerId: null,
      progress: 0,
      durationTicks: 0,
      startedTick: null,
      finishedTick: null,
      analysis: analyzeDocs(docs),
    })
  }

  return tasks
}

export function createInitialState(dataset: Dataset, speed: Speed = 1): SimulationState {
  const tasks = createTasks(dataset)
  const fullAnalysis = analyzeDocs(dataset.docs)

  return {
    dataset,
    phase: 'ready',
    tick: 0,
    running: false,
    speed,
    master: {
      id: 'master',
      hostname: 'master.sim.local',
      ip: '10.20.0.1',
      cores: 16,
      status: 'idle',
    },
    workers: createWorkers(),
    tasks,
    queue: tasks.map((task) => task.id),
    events: [
      {
        id: 1,
        tick: 0,
        timeSec: 0,
        message: `Simulation ready. ${tasks.length} tasks queued from "${dataset.name}". All ${WORKER_COUNT} workers are idle.`,
        kind: 'system',
      },
    ],
    eventSeq: 2,
    masterFrequencies: {},
    aggregate: null,
    aggregationMerged: 0,
    baseline: summarize(fullAnalysis.frequencies, dataset.docs.length, 12),
    completedTick: null,
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

function assignQueuedTasks(state: SimulationState): number {
  let assigned = 0

  for (const worker of state.workers) {
    if (worker.status === 'completed') {
      const lastEndTick = worker.timeline[worker.timeline.length - 1]?.endTick
      if (lastEndTick === undefined || lastEndTick >= state.tick - 1) continue
    } else if (worker.status !== 'idle' && worker.status !== 'registered') {
      continue
    }
    const taskId = state.queue.shift()
    if (!taskId) break
    const task = state.tasks.find((candidate) => candidate.id === taskId)
    if (!task) continue

    task.status = 'assigned'
    task.workerId = worker.id
    task.progress = 0
    task.durationTicks = Math.max(2, Math.ceil(task.docCount / Math.max(2, worker.cores)) + 1)

    worker.currentTaskId = task.id
    worker.progress = 0
    worker.status = 'receiving'

    log(
      state,
      `Master dispatched ${task.id} (${task.docCount} docs) to ${worker.id} with ${worker.cores} simulated cores.`,
      'task',
      worker.id,
    )
    assigned += 1
  }

  return assigned
}

export function advance(state: SimulationState): SimulationState {
  if (state.phase === 'completed') return state

  const next: SimulationState = {
    ...state,
    tick: state.tick + 1,
    master: { ...state.master },
    workers: state.workers.map((worker) => ({ ...worker, timeline: [...worker.timeline] })),
    tasks: state.tasks.map((task) => ({ ...task })),
    queue: [...state.queue],
    events: [...state.events],
    masterFrequencies: { ...state.masterFrequencies },
  }

  switch (state.phase) {
    case 'ready': {
      next.phase = 'initialization'
      next.master.status = 'idle'
      log(
        next,
        `Initialization: master starts, dataset "${next.dataset.name}" is loaded (${next.dataset.docs.length} documents).`,
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
        'Node discovery: master broadcasts UDP probes on discovery port 9999 (simulated).',
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
          `Worker found and registered: ${idleWorker.id} at ${idleWorker.ip} (${idleWorker.hostname}).`,
          'discovery',
          idleWorker.id,
        )
      }
      if (next.workers.every((worker) => worker.status === 'registered')) {
        next.phase = 'decomposition'
        next.master.status = 'processing'
        log(
          next,
          `All ${WORKER_COUNT} simulated workers registered. Master begins preprocessing and task decomposition.`,
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
        `Task decomposition: dataset split into ${next.tasks.length} tasks of up to ${next.dataset.taskSize} documents. Task queue is ready.`,
        'task',
        'master',
      )
      break
    }
    case 'distribution': {
      const assigned = assignQueuedTasks(next)
      next.phase = 'processing'
      if (assigned === 0) {
        log(next, 'No idle worker available for the first batch. Waiting for the queue scheduler.', 'system', 'master')
      } else {
        log(next, `First batch dispatched to ${assigned} workers. Workers now process tasks in parallel.`, 'task', 'master')
      }
      break
    }
    case 'processing': {
      for (const worker of next.workers) {
        if (worker.status !== 'processing' || !worker.currentTaskId) continue
        const task = next.tasks.find((candidate) => candidate.id === worker.currentTaskId)
        if (!task) continue

        worker.progress = Math.min(100, worker.progress + 100 / task.durationTicks)
        task.progress = Math.round(worker.progress)

        if (worker.progress >= 100) {
          const startedTick = task.startedTick ?? next.tick
          task.finishedTick = next.tick
          task.status = 'returned'
          task.progress = 100
          worker.status = 'returning'
          worker.progress = 100
          worker.docsProcessed += task.docCount
          worker.wordsProcessed += task.analysis.wordCount
          worker.tasksCompleted += 1
          worker.lastTaskDurationSec = Number(((next.tick - startedTick) * BASE_TICK_SECONDS).toFixed(1))
          worker.frequencies = { ...worker.frequencies }
          mergeInto(worker.frequencies, task.analysis.frequencies)
          worker.timeline = [
            ...worker.timeline,
            { taskId: task.id, startTick: startedTick, endTick: next.tick },
          ]
          log(
            next,
            `${worker.id} completed ${task.id}: ${task.docCount} docs, ${task.analysis.wordCount} words. Returning result to master.`,
            'result',
            worker.id,
          )
        }
      }

      for (const worker of next.workers) {
        if (worker.status !== 'returning' || !worker.currentTaskId) continue
        const task = next.tasks.find((candidate) => candidate.id === worker.currentTaskId)
        if (!task || task.finishedTick === null || task.finishedTick >= next.tick) continue
        worker.status = 'completed'
        worker.progress = 0
        worker.currentTaskId = null
        log(next, `Master received the result payload from ${worker.id}.`, 'result', 'master')
      }

      for (const worker of next.workers) {
        if (worker.status !== 'receiving' || !worker.currentTaskId) continue
        const task = next.tasks.find((candidate) => candidate.id === worker.currentTaskId)
        if (!task) continue
        worker.status = 'processing'
        task.status = 'processing'
        task.startedTick = next.tick
        task.progress = 0
        log(next, `${worker.id} started processing ${task.id}.`, 'task', worker.id)
      }

      assignQueuedTasks(next)

      const hasUnfinishedTasks = next.tasks.some(
        (task) => task.status !== 'returned' && task.status !== 'aggregated',
      )
      const hasBusyWorkers = next.workers.some(
        (worker) =>
          worker.status === 'processing' || worker.status === 'receiving' || worker.status === 'returning',
      )

      if (!hasUnfinishedTasks && next.queue.length === 0 && !hasBusyWorkers) {
        next.phase = 'aggregation'
        next.master.status = 'processing'
        log(
          next,
          'All task results are back at the master. Starting result aggregation with mergeable word counters.',
          'result',
          'master',
        )
      }
      break
    }
    case 'aggregation': {
      const group = next.workers.slice(
        next.aggregationMerged,
        Math.min(WORKER_COUNT, next.aggregationMerged + MERGE_BATCH),
      )

      for (const worker of group) {
        mergeInto(next.masterFrequencies, worker.frequencies)
        for (const task of next.tasks) {
          if (task.workerId === worker.id) task.status = 'aggregated'
        }
      }

      next.aggregationMerged = Math.min(WORKER_COUNT, next.aggregationMerged + group.length)
      const mergedWords = Object.values(next.masterFrequencies).reduce((sum, value) => sum + value, 0)
      log(
        next,
        `Master merged counters from ${group.map((worker) => worker.id).join(', ')}. Running total: ${mergedWords} words.`,
        'result',
        'master',
      )

      if (next.aggregationMerged >= WORKER_COUNT) {
        const totalDocs = next.tasks.reduce((sum, task) => sum + task.docCount, 0)
        next.aggregate = summarize({ ...next.masterFrequencies }, totalDocs, 12)
        next.phase = 'completed'
        next.master.status = 'completed'
        next.running = false
        next.completedTick = next.tick
        log(
          next,
          `Simulation completed. ${totalDocs} documents, ${next.tasks.length} tasks, ${WORKER_COUNT} workers. Final unique words: ${next.aggregate.uniqueWords}.`,
          'system',
          'master',
        )
      }
      break
    }
  }

  return next
}

export function getAggregatePreview(state: SimulationState) {
  if (state.aggregate) return state.aggregate
  const hasReturnedResults = state.workers.some((worker) => worker.tasksCompleted > 0)
  if (!hasReturnedResults) return null

  const merged: Record<string, number> = {}
  for (const worker of state.workers) mergeInto(merged, worker.frequencies)
  const totalDocs = state.tasks
    .filter((task) => task.status === 'returned' || task.status === 'aggregated')
    .reduce((sum, task) => sum + task.docCount, 0)
  return summarize(merged, totalDocs, 12)
}

export function getLeaderWords(state: SimulationState, limit = 5) {
  return topWords(state.masterFrequencies, limit)
}
