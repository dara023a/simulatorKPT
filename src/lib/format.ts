export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatCompact(value: number): string {
  const absolute = Math.abs(value)
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (absolute >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return formatNumber(Math.round(value))
}

export function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—'
  return `${seconds.toFixed(1)}s`
}

export function formatDuration(ticks: number): string {
  return `${(ticks * 0.7).toFixed(1)}s`
}

export function truncateText(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1).trimEnd()}…`
}

const PHASE_LABELS: Record<string, string> = {
  ready: 'Ready',
  initialization: 'Initialization',
  discovery: 'Node Discovery',
  decomposition: 'Chunk Decomposition',
  distribution: 'Task Distribution',
  processing: 'Parallel Sorting',
  aggregation: 'Merge & Verify',
  completed: 'Completed',
}

export function phaseLabel(phase: string): string {
  return PHASE_LABELS[phase] ?? phase
}

export function scheduleLabel(value: string): string {
  return value === 'static' ? 'Static · owner assigned' : 'Dynamic · pull queue'
}

export function mergeLabel(value: string): string {
  return value === 'tiered' ? 'Tiered · worker + master' : 'Master · final merge tree'
}
