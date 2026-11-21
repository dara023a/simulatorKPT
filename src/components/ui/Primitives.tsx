import type { ReactNode } from 'react'
import { Info, TriangleAlert, X } from 'lucide-react'
import type { NodeStatus, TaskStatus } from '../../types'

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}

const NODE_STATUS_META: Record<NodeStatus, { label: string; badge: string; dot: string }> = {
  idle: {
    label: 'Idle',
    badge: 'border-slate-700/70 bg-slate-800/40 text-slate-300',
    dot: 'bg-slate-500',
  },
  discovering: {
    label: 'Discovering',
    badge: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
    dot: 'bg-sky-400',
  },
  registered: {
    label: 'Registered',
    badge: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    dot: 'bg-blue-400',
  },
  receiving: {
    label: 'Receiving Chunk',
    badge: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    dot: 'bg-cyan-400',
  },
  processing: {
    label: 'Sorting',
    badge: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200',
    dot: 'bg-cyan-300',
  },
  merging: {
    label: 'Merging Runs',
    badge: 'border-violet-400/30 bg-violet-400/10 text-violet-300',
    dot: 'bg-violet-400',
  },
  returning: {
    label: 'Returning Result',
    badge: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    dot: 'bg-amber-400',
  },
  completed: {
    label: 'Completed',
    badge: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    dot: 'bg-emerald-400',
  },
  failed: {
    label: 'Failed',
    badge: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
    dot: 'bg-rose-400',
  },
}

const TASK_STATUS_META: Record<TaskStatus, { label: string; badge: string; dot: string }> = {
  queued: {
    label: 'Queued',
    badge: 'border-slate-700/70 bg-slate-800/40 text-slate-300',
    dot: 'bg-slate-500',
  },
  assigned: {
    label: 'Assigned',
    badge: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    dot: 'bg-blue-400',
  },
  processing: {
    label: 'Sorting',
    badge: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200',
    dot: 'bg-cyan-300',
  },
  returned: {
    label: 'Returned',
    badge: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    dot: 'bg-amber-400',
  },
  merged: {
    label: 'Merged',
    badge: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    dot: 'bg-emerald-400',
  },
}

function Badge({
  label,
  badge,
  dot,
  pulse,
}: {
  label: string
  badge: string
  dot: string
  pulse?: boolean
}) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap',
        badge,
      )}
    >
      <span className={cx('h-1.5 w-1.5 rounded-full', dot, pulse && 'animate-pulse')} />
      {label}
    </span>
  )
}

export function StatusBadge({ status }: { status: NodeStatus }) {
  const meta = NODE_STATUS_META[status]
  return (
    <Badge
      label={meta.label}
      badge={meta.badge}
      dot={meta.dot}
      pulse={
        status === 'receiving' ||
        status === 'processing' ||
        status === 'merging' ||
        status === 'returning' ||
        status === 'discovering'
      }
    />
  )
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const meta = TASK_STATUS_META[status]
  return (
    <Badge
      label={meta.label}
      badge={meta.badge}
      dot={meta.dot}
      pulse={status === 'processing' || status === 'assigned'}
    />
  )
}

export function nodeStatusLabel(status: NodeStatus): string {
  return NODE_STATUS_META[status].label
}

type TagTone = 'slate' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'blue'

const TAG_TONES: Record<TagTone, string> = {
  slate: 'border-slate-700/70 bg-slate-800/40 text-slate-300',
  cyan: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  emerald: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  amber: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  rose: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
  blue: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
}

export function Tag({
  children,
  tone = 'slate',
  className,
}: {
  children: ReactNode
  tone?: TagTone
  className?: string
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap',
        TAG_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName = 'p-5',
}: {
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cx('overflow-hidden rounded-xl border border-line bg-ink-900/70', className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-5 py-3.5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-mist">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[11px] leading-relaxed text-faint">{subtitle}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

export function Stat({
  label,
  value,
  unit,
  hint,
  accent,
  className,
}: {
  label: string
  value: ReactNode
  unit?: string
  hint?: string
  accent?: boolean
  className?: string
}) {
  return (
    <div className={cx('rounded-xl border border-line bg-ink-900/60 px-4 py-3.5', className)}>
      <p className="text-[10px] font-medium tracking-[0.12em] text-faint uppercase">{label}</p>
      <div className="mt-1 flex items-baseline gap-1">
        <span
          className={cx(
            'text-xl font-semibold tracking-tight tabular-nums xl:text-[22px]',
            accent ? 'text-accent' : 'text-mist',
          )}
        >
          {value}
        </span>
        {unit && <span className="text-xs text-faint">{unit}</span>}
      </div>
      {hint && <p className="mt-0.5 text-[11px] text-faint">{hint}</p>}
    </div>
  )
}

const PROGRESS_TONES = {
  cyan: 'bg-accent',
  blue: 'bg-info',
  amber: 'bg-warn',
  emerald: 'bg-ok',
  rose: 'bg-bad',
  slate: 'bg-slate-600',
} as const

export type ProgressTone = keyof typeof PROGRESS_TONES

export function ProgressBar({
  value,
  tone = 'cyan',
  className,
  height = 'h-1.5',
}: {
  value: number
  tone?: ProgressTone
  className?: string
  height?: string
}) {
  const safe = Math.max(0, Math.min(100, value))
  return (
    <div className={cx('w-full overflow-hidden rounded-full bg-ink-700/80', height, className)}>
      <div
        className={cx('h-full rounded-full transition-[width] duration-300 ease-out', PROGRESS_TONES[tone])}
        style={{ width: `${safe}%` }}
      />
    </div>
  )
}

export function Note({
  children,
  tone = 'info',
  title,
  className,
}: {
  children: ReactNode
  tone?: 'info' | 'warning' | 'neutral'
  title?: string
  className?: string
}) {
  const styles = {
    info: 'border-cyan-500/20 bg-cyan-500/[0.06] text-cyan-100/80',
    warning: 'border-amber-400/25 bg-amber-400/[0.06] text-amber-100/80',
    neutral: 'border-line bg-ink-850 text-muted',
  }[tone]
  const Icon = tone === 'warning' ? TriangleAlert : Info
  return (
    <div className={cx('flex gap-2.5 rounded-lg border px-3.5 py-3 text-[11px] leading-relaxed', styles, className)}>
      <Icon size={14} className="mt-0.5 shrink-0 opacity-80" />
      <div>
        {title && <p className="mb-0.5 text-[11px] font-semibold text-mist">{title}</p>}
        {children}
      </div>
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line px-4 py-10 text-center">
      <p className="text-sm font-medium text-muted">{title}</p>
      {hint && <p className="max-w-md text-[11px] leading-relaxed text-faint">{hint}</p>}
    </div>
  )
}

export function DrawerShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  onClose?: () => void
  children: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-ink-900/85">
      <header className="flex items-start justify-between gap-3 border-b border-line-soft px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-mist">{title}</h2>
          {subtitle && <p className="mt-0.5 truncate font-mono text-[10px] text-faint">{subtitle}</p>}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-line p-1 text-faint transition hover:border-line hover:bg-ink-800 hover:text-mist"
            aria-label="Close details"
          >
            <X size={14} />
          </button>
        )}
      </header>
      <div className="p-4">{children}</div>
    </div>
  )
}

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line-soft/70 py-2 last:border-0">
      <span className="text-[11px] text-faint">{label}</span>
      <span className="text-right text-[11px] font-medium text-mist">{value}</span>
    </div>
  )
}
