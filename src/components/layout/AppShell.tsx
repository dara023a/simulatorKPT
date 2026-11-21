import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3,
  Database,
  LayoutDashboard,
  ListChecks,
  Network,
  PlayCircle,
} from 'lucide-react'
import { cx, Tag } from '../ui/Primitives'
import { phaseLabel } from '../../lib/format'
import { useSimulation } from '../../engine/SimulationProvider'

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/topology', label: 'Network Topology', icon: Network },
  { to: '/dataset', label: 'Dataset Explorer', icon: Database },
  { to: '/tasks', label: 'Task Distribution', icon: ListChecks },
  { to: '/simulation', label: 'Simulation', icon: PlayCircle },
  { to: '/results', label: 'Results', icon: BarChart3 },
]

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/': {
    title: 'Overview',
    subtitle: 'Master–Worker architecture for distributed text analytics',
  },
  '/topology': {
    title: 'Network Topology',
    subtitle: 'Click any simulated node to inspect its state and payload',
  },
  '/dataset': {
    title: 'Dataset Explorer',
    subtitle: 'Preview the local corpus and choose what the master will process',
  },
  '/tasks': {
    title: 'Task Distribution',
    subtitle: 'How the master decomposes documents and feeds the worker queue',
  },
  '/simulation': {
    title: 'Simulation',
    subtitle: 'Eight-phase walkthrough: discovery, distribution, processing, aggregation',
  },
  '/results': {
    title: 'Results & Analytics',
    subtitle: 'Aggregated word counts returned by every simulated worker',
  },
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-5 py-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10">
        <Network size={18} className="text-accent" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-mist">Distributed Text Analytics</p>
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
              All nodes, IP addresses, timings and analytics are simulated demo data. No real
              devices or CPU measurements are used.
            </p>
          </div>
          <div className="px-1 text-[9px] leading-relaxed tracking-wide text-faint/80">
            UAS · Komputasi Paralel &amp; Sistem Terdistribusi
            <br />
            v1.0 · Simulation build
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
          Distributed Text Analytics — Master–Worker Simulation · Interactive course demo.
          Metrics are labelled simulated results, not benchmarks.
        </footer>
      </div>
    </div>
  )
}
