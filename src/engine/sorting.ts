import type {
  ArrayPattern,
  HistogramBin,
  LocalRun,
  MergeGroup,
  MergeLayer,
  SortBaseline,
  SortingDataset,
  Task,
  WorkerNode,
} from '../types'

const SORT_RATE = 30
const DEFAULT_COUNT = 8192

function mulberry32(seed: number): () => number {
  let value = seed
  return () => {
    value |= 0
    value = (value + 0x6d2b79f5) | 0
    let t = Math.imul(value ^ (value >>> 15), 1 | value)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function compact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return String(Math.round(value))
}

export function generateValues(
  pattern: ArrayPattern,
  count = DEFAULT_COUNT,
  seed = 2026,
): number[] {
  const random = mulberry32(seed)
  const values = new Array<number>(count)

  if (pattern === 'duplicates') {
    const alphabet = Math.max(24, Math.round(count / 24))
    for (let index = 0; index < count; index += 1) {
      values[index] = Math.floor(random() * alphabet)
    }
    return values
  }

  if (pattern === 'nearly-sorted') {
    for (let index = 0; index < count; index += 1) {
      values[index] = index * 7 + Math.floor(random() * 5)
    }
    const swaps = Math.max(4, Math.floor(count * 0.025))
    for (let index = 0; index < swaps; index += 1) {
      const left = Math.floor(random() * (count - 1))
      const right = Math.min(count - 1, left + 1 + Math.floor(random() * 8))
      const temp = values[left]
      values[left] = values[right]
      values[right] = temp
    }
    return values
  }

  for (let index = 0; index < count; index += 1) {
    values[index] = Math.floor(random() * 50_000)
  }
  return values
}

function createPreset(
  id: string,
  name: string,
  shortName: string,
  description: string,
  pattern: ArrayPattern,
  seed: number,
  note: string,
): SortingDataset {
  const values = generateValues(pattern, DEFAULT_COUNT, seed)
  return {
    id,
    name,
    shortName,
    description,
    source: 'preset',
    totalItems: values.length,
    values,
    pattern,
    seed,
    note,
  }
}

export const RANDOM_DATASET = createPreset(
  'random-8k',
  'Uniform random int32 · 8,192 items',
  'Random 8k',
  'Nilai acak deterministik dengan rentang 0–49.999. Cocok untuk memperlihatkan distribusi task yang seimbang.',
  'random',
  20260101,
  'Array dibangkitkan secara deterministik dari seed tetap di browser; bukan data hasil pengukuran perangkat.',
)

export const DUPLICATES_DATASET = createPreset(
  'duplicates-8k',
  'Many duplicates int32 · 8,192 items',
  'Duplicates 8k',
  'Alfabet nilai kecil sehingga banyak duplikat. Berguna untuk menjelaskan unique count dan histogram yang tidak rata.',
  'duplicates',
  20260202,
  'Array simulasi dengan banyak nilai berulang, dibangkitkan dari seed tetap.',
)

export const NEARLY_SORTED_DATASET = createPreset(
  'nearly-sorted-8k',
  'Nearly sorted int32 · 8,192 items',
  'Nearly sorted 8k',
  'Array hampir terurut dengan sedikit pertukaran lokal. Bagus untuk menunjukkan bahwa distribusi chunk tetap memengaruhi merge.',
  'nearly-sorted',
  20260303,
  'Array hampir terurut ini tetap diproses melalui chunk, local sort, dan merge yang sama.',
)

export const SORTING_DATASETS = [RANDOM_DATASET, DUPLICATES_DATASET, NEARLY_SORTED_DATASET]
export const DEFAULT_DATASET = RANDOM_DATASET

export function getDatasetById(id: string): SortingDataset {
  return SORTING_DATASETS.find((dataset) => dataset.id === id) ?? DEFAULT_DATASET
}

export function sortNumeric(values: number[]): number[] {
  return [...values].sort((left, right) => left - right)
}

export function mergeSortedRuns(left: number[], right: number[]): number[] {
  const merged = new Array<number>(left.length + right.length)
  let leftIndex = 0
  let rightIndex = 0
  let outputIndex = 0

  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] <= right[rightIndex]) {
      merged[outputIndex] = left[leftIndex]
      leftIndex += 1
    } else {
      merged[outputIndex] = right[rightIndex]
      rightIndex += 1
    }
    outputIndex += 1
  }
  while (leftIndex < left.length) {
    merged[outputIndex] = left[leftIndex]
    leftIndex += 1
    outputIndex += 1
  }
  while (rightIndex < right.length) {
    merged[outputIndex] = right[rightIndex]
    rightIndex += 1
    outputIndex += 1
  }
  return merged
}

