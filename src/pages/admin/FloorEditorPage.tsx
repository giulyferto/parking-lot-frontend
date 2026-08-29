import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getFloor } from '../../api/floors'
import { createSpot, deleteSpot, listSpots, updateSpotLayout, updateSpotStatus } from '../../api/spots'
import { createRatePlan, listRatePlans } from '../../api/ratePlans'
import { FloorMap } from '../../components/FloorMap/FloorMap'
import type { Floor, RatePlan, Spot, SpotStatus, VehicleType } from '../../types'

const VEHICLE_TYPES: VehicleType[] = ['CAR', 'MOTORCYCLE', 'EV', 'HANDICAP']

/**
 * The admin's drag-and-drop canvas editor: drag a spot to reposition it
 * (FloorMap's onSpotDragEnd -> PATCH .../layout), and use the side panel to
 * set its size/rotation/status precisely or add a brand new spot. Rate
 * plans for this floor are managed further down the same page since both
 * are floor-level admin tasks.
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

  if (!floor) return <div className="p-6 text-sm text-slate-500">Loading...</div>

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-white px-4 py-2">
        <Link to={`/admin/parking-lots/${floor.parkingLotId}`} className="text-sm text-blue-600 hover:underline">
          &larr; Back to floors
        </Link>
        <h1 className="text-lg font-semibold text-slate-900">{floor.name} - layout &amp; rates</h1>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 p-4">
          {spots.length === 0 ? (
            <p className="text-sm text-slate-500">
              No spots yet - add one from the panel on the right, then drag it into place.
            </p>
          ) : (
            <FloorMap
              spots={spots}
              selectedSpotId={selectedSpot?.id}
              onSpotClick={setSelectedSpot}
              onSpotDragEnd={handleDragEnd}
            />
          )}
        </div>
        <aside className="w-96 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4">
          <AddSpotForm floorId={floor.id} onCreated={reload} />
          <hr className="my-4 border-slate-200" />
          {selectedSpot ? (
            <SpotEditor
              key={selectedSpot.id}
              spot={selectedSpot}
              onClose={() => setSelectedSpot(null)}
              onChanged={() => {
                reload()
              }}
            />
          ) : (
            <p className="text-sm text-slate-500">Click a spot to edit its size, rotation or status.</p>
          )}
          <hr className="my-4 border-slate-200" />
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
      <h2 className="mb-2 text-sm font-semibold text-slate-700">Add spot</h2>
      <div className="mb-2 flex gap-2">
        <input
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Code, e.g. A-01"
          className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={vehicleType}
          onChange={(e) => setVehicleType(e.target.value as VehicleType)}
          className="rounded border border-slate-300 px-2 py-2 text-sm"
        >
          {VEHICLE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        Add spot (appears at 0,0 - drag it into place)
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
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Spot {spot.code}</h2>
        <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">
          Close
        </button>
      </div>
      <form onSubmit={handleSaveGeometry} className="mb-3 space-y-2">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-slate-500">Width</label>
            <input
              type="number"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-slate-500">Height</label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-slate-500">Rotation</label>
            <input
              type="number"
              value={rotation}
              onChange={(e) => setRotation(e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          Save size &amp; rotation
        </button>
      </form>

      {spot.status !== 'OCCUPIED' && (
        <div className="mb-3">
          <label className="mb-1 block text-xs text-slate-500">Status</label>
          <div className="flex gap-2">
            {(['AVAILABLE', 'DISABLED', 'MAINTENANCE'] as SpotStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => handleSetStatus(s)}
                disabled={spot.status === s}
                className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-40"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
      {spot.status === 'OCCUPIED' && (
        <p className="mb-3 text-xs text-slate-500">
          This spot is occupied - use the map's check-out flow, not this panel, to free it.
        </p>
      )}

      <button onClick={handleDelete} className="text-xs text-red-600 hover:underline">
        Delete spot
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
      <h2 className="mb-2 text-sm font-semibold text-slate-700">Rate plans</h2>
      <ul className="mb-3 space-y-1 text-xs text-slate-600">
        {ratePlans.map((plan) => (
          <li key={plan.id} className="rounded border border-slate-200 px-2 py-1">
            <span className="font-medium">{plan.vehicleType}</span> - hourly {plan.currency}{' '}
            {plan.hourlyRate}
            {plan.nightRate ? `, night ${plan.nightRate}` : ''}
            {plan.dayRate ? `, day ${plan.dayRate}` : ''}
            {plan.monthRate ? `, month ${plan.monthRate}` : ''}
          </li>
        ))}
        {ratePlans.length === 0 && <li className="text-slate-400">No rate plans yet.</li>}
      </ul>
      <form onSubmit={handleSubmit} className="space-y-2">
        <select
          value={vehicleType}
          onChange={(e) => setVehicleType(e.target.value as VehicleType)}
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
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
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={nightRate}
          onChange={(e) => setNightRate(e.target.value)}
          placeholder="Night rate (optional)"
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={dayRate}
          onChange={(e) => setDayRate(e.target.value)}
          placeholder="Day rate (optional)"
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={monthRate}
          onChange={(e) => setMonthRate(e.target.value)}
          placeholder="Month rate (optional)"
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          Add rate plan
        </button>
      </form>
    </div>
  )
}
