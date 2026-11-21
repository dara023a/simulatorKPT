import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'
import { BASE_TICK_SECONDS, type Dataset, type Speed, type SimulationState } from '../types'
import { advance, createInitialState, WORKER_COUNT } from '../engine/simulation'
import { SAMPLE_DATASET } from '../data/datasets'

type SimulationAction =
  | { type: 'tick' }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'step' }
  | { type: 'reset' }
  | { type: 'speed'; speed: Speed }
  | { type: 'dataset'; dataset: Dataset }

function reducer(state: SimulationState, action: SimulationAction): SimulationState {
  switch (action.type) {
    case 'tick':
      return advance(state)
    case 'play':
      if (state.phase === 'completed') return state
      return { ...state, running: true }
    case 'pause':
      return state.running ? { ...state, running: false } : state
    case 'step':
      if (state.phase === 'completed') return state
      return advance({ ...state, running: false })
    case 'reset':
      return createInitialState(state.dataset, state.speed)
    case 'speed':
      return { ...state, speed: action.speed }
    case 'dataset':
      return createInitialState(action.dataset, state.speed)
    default:
      return state
  }
}

export interface SimulationStats {
  masterCount: number
  workerCount: number
  docsTotal: number
  tasksTotal: number
  queued: number
  assigned: number
  returned: number
  aggregatedTasks: number
  activeWorkers: number
  returnedDocs: number
  progressPct: number
  simulatedSeconds: number
}

interface SimulationContextValue {
  state: SimulationState
  stats: SimulationStats
  play: () => void
  pause: () => void
  step: () => void
  reset: () => void
  setSpeed: (speed: Speed) => void
  selectDataset: (dataset: Dataset) => void
}

const SimulationContext = createContext<SimulationContextValue | null>(null)

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => createInitialState(SAMPLE_DATASET))

  useEffect(() => {
    if (!state.running || state.phase === 'completed') return
    const interval = window.setInterval(
      () => dispatch({ type: 'tick' }),
      (BASE_TICK_SECONDS * 1000) / state.speed,
    )
    return () => window.clearInterval(interval)
  }, [state.running, state.speed, state.phase])

  const play = useCallback(() => dispatch({ type: 'play' }), [])
  const pause = useCallback(() => dispatch({ type: 'pause' }), [])
  const step = useCallback(() => dispatch({ type: 'step' }), [])
  const reset = useCallback(() => dispatch({ type: 'reset' }), [])
  const setSpeed = useCallback((speed: Speed) => dispatch({ type: 'speed', speed }), [])
  const selectDataset = useCallback(
    (dataset: Dataset) => dispatch({ type: 'dataset', dataset }),
    [],
  )

  const stats = useMemo<SimulationStats>(() => {
    const tasksTotal = state.tasks.length
    const returned = state.tasks.filter((task) => task.status === 'returned' || task.status === 'aggregated').length
    const aggregatedTasks = state.tasks.filter((task) => task.status === 'aggregated').length
    const assigned = state.tasks.filter((task) => task.status === 'assigned').length
    const returnedDocs = state.tasks
      .filter((task) => task.status === 'returned' || task.status === 'aggregated')
      .reduce((sum, task) => sum + task.docCount, 0)

    return {
      masterCount: 1,
      workerCount: WORKER_COUNT,
      docsTotal: state.dataset.docs.length,
      tasksTotal,
      queued: state.queue.length,
      assigned,
      returned,
      aggregatedTasks,
      activeWorkers: state.workers.filter((worker) =>
        ['receiving', 'processing', 'returning'].includes(worker.status),
      ).length,
      returnedDocs,
      progressPct: tasksTotal === 0 ? 0 : Math.round((returned / tasksTotal) * 100),
      simulatedSeconds: Number((state.tick * BASE_TICK_SECONDS).toFixed(1)),
    }
  }, [state])

  const value = useMemo<SimulationContextValue>(
    () => ({ state, stats, play, pause, step, reset, setSpeed, selectDataset }),
    [state, stats, play, pause, step, reset, setSpeed, selectDataset],
  )

  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>
}

export function useSimulation(): SimulationContextValue {
  const context = useContext(SimulationContext)
  if (!context) throw new Error('useSimulation must be used inside a SimulationProvider')
  return context
}
