import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createUser, listUsers } from '../../api/users'
import { PageShell } from '../../components/Layout'
import { Card, Eyebrow, FieldLabel } from '../../components/ui'
import { btn, field } from '../../components/styles'
import type { AppUser, Role } from '../../types'

const ROLE_LABEL: Record<Role, string> = { ADMIN: 'Administrator', USER: 'Attendant' }

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
      setError('Could not create that account. Check the email isn’t already in use.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageShell
      eyebrow="Configure"
      title="Staff accounts"
      intro="Attendants check vehicles in and out. Administrators also configure lots, floors and pricing. There is no self sign-up — every account is created here."
    >
      <Card>
        <ul className="divide-y divide-slate-100">
          {users.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{u.name}</p>
                <p className="truncate text-sm text-slate-500">{u.email}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] ${
                  u.role === 'ADMIN' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {ROLE_LABEL[u.role]}
              </span>
            </li>
          ))}
          {users.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-slate-400">No accounts yet.</li>
          )}
        </ul>
      </Card>

      <Card className="p-5">
        <Eyebrow className="mb-4">New account</Eyebrow>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <FieldLabel>Name</FieldLabel>
            <input required value={name} onChange={(e) => setName(e.target.value)} className={field} />
          </div>
          <div>
            <FieldLabel>Email</FieldLabel>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={field}
            />
          </div>
          <div>
            <FieldLabel>Temporary password</FieldLabel>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={field}
            />
          </div>
          <div>
            <FieldLabel>Role</FieldLabel>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={field}>
              <option value="USER">Attendant — checks vehicles in and out</option>
              <option value="ADMIN">Administrator — full configuration access</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={submitting} className={btn.primary}>
            Create account
          </button>
        </form>
      </Card>
    </PageShell>
  )
}
