export interface BenchmarkRow {
  timestamp: string
  mode: string
  algo: string
  dtype: string
  size: number | null
  seed: number | null
  workers: number | null
  totalCores: number | null
  schedule: string
  merge: string
  chunks: number | null
  repeat: number | null
  tTotal: number | null
  tPhase1: number | null
  tTier: number | null
  tMerge: number | null
  throughput: number | null
  ok: boolean | null
  failures: number | null
  requeued: number | null
  recoveryMaxS: number | null
  detectMaxS: number | null
  imbalance: number | null
  idlePct: number | null
  cpuMasterAvg: number | null
  memMasterPeakMb: number | null
  cpuWorkerAvg: number | null
  memWorkerPeakMb: number | null
  sentMb: number | null
  recvMb: number | null
  dataset: string
  timeoutS: number | null
  cpw: number | null
  raw: Record<string, string>
}

export interface BenchmarkModeSummary {
  mode: string
  rows: number
  medianTTotal: number | null
  bestThroughput: number | null
  failures: number
}

export interface BenchmarkScalabilityPoint {
  workers: number
  rows: number
  medianTTotal: number | null
  throughput: number | null
}

export interface BenchmarkPhasePoint {
  label: string
  sort: number
  tier: number
  merge: number
  total: number
}

export interface BenchmarkSummary {
  rows: BenchmarkRow[]
  rowCount: number
  modes: string[]
  okCount: number
  failCount: number
  totalFailures: number
  totalRequeued: number
  bestThroughput: number | null
  medianTTotal: number | null
  maxRecoveryS: number | null
  maxDetectS: number | null
  byMode: BenchmarkModeSummary[]
  scalability: BenchmarkScalabilityPoint[]
  phaseBreakdown: BenchmarkPhasePoint[]
}

export interface BenchmarkImportState {
  fileName: string | null
  importedAt: string | null
  rows: BenchmarkRow[]
  warnings: string[]
  error: string | null
}

const HEADER_MAP: Record<string, keyof BenchmarkRow> = {
  timestamp: 'timestamp',
  mode: 'mode',
  algo: 'algo',
  dtype: 'dtype',
  size: 'size',
  seed: 'seed',
  workers: 'workers',
  total_cores: 'totalCores',
  schedule: 'schedule',
  merge: 'merge',
  chunks: 'chunks',
  repeat: 'repeat',
  t_total: 'tTotal',
  t_phase1: 'tPhase1',
  t_tier: 'tTier',
  t_merge: 'tMerge',
  throughput_melem_s: 'throughput',
  ok: 'ok',
  failures: 'failures',
  requeued: 'requeued',
  recovery_max_s: 'recoveryMaxS',
  detect_max_s: 'detectMaxS',
  imbalance: 'imbalance',
  idle_pct: 'idlePct',
  cpu_master_avg: 'cpuMasterAvg',
  mem_master_peak_mb: 'memMasterPeakMb',
  cpu_worker_avg: 'cpuWorkerAvg',
  mem_worker_peak_mb: 'memWorkerPeakMb',
  sent_mb: 'sentMb',
  recv_mb: 'recvMb',
  dataset: 'dataset',
  timeout_s: 'timeoutS',
  cpw: 'cpw',
}

const NUMERIC_FIELDS = new Set<keyof BenchmarkRow>([
  'size',
  'seed',
  'workers',
  'totalCores',
  'chunks',
  'repeat',
  'tTotal',
  'tPhase1',
  'tTier',
  'tMerge',
  'throughput',
  'failures',
  'requeued',
  'recoveryMaxS',
  'detectMaxS',
  'imbalance',
  'idlePct',
  'cpuMasterAvg',
  'memMasterPeakMb',
  'cpuWorkerAvg',
  'memWorkerPeakMb',
  'sentMb',
  'recvMb',
  'timeoutS',
  'cpw',
])

const STRING_FIELDS = new Set<keyof BenchmarkRow>([
  'timestamp',
  'mode',
  'algo',
  'dtype',
  'schedule',
  'merge',
  'dataset',
])

