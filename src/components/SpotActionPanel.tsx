import { useState } from 'react'
import type { FormEvent } from 'react'
import { checkIn, checkout } from '../api/sessions'
import type { ParkingSession, PaymentMethod, RateType, Spot } from '../types'

const RATE_TYPES: RateType[] = ['HOURLY', 'NIGHT', 'DAY', 'MONTH']
const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'CARD', 'TRANSFER', 'OTHER']

interface SpotActionPanelProps {
  spot: Spot
  session: ParkingSession | null
  onClose: () => void
  onChanged: () => void
}

/** The worker-facing panel: check a car in on an AVAILABLE spot, or out on an OCCUPIED one. */
export function SpotActionPanel({ spot, session, onClose, onChanged }: SpotActionPanelProps) {
  return (
    <aside className="w-80 shrink-0 border-l border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Spot {spot.code}</h2>
        <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-600">
          Close
        </button>
      </div>
      {spot.status === 'AVAILABLE' && <CheckInForm spot={spot} onChanged={onChanged} />}
      {spot.status === 'OCCUPIED' && session && (
        <CheckoutForm session={session} onChanged={onChanged} />
      )}
      {spot.status === 'OCCUPIED' && !session && (
        <p className="text-sm text-slate-500">Loading session...</p>
      )}
      {(spot.status === 'DISABLED' || spot.status === 'MAINTENANCE') && (
        <p className="text-sm text-slate-500">
          This spot is marked {spot.status.toLowerCase()} and isn't available for check-in.
        </p>
      )}
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
      setError('Could not check the vehicle in - please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="mb-1 block text-sm text-slate-600">Plate number</label>
        <input
          required
          autoFocus
          value={plateNumber}
          onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm uppercase"
          placeholder="AB123CD"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-600">
          Rate (leave blank for hourly, the default)
        </label>
        <select
          value={rateType}
          onChange={(e) => setRateType(e.target.value as RateType | '')}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Hourly (pay on the way out)</option>
          {RATE_TYPES.filter((t) => t !== 'HOURLY').map((t) => (
            <option key={t} value={t}>
              {t.charAt(0) + t.slice(1).toLowerCase()} offer
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
      >
        {submitting ? 'Checking in...' : 'Check in'}
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
      setError('Could not check the vehicle out - please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-sm text-slate-700">
        Plate <span className="font-mono font-semibold">{session.plateNumber}</span>
      </p>
      <p className="text-xs text-slate-500">
        Checked in {new Date(session.checkInAt).toLocaleString()}
      </p>
      <div>
        <label className="mb-1 block text-sm text-slate-600">Rate</label>
        <select
          value={rateType}
          onChange={(e) => setRateType(e.target.value as RateType)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        >
          {RATE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0) + t.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-600">
          Final amount (leave blank to use the computed price)
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={finalAmount}
          onChange={(e) => setFinalAmount(e.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Auto-computed at checkout"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-600">Payment method</label>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {m.charAt(0) + m.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        {submitting ? 'Checking out...' : 'Check out'}
      </button>
    </form>
  )
}
