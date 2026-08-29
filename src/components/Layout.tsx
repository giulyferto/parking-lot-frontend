import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-slate-900">Parking Lot</span>
          <nav className="flex gap-4 text-sm">
            <Link to="/" className="text-slate-600 hover:text-slate-900">
              Map
            </Link>
            {user?.role === 'ADMIN' && (
              <>
                <Link to="/admin/parking-lots" className="text-slate-600 hover:text-slate-900">
                  Parking lots
                </Link>
                <Link to="/admin/users" className="text-slate-600 hover:text-slate-900">
                  Staff accounts
                </Link>
              </>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span>
            {user?.name} <span className="text-slate-400">({user?.role})</span>
          </span>
          <button
            onClick={logout}
            className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
          >
            Log out
          </button>
        </div>
      </header>
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