export const BENCHMARK_TEMPLATE = [
  'timestamp,mode,algo,dtype,size,seed,workers,total_cores,schedule,merge,chunks,repeat,t_total,t_phase1,t_tier,t_merge,throughput_Melem_s,ok,failures,requeued,recovery_max_s,detect_max_s,imbalance,idle_pct,cpu_master_avg,mem_master_peak_mb,cpu_worker_avg,mem_worker_peak_mb,sent_mb,recv_mb,dataset,timeout_s,cpw',
].join('\n')

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        cell += char
      }
      continue
    }
    if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (char !== '\r') {
      cell += char
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((line) => line.some((value) => value.trim().length > 0))
}

function toNumber(value: string | undefined): number | null {
  if (value === undefined) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function toBoolean(value: string | undefined): boolean | null {
  if (value === undefined) return null
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'y', 'ok'].includes(normalized)) return true
  if (['0', 'false', 'no', 'n', 'fail', 'failed'].includes(normalized)) return false
  return null
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle]
  return (sorted[middle - 1] + sorted[middle]) / 2
}

function best(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null)
  return present.length > 0 ? Math.max(...present) : null
}

export function parseBenchmarkCsv(text: string): { rows: BenchmarkRow[]; warnings: string[] } {
  const table = parseCsvRows(text.replace(/^\uFEFF/, ''))
  if (table.length < 2) throw new Error('CSV kosong atau tidak memiliki baris data.')

  const header = table[0].map((value) => value.trim().toLowerCase())
  const fieldForColumn = header.map((column) => HEADER_MAP[column] ?? null)
  if (!header.includes('mode') || (!header.includes('t_total') && !header.includes('throughput_melem_s'))) {
    throw new Error('CSV harus memiliki kolom mode dan minimal t_total atau throughput_Melem_s.')
  }

  const warnings: string[] = []
  const rows: BenchmarkRow[] = []

  for (let rowIndex = 1; rowIndex < table.length; rowIndex += 1) {
    const cells = table[rowIndex]
    const raw: Record<string, string> = {}
    const record: Record<string, unknown> = {
      timestamp: '',
      mode: '',
      algo: '',
      dtype: '',
      schedule: '',
      merge: '',
      dataset: '',
      ok: null,
    }

    cells.forEach((cell, columnIndex) => {
      const field = fieldForColumn[columnIndex]
      if (!field) return
      raw[header[columnIndex]] = cell
      const trimmed = cell.trim()
      if (field === 'ok') {
        record.ok = toBoolean(trimmed)
      } else if (NUMERIC_FIELDS.has(field)) {
        record[field] = toNumber(trimmed)
      } else if (STRING_FIELDS.has(field)) {
        record[field] = trimmed
      }
    })

    const mode = String(record.mode || '').trim()
    if (!mode) {
      warnings.push(`Baris ${rowIndex + 1} dilewati karena kolom mode kosong.`)
      continue
    }
    if (record.tTotal == null && record.throughput == null && record.workers == null) {
      warnings.push(`Baris ${rowIndex + 1} dilewati karena tidak punya metrik timing/worker.`)
      continue
    }

    rows.push({
      timestamp: String(record.timestamp || ''),
      mode,
      algo: String(record.algo || ''),
      dtype: String(record.dtype || ''),
      size: record.size as number | null,
      seed: record.seed as number | null,
      workers: record.workers as number | null,
      totalCores: record.totalCores as number | null,
      schedule: String(record.schedule || ''),
      merge: String(record.merge || ''),
      chunks: record.chunks as number | null,
      repeat: record.repeat as number | null,
      tTotal: record.tTotal as number | null,
      tPhase1: record.tPhase1 as number | null,
      tTier: record.tTier as number | null,
      tMerge: record.tMerge as number | null,
      throughput: record.throughput as number | null,
      ok: record.ok as boolean | null,
      failures: record.failures as number | null,
      requeued: record.requeued as number | null,
      recoveryMaxS: record.recoveryMaxS as number | null,
      detectMaxS: record.detectMaxS as number | null,
      imbalance: record.imbalance as number | null,
      idlePct: record.idlePct as number | null,
      cpuMasterAvg: record.cpuMasterAvg as number | null,
      memMasterPeakMb: record.memMasterPeakMb as number | null,
      cpuWorkerAvg: record.cpuWorkerAvg as number | null,
      memWorkerPeakMb: record.memWorkerPeakMb as number | null,
      sentMb: record.sentMb as number | null,
      recvMb: record.recvMb as number | null,
      dataset: String(record.dataset || ''),
      timeoutS: record.timeoutS as number | null,
      cpw: record.cpw as number | null,
      raw,
    })
  }

  if (rows.length === 0) throw new Error('Tidak ada baris benchmark yang valid di CSV.')
  return { rows, warnings }
}

