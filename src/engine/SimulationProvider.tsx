import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react'
import {
  BASE_TICK_SECONDS,
  type SimulationSettings,
  type SimulationState,
  type SortingDataset,
  type Speed,
} from '../types'
import { DEFAULT_SETTINGS, advance, createInitialState } from '../engine/simulation'
import { DEFAULT_DATASET } from '../engine/sorting'
import {
  parseBenchmarkCsv,
  summarizeBenchmark,
  type BenchmarkImportState,
  type BenchmarkSummary,
} from '../engine/benchmark'

type SimulationAction =
  | { type: 'tick' }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'step' }
  | { type: 'reset' }
  | { type: 'speed'; speed: Speed }
  | { type: 'dataset'; dataset: SortingDataset }
  | { type: 'settings'; settings: SimulationSettings }

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
      return createInitialState(state.dataset, state.settings, state.speed)
    case 'speed':
      return { ...state, speed: action.speed }
    case 'dataset':
      return createInitialState(action.dataset, state.settings, state.speed)
    case 'settings':
      return createInitialState(state.dataset, action.settings, state.speed)
    default:
      return state
  }
}

export interface SimulationStats {
  masterCount: number
  workerCount: number
  itemsTotal: number
  tasksTotal: number
  queued: number
  assigned: number
  returned: number
  merged: number
  activeWorkers: number
  successfulWorkers: number
  returnedItems: number
  progressPct: number
  simulatedSeconds: number
  mergeGroupsTotal: number
  mergeGroupsMerged: number
  failures: number
  requeued: number
}

interface SimulationContextValue {
  state: SimulationState
  stats: SimulationStats
  benchmark: BenchmarkImportState
  benchmarkSummary: BenchmarkSummary | null
  play: () => void
  pause: () => void
  step: () => void
  reset: () => void
  setSpeed: (speed: Speed) => void
  selectDataset: (dataset: SortingDataset) => void
  updateSettings: (patch: Partial<SimulationSettings>) => void
  importBenchmark: (file: File) => Promise<void>
  clearBenchmark: () => void
}

const EMPTY_BENCHMARK: BenchmarkImportState = {
  fileName: null,
  importedAt: null,
  rows: [],
  warnings: [],
  error: null,
}

const SimulationContext = createContext<SimulationContextValue | null>(null)

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    createInitialState(DEFAULT_DATASET, DEFAULT_SETTINGS),
  )
  const [benchmark, setBenchmark] = useState<BenchmarkImportState>(EMPTY_BENCHMARK)

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
    (dataset: SortingDataset) => dispatch({ type: 'dataset', dataset }),
    [],
  )
  const updateSettings = useCallback(
    (patch: Partial<SimulationSettings>) => {
      dispatch({ type: 'settings', settings: { ...state.settings, ...patch } })
    },
    [state.settings],
  )

  const importBenchmark = useCallback(async (file: File) => {
    try {
      const text = await file.text()
      const parsed = parseBenchmarkCsv(text)
      setBenchmark({
        fileName: file.name,
        importedAt: new Date().toISOString(),
        rows: parsed.rows,
        warnings: parsed.warnings,
        error: null,
      })
    } catch (error) {
      setBenchmark({
        fileName: file.name,
        importedAt: new Date().toISOString(),
        rows: [],
        warnings: [],
        error: error instanceof Error ? error.message : 'Gagal membaca results.csv.',
      })
    }
  }, [])

  const clearBenchmark = useCallback(() => setBenchmark(EMPTY_BENCHMARK), [])

  const stats = useMemo<SimulationStats>(() => {
    const tasksTotal = state.tasks.length
    const returned = state.tasks.filter(
      (task) => task.status === 'returned' || task.status === 'merged',
    ).length
    const merged = state.tasks.filter((task) => task.status === 'merged').length
    const assigned = state.tasks.filter((task) => task.status === 'assigned').length
    const returnedItems = state.tasks
      .filter((task) => task.status === 'returned' || task.status === 'merged')
      .reduce((sum, task) => sum + task.itemCount, 0)
    const mergeGroupsMerged = state.mergeGroups.filter((group) => group.status === 'merged').length

    return {
      masterCount: 1,
      workerCount: state.workers.length,
      itemsTotal: state.dataset.totalItems,
      tasksTotal,
      queued: state.queue.length,
      assigned,
      returned,
      merged,
      activeWorkers: state.workers.filter((worker) =>
        ['receiving', 'processing', 'merging', 'returning'].includes(worker.status),
      ).length,
      successfulWorkers: state.workers.filter((worker) => worker.tasksCompleted > 0).length,
      returnedItems,
      progressPct: tasksTotal === 0 ? 0 : Math.round((returned / tasksTotal) * 100),
      simulatedSeconds: Number((state.tick * BASE_TICK_SECONDS).toFixed(1)),
      mergeGroupsTotal: state.mergeGroups.length,
      mergeGroupsMerged,
      failures: state.workers.reduce((sum, worker) => sum + worker.failures, 0),
      requeued: state.requeued,
    }
  }, [state])

  const benchmarkSummary = useMemo(
    () => (benchmark.rows.length > 0 ? summarizeBenchmark(benchmark.rows) : null),
    [benchmark.rows],
  )

  const value = useMemo<SimulationContextValue>(
    () => ({
      state,
      stats,
      benchmark,
      benchmarkSummary,
      play,
      pause,
      step,
      reset,
      setSpeed,
      selectDataset,
      updateSettings,
      importBenchmark,
      clearBenchmark,
    }),
    [
      state,
      stats,
      benchmark,
      benchmarkSummary,
      play,
      pause,
      step,
      reset,
      setSpeed,
      selectDataset,
      updateSettings,
      importBenchmark,
      clearBenchmark,
    ],
  )

  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>
}

export function useSimulation(): SimulationContextValue {
  const context = useContext(SimulationContext)
  if (!context) throw new Error('useSimulation must be used inside a SimulationProvider')
  return context
}
