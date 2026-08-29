import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { BayMark, FieldLabel } from '../components/ui'
import { btn, field } from '../components/styles'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch {
      setError('That email and password don’t match. Check them and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bay-field flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <BayMark tone="light" className="h-12 w-12" />
          <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight text-white">
            Parking Lot Ops
          </h1>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-blue-200/70">
            Attendant sign-in
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/10 bg-white p-6 shadow-2xl shadow-slate-950/30"
        >
          <div className="mb-4">
            <FieldLabel>Email</FieldLabel>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={field}
            />
          </div>
          <div className="mb-5">
            <FieldLabel>Password</FieldLabel>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={field}
            />
          </div>
          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={submitting} className={`${btn.primary} w-full`}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="mt-4 text-center text-xs leading-relaxed text-slate-400">
            Accounts are created by an administrator from the Staff accounts page.
          </p>
        </form>
      </div>
    </div>
  )
}