export function mergeManySorted(runs: number[][]): number[] {
  if (runs.length === 0) return []
  let current = runs.map((run) => [...run])
  while (current.length > 1) {
    const next: number[][] = []
    for (let index = 0; index < current.length; index += 2) {
      if (index + 1 < current.length) {
        next.push(mergeSortedRuns(current[index], current[index + 1]))
      } else {
        next.push(current[index])
      }
    }
    current = next
  }
  return current[0]
}

export function checksum(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0)
}

export function isSorted(values: number[]): boolean {
  for (let index = 1; index < values.length; index += 1) {
    if (values[index - 1] > values[index]) return false
  }
  return true
}

export function uniqueCount(values: number[]): number {
  return new Set(values).size
}

export function medianSorted(sorted: number[]): number {
  if (sorted.length === 0) return 0
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle]
  return (sorted[middle - 1] + sorted[middle]) / 2
}

export function sampleValues(values: number[], limit = 48): number[] {
  if (values.length <= limit) return [...values]
  const step = (values.length - 1) / (limit - 1)
  return Array.from({ length: limit }, (_, index) => values[Math.round(index * step)])
}

export function buildHistogram(values: number[], bins = 12): HistogramBin[] {
  if (values.length === 0) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) {
    return [{ label: compact(min), from: min, to: max, count: values.length }]
  }
  const width = (max - min) / bins
  const counts = new Array<number>(bins).fill(0)
  for (const value of values) {
    const index = Math.min(bins - 1, Math.floor((value - min) / width))
    counts[index] += 1
  }
  return counts.map((count, index) => {
    const from = min + index * width
    const to = index === bins - 1 ? max : min + (index + 1) * width
    return {
      label: `${compact(from)}–${compact(to)}`,
      from,
      to,
      count,
    }
  })
}

export function buildBaseline(values: number[]): SortBaseline {
  const sorted = sortNumeric(values)
  return {
    totalItems: sorted.length,
    uniqueValues: uniqueCount(sorted),
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    median: medianSorted(sorted),
    checksum: checksum(sorted),
    sortedSample: sampleValues(sorted, 48),
    histogram: buildHistogram(sorted),
  }
}

export function taskDurationTicks(itemCount: number, cores: number): number {
  return Math.max(2, Math.ceil(itemCount / (Math.max(1, cores) * SORT_RATE)) + 1)
}

export function splitValues(values: number[], chunkCount: number): number[][] {
  const safeChunks = Math.max(1, chunkCount)
  const size = Math.max(1, Math.ceil(values.length / safeChunks))
  const chunks: number[][] = []
  for (let start = 0; start < values.length; start += size) {
    chunks.push(values.slice(start, start + size))
  }
  return chunks
}

export function buildLocalRuns(values: number[], cores: number): LocalRun[] {
  const runCount = Math.max(1, Math.min(cores, values.length || 1))
  const base = Math.floor(values.length / runCount)
  const remainder = values.length % runCount
  const runs: LocalRun[] = []
  let start = 0

  for (let coreIndex = 0; coreIndex < runCount; coreIndex += 1) {
    const length = base + (coreIndex < remainder ? 1 : 0)
    const end = start + length
    const slice = values.slice(start, end)
    const min = slice.length > 0 ? Math.min(...slice) : 0
    const max = slice.length > 0 ? Math.max(...slice) : 0
    runs.push({
      coreIndex,
      start,
      end,
      itemCount: length,
      progress: 0,
      sorted: false,
      min,
      max,
      sample: sampleValues(slice, 14),
    })
    start = end
  }
  return runs
}

