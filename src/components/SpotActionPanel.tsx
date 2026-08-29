import { useState } from 'react'
import type { FormEvent } from 'react'
import { checkIn, checkout } from '../api/sessions'
import { SPOT_COLORS } from './FloorMap/spotColors'
import { FieldLabel } from './ui'
import { btn, field } from './styles'
import type { ParkingSession, PaymentMethod, RateType, Spot } from '../types'

const RATE_TYPES: RateType[] = ['HOURLY', 'NIGHT', 'DAY', 'MONTH']
const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'CARD', 'TRANSFER', 'OTHER']

const STATUS_LABEL: Record<Spot['status'], string> = {
  AVAILABLE: 'Open',
  OCCUPIED: 'Occupied',
  MAINTENANCE: 'Maintenance',
  DISABLED: 'Out of service',
}

interface SpotActionPanelProps {
  spot: Spot
  session: ParkingSession | null
  onClose: () => void
  onChanged: () => void
}

/**
 * The worker-facing panel, styled as a parking ticket: check a car in on an
 * open bay, or out on an occupied one.
 */
export function SpotActionPanel({ spot, session, onClose, onChanged }: SpotActionPanelProps) {
  return (
    <aside className="w-full shrink-0 border-t border-slate-200 bg-slate-50 p-4 md:w-[22rem] md:border-l md:border-t-0">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="ticket-perf h-3 w-full" />
        <div className="px-5 pb-3 pt-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">Bay</p>
              <h2 className="font-display text-xl font-semibold tracking-tight text-slate-900">
                {spot.code}
              </h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="-mr-1 -mt-1 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <span
              className="inline-block h-3 w-4 rounded-[3px] ring-1 ring-inset ring-white/70"
              style={{ backgroundColor: SPOT_COLORS[spot.status] }}
            />
            {STATUS_LABEL[spot.status]}
            <span className="ml-1 font-mono text-[11px] uppercase tracking-[0.1em] text-slate-400">
              {spot.vehicleType}
            </span>
          </span>
        </div>

        <div className="border-t border-dashed border-slate-300" />

        <div className="px-5 py-4">
          {spot.status === 'AVAILABLE' && <CheckInForm spot={spot} onChanged={onChanged} />}
          {spot.status === 'OCCUPIED' && session && (
            <CheckoutForm session={session} onChanged={onChanged} />
          )}
          {spot.status === 'OCCUPIED' && !session && (
            <p className="text-sm text-slate-400">Loading the active session…</p>
          )}
          {(spot.status === 'DISABLED' || spot.status === 'MAINTENANCE') && (
            <p className="text-sm leading-relaxed text-slate-500">
              This bay is marked {STATUS_LABEL[spot.status].toLowerCase()} and can't take a check-in.
              Change its status from the floor editor to reopen it.
            </p>
          )}
        </div>
      </div>
    </aside>
  )
}

function CheckInForm({ spot, onChanged }: { spot: Spot; onChanged: () => void }) {
  const [plateNumber, setPlateNumber] = useState('')
  const [rateType, setRateType] = useState<RateType | ''>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await checkIn({
        spotId: spot.id,
        plateNumber,
        rateType: rateType || undefined,
      })
      onChanged()
    } catch {
      setError('Could not check the vehicle in. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <FieldLabel>Plate number</FieldLabel>
        <input
          required
          autoFocus
          value={plateNumber}
          onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
          className={`${field} text-center font-mono text-lg font-semibold tracking-[0.25em] uppercase`}
          placeholder="AB123CD"
        />
      </div>
      <div>
        <FieldLabel>Rate</FieldLabel>
        <select
          value={rateType}
          onChange={(e) => setRateType(e.target.value as RateType | '')}
          className={field}
        >
          <option value="">Hourly — pay on the way out (default)</option>
          {RATE_TYPES.filter((t) => t !== 'HOURLY').map((t) => (
            <option key={t} value={t}>
              {t.charAt(0) + t.slice(1).toLowerCase()} offer
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={submitting} className={`${btn.go} w-full`}>
        {submitting ? 'Checking in…' : 'Check in'}
      </button>
    </form>
  )
}

function CheckoutForm({ session, onChanged }: { session: ParkingSession; onChanged: () => void }) {
  const [rateType, setRateType] = useState<RateType>(session.rateType)
  const [finalAmount, setFinalAmount] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await checkout(session.id, {
        rateType: rateType !== session.rateType ? rateType : undefined,
        finalAmount: finalAmount ? Number(finalAmount) : undefined,
        paymentMethod,
      })
      onChanged()
    } catch {
      setError('Could not check the vehicle out. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">Plate</p>
        <p className="font-mono text-xl font-semibold tracking-[0.2em] text-slate-900">
          {session.plateNumber}
        </p>
        <p className="mt-1 font-mono text-[11px] text-slate-400">
          In {new Date(session.checkInAt).toLocaleString()}
        </p>
      </div>
      <div>
        <FieldLabel>Rate</FieldLabel>
        <select
          value={rateType}
          onChange={(e) => setRateType(e.target.value as RateType)}
          className={field}
        >
          {RATE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0) + t.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </div>
      <div>
        <FieldLabel>Final amount</FieldLabel>
        <input
          type="number"
          min="0"
          step="0.01"
          value={finalAmount}
          onChange={(e) => setFinalAmount(e.target.value)}
          className={field}
          placeholder="Leave blank to use the computed price"
        />
      </div>
      <div>
        <FieldLabel>Payment method</FieldLabel>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
          className={field}
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {m.charAt(0) + m.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={submitting} className={`${btn.primary} w-full`}>
        {submitting ? 'Checking out…' : 'Check out'}
      </button>
    </form>
  )
}
