import { useState } from 'react'
import type { FormEvent } from 'react'
import { createRatePlan } from '../../../api/ratePlans'
import { Eyebrow } from '../../../components/ui'
import { btn, field } from '../../../components/styles'
import type { RatePlan, VehicleType } from '../../../types'
import { VEHICLE_TYPES } from './constants'

export function RatePlansEditor({
  floorId,
  ratePlans,
  onCreated,
}: {
  floorId: string
  ratePlans: RatePlan[]
  onCreated: () => void
}) {
  const [vehicleType, setVehicleType] = useState<VehicleType>('CAR')
  const [hourlyRate, setHourlyRate] = useState('')
  const [nightRate, setNightRate] = useState('')
  const [dayRate, setDayRate] = useState('')
  const [monthRate, setMonthRate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await createRatePlan(floorId, {
        vehicleType,
        hourlyRate: Number(hourlyRate),
        nightRate: nightRate ? Number(nightRate) : undefined,
        dayRate: dayRate ? Number(dayRate) : undefined,
        monthRate: monthRate ? Number(monthRate) : undefined,
      })
      setHourlyRate('')
      setNightRate('')
      setDayRate('')
      setMonthRate('')
      onCreated()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <Eyebrow className="mb-3">Rate plans</Eyebrow>
      <ul className="mb-3 space-y-1.5">
        {ratePlans.map((plan) => (
          <li
            key={plan.id}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600"
          >
            <span className="font-mono font-semibold uppercase tracking-[0.1em] text-slate-800">
              {plan.vehicleType}
            </span>{' '}
            — hourly {plan.currency} {plan.hourlyRate}
            {plan.nightRate ? `, night ${plan.nightRate}` : ''}
            {plan.dayRate ? `, day ${plan.dayRate}` : ''}
            {plan.monthRate ? `, month ${plan.monthRate}` : ''}
          </li>
        ))}
        {ratePlans.length === 0 && (
          <li className="text-xs text-slate-400">No rate plans yet.</li>
        )}
      </ul>
      <form onSubmit={handleSubmit} className="space-y-2">
        <select
          value={vehicleType}
          onChange={(e) => setVehicleType(e.target.value as VehicleType)}
          className={field}
        >
          {VEHICLE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          required
          type="number"
          min="0"
          step="0.01"
          value={hourlyRate}
          onChange={(e) => setHourlyRate(e.target.value)}
          placeholder="Hourly rate (required)"
          className={field}
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={nightRate}
          onChange={(e) => setNightRate(e.target.value)}
          placeholder="Night rate (optional)"
          className={field}
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={dayRate}
          onChange={(e) => setDayRate(e.target.value)}
          placeholder="Day rate (optional)"
          className={field}
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={monthRate}
          onChange={(e) => setMonthRate(e.target.value)}
          placeholder="Month rate (optional)"
          className={field}
        />
        <button type="submit" disabled={submitting} className={`${btn.primary} w-full`}>
          Add rate plan
        </button>
      </form>
    </div>
  )
}
