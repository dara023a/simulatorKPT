import { Check, ChevronRight } from 'lucide-react'
import { useSimulation } from '../../engine/SimulationProvider'
import { cx } from '../ui/Primitives'

const STAGES = [
  {
    title: 'Initialization',
    description: 'Master memuat array input; seluruh worker masih idle.',
  },
  {
    title: 'Node Discovery',
    description:
      'Master mengirim probe discovery UDP simulasi; setiap worker menjawab dengan hostname, IP, dan jumlah core.',
  },
  {
    title: 'Chunk Decomposition',
    description:
      'Master memecah array menjadi chunk. Static memakai satu chunk per worker; dynamic memakai beberapa chunk per worker.',
  },
  {
    title: 'Task Distribution',
    description:
      'Chunk bergerak dari master ke worker. Dynamic scheduler mengisi worker yang bebas dari antrean.',
  },
  {
    title: 'Parallel Sorting',
    description:
      'Setiap worker membagi chunk ke beberapa local run sesuai core, menyortir run secara paralel, lalu merge lokal.',
  },
  {
    title: 'Result Return',
    description:
      'Worker mengirim sorted run beserta checksum kembali ke master.',
  },
  {
    title: 'Merge & Verify',
    description:
      'Master membangun merge tree (langsung atau tiered). Hasil dicek harus terurut dan checksum-nya sama.',
  },
  {
    title: 'Completed',
    description: 'Sorted output final tersedia di halaman Results.',
  },
]

function currentStage(phase: string, returning: boolean, sorting: boolean): number {
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
      return returning && !sorting ? 5 : 4
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
  const sorting = state.workers.some((worker) =>
    ['receiving', 'processing', 'merging'].includes(worker.status),
  )
  const active = currentStage(state.phase, returning, sorting)

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
            ? 'Tekan Play atau Step untuk menjalani delapan fase sorting. Setiap tick deterministik dan dapat diulang.'
            : STAGES[active].description}
        </p>
      </div>
    </div>
  )
}
