import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react'
import type { Speed } from '../../types'
import { useSimulation } from '../../engine/SimulationProvider'
import { cx } from '../ui/Primitives'
import { formatSeconds } from '../../lib/format'

const SPEEDS: Speed[] = [0.5, 1, 2, 4]

const primaryButton =
  'inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-200 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-40'
const secondaryButton =
  'inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-850 px-3 py-2 text-xs font-medium text-muted transition hover:border-line hover:bg-ink-800 hover:text-mist disabled:cursor-not-allowed disabled:opacity-40'

export function SimulationControls() {
  const { state, stats, play, pause, step, reset, setSpeed } = useSimulation()
  const finished = state.phase === 'completed'

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={state.running ? pause : play}
          disabled={finished}
          className={primaryButton}
        >
          {state.running ? <Pause size={14} /> : <Play size={14} />}
          {state.running ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          onClick={step}
          disabled={state.running || finished}
          className={secondaryButton}
          title="Advance exactly one simulation tick"
        >
          <SkipForward size={14} />
          Step
        </button>
        <button type="button" onClick={reset} className={secondaryButton}>
          <RotateCcw size={14} />
          Reset
        </button>

        <div className="ml-1 flex items-center overflow-hidden rounded-lg border border-line bg-ink-850">
          <span className="px-2 text-[10px] tracking-wide text-faint uppercase">Speed</span>
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              type="button"
              onClick={() => setSpeed(speed)}
              className={cx(
                'border-l border-line px-2 py-2 text-[11px] font-medium transition',
                state.speed === speed
                  ? 'bg-cyan-500/10 text-cyan-200'
                  : 'text-faint hover:bg-ink-800 hover:text-mist',
              )}
            >
              {speed}×
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 text-[10px] text-faint">
        <span className="inline-flex items-center gap-1.5">
          <span
            className={cx(
              'h-1.5 w-1.5 rounded-full',
              finished ? 'bg-emerald-400' : state.running ? 'animate-pulse bg-cyan-400' : 'bg-slate-500',
            )}
          />
          {finished ? 'Finished' : state.running ? 'Running' : state.phase === 'ready' ? 'Ready' : 'Paused'}
        </span>
        <span className="font-mono tabular-nums">
          tick {state.tick} · {formatSeconds(stats.simulatedSeconds)} simulated
        </span>
      </div>
    </div>
  )
}
