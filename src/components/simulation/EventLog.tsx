import type { LogKind } from '../../types'
import { useSimulation } from '../../engine/SimulationProvider'

const KIND_DOT: Record<LogKind, string> = {
  system: 'bg-info',
  discovery: 'bg-sky-400',
  task: 'bg-accent',
  result: 'bg-ok',
  error: 'bg-bad',
}

export function EventLog({ limit = 12 }: { limit?: number }) {
  const { state } = useSimulation()
  const events = [...state.events].reverse().slice(0, limit)

  return (
    <div className="max-h-[300px] space-y-0 overflow-y-auto pr-1">
      {events.map((event) => (
        <div
          key={event.id}
          className="flex items-start gap-2.5 border-b border-line-soft/60 py-1.5 last:border-0"
        >
          <span className="w-12 shrink-0 pt-0.5 font-mono text-[9px] text-faint tabular-nums">
            {event.timeSec.toFixed(1)}s
          </span>
          <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${KIND_DOT[event.kind]}`} />
          <p className="text-[11px] leading-relaxed text-muted">{event.message}</p>
        </div>
      ))}
    </div>
  )
}