export function completeLocalRuns(values: number[], cores: number): LocalRun[] {
  const runs = buildLocalRuns(values, cores)
  return runs.map((run) => {
    const sorted = sortNumeric(values.slice(run.start, run.end))
    return {
      ...run,
      progress: 100,
      sorted: true,
      min: sorted[0] ?? 0,
      max: sorted[sorted.length - 1] ?? 0,
      sample: sampleValues(sorted, 14),
    }
  })
}

export function mergeLocalRuns(values: number[], runs: LocalRun[]): number[] {
  const sortedRuns = runs.map((run) => sortNumeric(values.slice(run.start, run.end)))
  return mergeManySorted(sortedRuns)
}

interface RunRef {
  id: string
  size: number
  workerId: string | null
}

function appendMasterTree(
  groups: MergeGroup[],
  inputs: RunRef[],
  startLevel: number,
): RunRef[] {
  let level = startLevel
  let current = inputs

  while (current.length > 1) {
    const next: RunRef[] = []
    for (let index = 0; index < current.length; index += 2) {
      if (index + 1 >= current.length) {
        next.push(current[index])
        continue
      }
      const left = current[index]
      const right = current[index + 1]
      const group: MergeGroup = {
        id: `MG-${level}-${groups.length}`,
        level,
        workerId: null,
        inputIds: [left.id, right.id],
        inputSizes: [left.size, right.size],
        outputSize: left.size + right.size,
        status: 'pending',
      }
      groups.push(group)
      next.push({ id: group.id, size: group.outputSize, workerId: null })
    }
    current = next
    level += 1
  }

  return current
}

export function buildMergeGroups(
  tasks: Task[],
  workers: WorkerNode[],
  mergeMode: 'master' | 'tiered',
): MergeGroup[] {
  const groups: MergeGroup[] = []
  const runs: RunRef[] = tasks
    .filter((task) => task.workerId !== null)
    .map((task) => ({
      id: task.id,
      size: task.itemCount,
      workerId: task.workerId,
    }))

  if (mergeMode === 'master') {
    appendMasterTree(groups, runs, 0)
    return groups
  }

  const outputs: RunRef[] = []
  for (const worker of workers) {
    const workerRuns = runs.filter((run) => run.workerId === worker.id)
    if (workerRuns.length === 0) continue
    if (workerRuns.length === 1) {
      outputs.push({ ...workerRuns[0], workerId: null })
      continue
    }
    const sum = workerRuns.reduce((total, run) => total + run.size, 0)
    const group: MergeGroup = {
      id: `WT-${worker.id}`,
      level: 0,
      workerId: worker.id,
      inputIds: workerRuns.map((run) => run.id),
      inputSizes: workerRuns.map((run) => run.size),
      outputSize: sum,
      status: 'pending',
    }
    groups.push(group)
    outputs.push({ id: group.id, size: sum, workerId: null })
  }
  appendMasterTree(groups, outputs, 1)
  return groups
}

export function groupMergeLayers(groups: MergeGroup[]): MergeLayer[] {
  const levels = [...new Set(groups.map((group) => group.level))].sort((a, b) => a - b)
  return levels.map((level) => {
    const levelGroups = groups.filter((group) => group.level === level)
    const workerMerges = levelGroups.filter((group) => group.workerId !== null).length
    return {
      level,
      label:
        workerMerges > 0
          ? `Worker tier merges · level ${level}`
          : `Master merge tree · level ${level}`,
      groups: levelGroups,
    }
  })
}

export function localRunProgress(run: LocalRun, totalTicks: number): number {
  if (run.sorted) return 100
  const adjusted = Math.max(2, totalTicks + (run.coreIndex % 2))
  return Math.min(100, run.progress + 100 / adjusted)
}
