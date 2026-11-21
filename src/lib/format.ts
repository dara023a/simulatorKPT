export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—'
  return `${seconds.toFixed(1)}s`
}

export function truncateText(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1).trimEnd()}…`
}

const PHASE_LABELS: Record<string, string> = {
  ready: 'Ready',
  initialization: 'Initialization',
  discovery: 'Node Discovery',
  decomposition: 'Task Decomposition',
  distribution: 'Task Distribution',
  processing: 'Parallel Processing',
  aggregation: 'Result Aggregation',
  completed: 'Completed',
}

export function phaseLabel(phase: string): string {
  return PHASE_LABELS[phase] ?? phase
}
