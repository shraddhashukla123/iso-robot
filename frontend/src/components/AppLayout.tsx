import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'

const nav = [
  ['/', 'Dashboard'],
  ['/documents', 'Documents'],
  ['/controls', 'Controls'],
  ['/issues', 'Issues'],
  ['/classifications', 'Classifications'],
  ['/risk-discovery', 'Risk discovery'],
  ['/risk-library', 'Risk library'],
  ['/export', 'Export'],
] as const

export function AppLayout({
  toast,
  children,
}: {
  toast: string | null
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow)]">
        <div className="border-b border-[var(--color-border)] px-4 py-4">
          <Link to="/" className="text-lg font-semibold tracking-tight text-[var(--color-text)]">
            ISO-Robot
          </Link>
          <p className="mt-1 text-xs text-[var(--color-muted)]">ERM risk discovery</p>
        </div>
        <nav className="flex flex-col gap-0.5 p-2">
          {nav.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-100 text-[var(--color-accent)]'
                    : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-4 shadow-[var(--shadow)]">
          <h1 className="text-xl font-semibold text-slate-900">Operations</h1>
        </header>
        {toast ? (
          <div
            className="mx-8 mt-4 rounded-[var(--radius)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {toast}
          </div>
        ) : null}
        <main className="flex-1 overflow-auto p-8">{children}</main>
      </div>
    </div>
  )
}
