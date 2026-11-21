import { Check, ChevronRight } from 'lucide-react'
import { useSimulation } from '../../engine/SimulationProvider'
import { cx } from '../ui/Primitives'

const STAGES = [
  {
    title: 'Initialization',
    description: 'Master starts, the dataset is loaded, and every worker remains idle.',
  },
  {
    title: 'Node Discovery',
    description:
      'Master broadcasts discovery probes in the LAN model; each worker answers and registers with its simulated hostname, IP and core count.',
  },
  {
    title: 'Task Decomposition',
    description:
      'Master preprocesses the dataset and splits document indexes into fixed-size tasks.',
  },
  {
    title: 'Task Distribution',
    description:
      'Tasks move over the simulated links. The master keeps a queue and fills free workers from it.',
  },
  {
    title: 'Parallel Processing',
    description:
      'Workers count word frequencies, unique words and document totals at the same time. Simulated cores affect task duration.',
  },
  {
    title: 'Result Return',
    description:
      'Each worker returns a compact JSON-style result payload containing its merged word Counter.',
  },
  {
    title: 'Result Aggregation',
    description:
      'Master merges every worker Counter into one combined frequency table. Merging is additive and deterministic.',
  },
  {
    title: 'Completed',
    description:
      'All documents are processed and the final text analytics are available in Results.',
  },
]

function currentStage(phase: string, returning: boolean): number {
  switch (phase) {
    case 'ready':
      return -1
    case 'initialization':
      return 0
    case 'discovery':
      return 1
    case 'decomposition':
      return 2
    case 'distribution':
      return 3
    case 'processing':
      return returning ? 5 : 4
    case 'aggregation':
      return 6
    case 'completed':
      return 7
    default:
      return -1
  }
}

export function PhaseStrip() {
  const { state } = useSimulation()
  const returning = state.workers.some((worker) => worker.status === 'returning')
  const active = currentStage(state.phase, returning)

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {STAGES.map((stage, index) => {
          const isDone = active > index
          const isActive = active === index
          return (
            <div
              key={stage.title}
              className={cx(
                'rounded-lg border px-2.5 py-2 transition-colors',
                isActive
                  ? 'border-cyan-500/40 bg-cyan-500/10'
                  : isDone
                    ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
                    : 'border-line-soft bg-ink-850/50',
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cx(
                    'font-mono text-[9px]',
                    isActive ? 'text-accent' : isDone ? 'text-emerald-400/80' : 'text-faint',
                  )}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                {isDone ? (
                  <Check size={11} className="text-emerald-400" />
                ) : isActive ? (
                  <ChevronRight size={11} className="text-accent" />
                ) : null}
              </div>
              <p
                className={cx(
                  'mt-1 text-[10px] leading-tight font-medium',
                  isActive ? 'text-cyan-100' : isDone ? 'text-emerald-100/70' : 'text-muted',
                )}
              >
                {stage.title}
              </p>
            </div>
          )
        })}
      </div>

      <div className="mt-3 rounded-lg border border-line-soft bg-ink-850/60 px-3 py-2.5">
        <p className="text-[10px] font-semibold tracking-[0.12em] text-accent uppercase">
          {active < 0 ? 'Waiting to start' : `Phase ${active + 1} — ${STAGES[active].title}`}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          {active < 0
            ? 'Press Play or Step to walk through the eight simulation phases. Every tick is deterministic and repeatable.'
            : STAGES[active].description}
        </p>
      </div>
    </div>
  )
}
