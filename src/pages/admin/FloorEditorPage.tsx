import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getFloor } from '../../api/floors'
import { createSpot, deleteSpot, listSpots, updateSpotLayout, updateSpotStatus } from '../../api/spots'
import { createRatePlan, listRatePlans } from '../../api/ratePlans'
import { FloorMap } from '../../components/FloorMap/FloorMap'
import { SPOT_COLORS } from '../../components/FloorMap/spotColors'
import { Eyebrow } from '../../components/ui'
import { btn, field } from '../../components/styles'
import type { Floor, RatePlan, Spot, SpotStatus, VehicleType } from '../../types'

const VEHICLE_TYPES: VehicleType[] = ['CAR', 'MOTORCYCLE', 'EV', 'HANDICAP']

/**
 * The admin's drag-and-drop canvas editor: drag a bay to reposition it
 * (FloorMap's onSpotDragEnd -> PATCH .../layout), and use the side panel to
 * set its size/rotation/status precisely or add a brand new bay. Rate plans
 * for this floor are managed further down the same panel since both are
 * floor-level admin tasks.
 */
export function FloorEditorPage() {
  const { floorId } = useParams<{ floorId: string }>()
  const [floor, setFloor] = useState<Floor | null>(null)
  const [spots, setSpots] = useState<Spot[]>([])
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([])
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null)

  function reload() {
    if (!floorId) return
    getFloor(floorId).then(setFloor)
    listSpots(floorId).then(setSpots)
    listRatePlans(floorId).then(setRatePlans)
  }

  useEffect(reload, [floorId])

  async function handleDragEnd(spot: Spot, posX: number, posY: number) {
    await updateSpotLayout(spot.id, {
      posX,
      posY,
      width: spot.width,
      height: spot.height,
      rotation: spot.rotation,
    })
    reload()
  }

  if (!floor) {
    return <div className="px-6 py-6 font-mono text-xs uppercase tracking-[0.16em] text-slate-400">Loading…</div>
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <Link
          to={`/admin/parking-lots/${floor.parkingLotId}`}
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          ← Back to floors
        </Link>
        <h1 className="mt-0.5 font-display text-xl font-semibold tracking-tight text-slate-900">
          {floor.name}
          <span className="ml-2 font-mono text-xs uppercase tracking-[0.16em] text-slate-400">
            Layout &amp; rates
          </span>
        </h1>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
        <div className="min-h-[55vh] min-w-0 p-4 md:min-h-0 md:flex-1 sm:p-6">
          <div className="deck-grid h-full min-h-[24rem] w-full overflow-hidden rounded-xl border border-slate-200 md:min-h-0">
            {spots.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-1 p-6 text-center">
                <p className="text-sm font-medium text-slate-600">No bays yet</p>
                <p className="text-sm text-slate-400">
                  Add one from the panel on the right, then drag it into place.
                </p>
              </div>
            ) : (
              <FloorMap
                spots={spots}
                selectedSpotId={selectedSpot?.id}
                onSpotClick={setSelectedSpot}
                onSpotDragEnd={handleDragEnd}
              />
            )}
          </div>
        </div>

        <aside className="w-full shrink-0 space-y-5 border-t border-slate-200 bg-white p-5 md:w-96 md:overflow-y-auto md:border-l md:border-t-0">
          <AddSpotForm floorId={floor.id} onCreated={reload} />
          <hr className="border-slate-100" />
          {selectedSpot ? (
            <SpotEditor
              key={selectedSpot.id}
              spot={selectedSpot}
              onClose={() => setSelectedSpot(null)}
              onChanged={reload}
            />
          ) : (
            <p className="text-sm text-slate-400">Click a bay to edit its size, rotation or status.</p>
          )}
          <hr className="border-slate-100" />
          <RatePlansEditor floorId={floor.id} ratePlans={ratePlans} onCreated={reload} />
        </aside>
      </div>
    </div>
  )
}

function AddSpotForm({ floorId, onCreated }: { floorId: string; onCreated: () => void }) {
  const [code, setCode] = useState('')
  const [vehicleType, setVehicleType] = useState<VehicleType>('CAR')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await createSpot(floorId, { code, vehicleType })
      setCode('')
      onCreated()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Eyebrow className="mb-3">Add bay</Eyebrow>
      <div className="mb-2 flex gap-2">
        <input
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Code, e.g. A-01"
          className={field}
        />
        <select
          value={vehicleType}
          onChange={(e) => setVehicleType(e.target.value as VehicleType)}
          className={`${field} w-auto`}
        >
          {VEHICLE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={submitting} className={`${btn.ghost} w-full`}>
        Add bay — drops at 0,0, then drag it
      </button>
    </form>
  )
}

function SpotEditor({
  spot,
  onClose,
  onChanged,
}: {
  spot: Spot
  onClose: () => void
  onChanged: () => void
}) {
  const [width, setWidth] = useState(String(spot.width))
  const [height, setHeight] = useState(String(spot.height))
  const [rotation, setRotation] = useState(String(spot.rotation))
  const [saving, setSaving] = useState(false)

  async function handleSaveGeometry(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      await updateSpotLayout(spot.id, {
        posX: spot.posX,
        posY: spot.posY,
        width: Number(width),
        height: Number(height),
        rotation: Number(rotation),
      })
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  async function handleSetStatus(status: SpotStatus) {
    await updateSpotStatus(spot.id, status)
    onChanged()
  }

  async function handleDelete() {
    await deleteSpot(spot.id)
    onClose()
    onChanged()
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-4 rounded-[3px] ring-1 ring-inset ring-white/70"
            style={{ backgroundColor: SPOT_COLORS[spot.status] }}
          />
          <h2 className="font-display text-sm font-semibold tracking-tight text-slate-900">
            Bay {spot.code}
          </h2>
        </div>
        <button onClick={onClose} className="text-xs font-medium text-slate-400 hover:text-slate-600">
          Close
        </button>
      </div>

      <form onSubmit={handleSaveGeometry} className="mb-4 space-y-2.5">
        <div className="flex gap-2">
          {[
            ['Width', width, setWidth] as const,
            ['Height', height, setHeight] as const,
            ['Rotation', rotation, setRotation] as const,
          ].map(([label, value, set]) => (
            <div key={label} className="flex-1">
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">
                {label}
              </label>
              <input
                type="number"
                value={value}
                onChange={(e) => set(e.target.value)}
                className={`${field} px-2 py-1.5`}
              />
            </div>
          ))}
        </div>
        <button type="submit" disabled={saving} className={`${btn.ghost} w-full`}>
          Save size &amp; rotation
        </button>
      </form>

      {spot.status !== 'OCCUPIED' ? (
        <div className="mb-4">
          <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">
            Status
          </label>
          <div className="flex flex-wrap gap-2">
            {(['AVAILABLE', 'DISABLED', 'MAINTENANCE'] as SpotStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => handleSetStatus(s)}
                disabled={spot.status === s}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:border-blue-200 disabled:bg-blue-50 disabled:text-blue-700"
              >
                <span
                  className="inline-block h-2.5 w-3.5 rounded-[2px] ring-1 ring-inset ring-white/70"
                  style={{ backgroundColor: SPOT_COLORS[s] }}
                />
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="mb-4 text-xs leading-relaxed text-slate-500">
          This bay is occupied. Use the map’s check-out flow, not this panel, to free it.
        </p>
      )}

      <button
        onClick={handleDelete}
        className="text-xs font-semibold text-red-600 hover:text-red-700"
      >
        Delete bay
      </button>
    </div>
  )
}

function RatePlansEditor({
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
