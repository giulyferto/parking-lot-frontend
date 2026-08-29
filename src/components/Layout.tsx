import { useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { BayMark } from './ui'

type IconProps = { className?: string }

function MapIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M9 3 3.5 5.2v15.3L9 18.3l6 2.5 5.5-2.2V3.3L15 5.5 9 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9 3v15.3M15 5.5v15.3" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

function LotsIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 20V9h4.2a3 3 0 0 1 0 6H9" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

function StaffIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.8 19c.7-3 2.7-4.6 5.2-4.6S13.5 16 14.2 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M15.5 5.6A2.8 2.8 0 0 1 17 11m1.2 7.6c-.3-2-1.1-3.4-2.4-4.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

const navLinkBase =
  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `${navLinkBase} ${
    isActive ? 'bg-white/10 text-white' : 'text-blue-100/70 hover:bg-white/5 hover:text-white'
  }`
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth()
  const initials =
    user?.name
      ?.split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() ?? '--'

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
        <BayMark tone="light" className="h-9 w-9" />
        <div className="leading-tight">
          <p className="font-display text-[15px] font-semibold tracking-tight text-white">Parking Lot Ops</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-blue-200/60">Live deck control</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        <p className="px-3 pb-1 pt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-blue-200/45">
          Floor
        </p>
        <NavLink to="/" end className={navLinkClass} onClick={onNavigate}>
          <MapIcon />
          Live map
        </NavLink>
        {user?.role === 'ADMIN' && (
          <>
            <p className="px-3 pb-1 pt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-blue-200/45">
              Configure
            </p>
            <NavLink to="/admin/parking-lots" className={navLinkClass} onClick={onNavigate}>
              <LotsIcon />
              Parking lots
            </NavLink>
            <NavLink to="/admin/users" className={navLinkClass} onClick={onNavigate}>
              <StaffIcon />
              Staff accounts
            </NavLink>
          </>
        )}
      </nav>

      <div className="m-3 rounded-xl bg-white/[0.06] p-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-500 font-mono text-xs font-semibold text-white">
            {initials}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium text-white">{user?.name}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-blue-200/60">
              {user?.role === 'ADMIN' ? 'Administrator' : 'Attendant'}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="mt-2.5 w-full rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100/80 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
        >
          Log out
        </button>
      </div>
    </div>
  )
}

export function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      {/* Persistent sidebar, md and up */}
      <aside className="hidden w-60 shrink-0 bg-gradient-to-b from-blue-900 to-slate-900 md:block">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-64 bg-gradient-to-b from-blue-900 to-slate-900 shadow-xl">
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5 md:hidden">
          <button
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <span className="font-display text-sm font-semibold tracking-tight">Parking Lot Ops</span>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

/** Shared page wrapper for the form-style admin pages. */
export function PageShell({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string
  title: string
  intro?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
        {eyebrow}
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      {intro && <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-500">{intro}</p>}
      <div className="mt-6 space-y-6">{children}</div>
    </div>
  )
}
