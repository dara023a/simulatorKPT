import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3,
  Database,
  LayoutDashboard,
  ListChecks,
  ListOrdered,
  Network,
  PlayCircle,
} from 'lucide-react'
import { cx, Tag } from '../ui/Primitives'
import { mergeLabel, phaseLabel, scheduleLabel } from '../../lib/format'
import { useSimulation } from '../../engine/SimulationProvider'

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/topology', label: 'Network Topology', icon: Network },
  { to: '/dataset', label: 'Dataset & Benchmarks', icon: Database },
  { to: '/tasks', label: 'Task Distribution', icon: ListChecks },
  { to: '/simulation', label: 'Simulation', icon: PlayCircle },
  { to: '/results', label: 'Results', icon: BarChart3 },
]

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/': {
    title: 'Overview',
    subtitle: 'Master–Worker architecture for distributed sorting',
  },
  '/topology': {
    title: 'Network Topology',
    subtitle: 'Klik node simulasi untuk melihat chunk, core, progress, dan checksum',
  },
  '/dataset': {
    title: 'Dataset & Benchmarks',
    subtitle: 'Array input deterministik dan import results.csv dari eksekusi Python',
  },
  '/tasks': {
    title: 'Task Distribution',
    subtitle: 'Bagaimana master memecah array dan mengisi antrean worker',
  },
  '/simulation': {
    title: 'Simulation',
    subtitle: 'Delapan fase: discovery, chunking, parallel sort, return, merge, verify',
  },
  '/results': {
    title: 'Results & Analytics',
    subtitle: 'Sorted output, kontribusi worker, merge tree, dan benchmark Python',
  },
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-5 py-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10">
        <ListOrdered size={18} className="text-accent" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-mist">Distributed Sorting</p>
        <p className="text-[10px] tracking-wide text-faint">Master–Worker Simulation</p>
      </div>
    </div>
  )
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            cx(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-medium transition',
              isActive
                ? 'border border-cyan-500/20 bg-cyan-500/10 text-cyan-200'
                : 'border border-transparent text-muted hover:bg-ink-850 hover:text-mist',
            )
          }
        >
          <item.icon size={15} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

export function AppShell() {
  const location = useLocation()
  const { state } = useSimulation()
  const meta = PAGE_META[location.pathname] ?? PAGE_META['/']

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[262px] shrink-0 flex-col border-r border-line bg-ink-925/75 lg:flex">
        <Brand />
        <div className="px-5 pb-2">
          <p className="text-[9px] font-semibold tracking-[0.16em] text-faint uppercase">Workspace</p>
        </div>
        <NavItems />
        <div className="mt-auto space-y-3 px-4 pb-6">
          <div className="rounded-lg border border-line bg-ink-900 p-3">
            <div className="flex items-center gap-2 text-[11px] font-medium text-accent">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              Simulation Mode
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-faint">
              Node, IP, timing, dan sorting dijalankan di browser. results.csv yang diimpor adalah
              metrik nyata dari eksekusi Python Anda.
            </p>
            <div className="mt-2.5 grid gap-1 border-t border-line-soft pt-2 text-[9px] text-faint">
              <div className="flex items-center justify-between gap-2">
                <span>Workers</span>
                <span className="font-mono text-muted">{state.settings.workerCount}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Schedule</span>
                <span className="truncate font-mono text-muted">{scheduleLabel(state.settings.schedule)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Merge</span>
                <span className="truncate font-mono text-muted">{mergeLabel(state.settings.mergeMode)}</span>
              </div>
            </div>
          </div>
          <div className="px-1 text-[9px] leading-relaxed tracking-wide text-faint/80">
            UAS · Komputasi Paralel &amp; Sistem Terdistribusi
            <br />
            v2.0 · Distributed sorting build
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-ink-950/90 backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-4 py-3 lg:px-8">
            <div className="min-w-0">
              <p className="text-[9px] font-medium tracking-[0.18em] text-faint uppercase">
                Master–Worker Simulation / {meta.title}
              </p>
              <h1 className="mt-0.5 truncate text-base font-semibold text-mist">{meta.title}</h1>
              <p className="hidden truncate text-[11px] text-faint sm:block">{meta.subtitle}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Tag tone="cyan" className="hidden sm:inline-flex">
                Demo Data
              </Tag>
              <Tag tone={state.phase === 'completed' ? 'emerald' : state.running ? 'cyan' : 'slate'}>
                <span
                  className={cx(
                    'h-1.5 w-1.5 rounded-full',
                    state.phase === 'completed'
                      ? 'bg-emerald-400'
                      : state.running
                        ? 'animate-pulse bg-cyan-400'
                        : 'bg-slate-500',
                  )}
                />
                {phaseLabel(state.phase)}
              </Tag>
            </div>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto px-3 pb-2 lg:hidden">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cx(
                    'flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium whitespace-nowrap transition',
                    isActive ? 'bg-cyan-500/10 text-cyan-200' : 'text-muted hover:bg-ink-850',
                  )
                }
              >
                <item.icon size={13} />
                {item.label}
              </NavLink>
            ))}
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-5 pb-16 lg:px-8">
          <Outlet />
        </main>

        <footer className="border-t border-line px-4 py-4 text-[10px] text-faint lg:px-8">
          Distributed Sorting — Master–Worker Simulation · Interactive course demo. Simulated
          timings are labelled; imported Python benchmark rows remain measurement data.
        </footer>
      </div>
    </div>
  )
}
