import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createUser, listUsers } from '../../api/users'
import type { AppUser, Role } from '../../types'

export function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('USER')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reload() {
    listUsers().then(setUsers)
  }

  useEffect(reload, [])

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await createUser({ name, email, password, role })
      setName('')
      setEmail('')
      setPassword('')
      setRole('USER')
      reload()
    } catch {
      setError('Could not create that account - check the email is not already in use')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-xl font-semibold text-slate-900">Staff accounts</h1>
      <p className="mb-4 text-sm text-slate-500">
        USER accounts are facility workers who can check any vehicle in the system in or out. ADMIN
        accounts configure lots, floors and pricing.
      </p>

      <ul className="mb-6 divide-y divide-slate-200 rounded border border-slate-200 bg-white">
        {users.map((u) => (
          <li key={u.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium text-slate-900">{u.name}</p>
              <p className="text-sm text-slate-500">{u.email}</p>
            </div>
            <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
              {u.role}
            </span>
          </li>
        ))}
        {users.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">No accounts yet.</li>}
      </ul>

      <form onSubmit={handleCreate} className="rounded border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">New account</h2>
        <div className="mb-3">
          <label className="mb-1 block text-sm text-slate-600">Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="mb-3">
          <label className="mb-1 block text-sm text-slate-600">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="mb-3">
          <label className="mb-1 block text-sm text-slate-600">Temporary password</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="mb-3">
          <label className="mb-1 block text-sm text-slate-600">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="USER">USER (facility worker)</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          Create account
        </button>
      </form>
    </div>
  )
}