export function summarizeBenchmark(rows: BenchmarkRow[]): BenchmarkSummary {
  const modes = [...new Set(rows.map((row) => row.mode))]
  const okCount = rows.filter((row) => row.ok === true).length
  const failCount = rows.filter((row) => row.ok === false).length
  const totalFailures = rows.reduce((sum, row) => sum + (row.failures ?? 0), 0)
  const totalRequeued = rows.reduce((sum, row) => sum + (row.requeued ?? 0), 0)
  const maxRecoveryS = best(rows.map((row) => row.recoveryMaxS))
  const maxDetectS = best(rows.map((row) => row.detectMaxS))

  const byMode: BenchmarkModeSummary[] = modes.map((mode) => {
    const modeRows = rows.filter((row) => row.mode === mode)
    return {
      mode,
      rows: modeRows.length,
      medianTTotal: median(
        modeRows.map((row) => row.tTotal).filter((value): value is number => value !== null),
      ),
      bestThroughput: best(modeRows.map((row) => row.throughput)),
      failures: modeRows.reduce((sum, row) => sum + (row.failures ?? 0), 0),
    }
  })

  const workerValues = [
    ...new Set(
      rows
        .filter((row) => row.mode === 'dist' && row.workers !== null)
        .map((row) => row.workers as number),
    ),
  ].sort((left, right) => left - right)

  const scalability: BenchmarkScalabilityPoint[] = workerValues.map((workers) => {
    const group = rows.filter((row) => row.mode === 'dist' && row.workers === workers)
    const throughputs = group.map((row) => {
      if (row.throughput !== null) return row.throughput
      if (row.size !== null && row.tTotal !== null && row.tTotal > 0) {
        return row.size / row.tTotal / 1_000_000
      }
      return null
    })
    return {
      workers,
      rows: group.length,
      medianTTotal: median(
        group.map((row) => row.tTotal).filter((value): value is number => value !== null),
      ),
      throughput: median(throughputs.filter((value): value is number => value !== null)),
    }
  })

  const phaseRows = rows.filter((row) => row.tTotal !== null).slice(-12)
  const phaseBreakdown: BenchmarkPhasePoint[] = phaseRows.map((row) => {
    const total = row.tTotal ?? 0
    return {
      label: `${row.mode}${row.workers !== null ? ` · W${row.workers}` : ''}${row.algo ? ` · ${row.algo}` : ''}`,
      sort: row.tPhase1 ?? Math.max(0, total - (row.tTier ?? 0) - (row.tMerge ?? 0)),
      tier: row.tTier ?? 0,
      merge: row.tMerge ?? 0,
      total,
    }
  })

  return {
    rows,
    rowCount: rows.length,
    modes,
    okCount,
    failCount,
    totalFailures,
    totalRequeued,
    bestThroughput: best(rows.map((row) => row.throughput)),
    medianTTotal: median(
      rows.map((row) => row.tTotal).filter((value): value is number => value !== null),
    ),
    maxRecoveryS,
    maxDetectS,
    byMode,
    scalability,
    phaseBreakdown,
  }
}
