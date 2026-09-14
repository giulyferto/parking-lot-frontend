import { useState } from 'react'
import type { FormEvent } from 'react'
import { createSpot, deleteSpot, updateSpotLayout, updateSpotStatus } from '../../../api/spots'
import type { SpotInput, SpotLayoutInput } from '../../../api/spots'
import { SPOT_COLORS } from '../../../components/FloorMap/spotColors'
import { ANGLE_PRESETS_DEG, STALL_PRESETS } from '../../../components/FloorMap/spotDimensions'
import { Eyebrow } from '../../../components/ui'
import { btn, field } from '../../../components/styles'
import type { Spot, SpotStatus, VehicleType } from '../../../types'
import type { UndoCommand } from '../useUndoStack'
import { VEHICLE_TYPES } from './constants'
import { microLabel, presetChip } from './styles'

export function AddSpotForm({ onCreate }: { onCreate: (input: SpotInput) => Promise<void> }) {
  const [code, setCode] = useState('')
  const [vehicleType, setVehicleType] = useState<VehicleType>('CAR')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await onCreate({ code, vehicleType })
      setCode('')
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
        Add bay — standard stall size for its type
      </button>
    </form>
  )
}

export function MultiSpotPanel({
  spots,
  onClose,
  onSetStatus,
  onDelete,
}: {
  spots: Spot[]
  onClose: () => void
  onSetStatus: (status: SpotStatus) => void
  onDelete: () => void
}) {
  const anyOccupied = spots.some((s) => s.status === 'OCCUPIED')
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold tracking-tight text-slate-900">
          {spots.length} bays selected
        </h2>
        <button onClick={onClose} className="text-xs font-medium text-slate-400 hover:text-slate-600">
          Close
        </button>
      </div>

      <p className="mb-3 font-mono text-xs text-slate-500">
        {spots.map((s) => s.code).join(', ')}
      </p>

      <div className="mb-4">
        <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">
          Status
        </label>
        <div className="flex flex-wrap gap-2">
          {(['AVAILABLE', 'DISABLED', 'MAINTENANCE'] as SpotStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => onSetStatus(s)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              <span
                className="inline-block h-2.5 w-3.5 rounded-[2px] ring-1 ring-inset ring-white/70"
                style={{ backgroundColor: SPOT_COLORS[s] }}
              />
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        {anyOccupied && (
          <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
            Occupied bays in the selection are skipped - use the map's check-out flow for those.
          </p>
        )}
      </div>

      <button
        onClick={onDelete}
        className="text-xs font-semibold text-red-600 hover:text-red-700"
      >
        Delete {spots.length} bays
      </button>
    </div>
  )
}

export function SpotEditor({
  spot,
  onClose,
  onChanged,
  pushUndo,
}: {
  spot: Spot
  onClose: () => void
  onChanged: () => void
  pushUndo: (command: UndoCommand) => void
}) {
  const [width, setWidth] = useState(String(spot.width))
  const [height, setHeight] = useState(String(spot.height))
  const [rotation, setRotation] = useState(String(spot.rotation))
  const [saving, setSaving] = useState(false)

  async function handleSaveGeometry(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      const before: SpotLayoutInput = {
        posX: spot.posX,
        posY: spot.posY,
        width: spot.width,
        height: spot.height,
        rotation: spot.rotation,
      }
      const after: SpotLayoutInput = {
        ...before,
        width: Number(width),
        height: Number(height),
        rotation: Number(rotation),
      }
      await updateSpotLayout(spot.id, after)
      pushUndo({
        undo: async () => {
          await updateSpotLayout(spot.id, before)
          onChanged()
        },
        redo: async () => {
          await updateSpotLayout(spot.id, after)
          onChanged()
        },
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
    const snapshot: SpotInput & { layout: SpotLayoutInput } = {
      code: spot.code,
      vehicleType: spot.vehicleType,
      layout: {
        posX: spot.posX,
        posY: spot.posY,
        width: spot.width,
        height: spot.height,
        rotation: spot.rotation,
      },
    }
    await deleteSpot(spot.id)
    let currentId: string | null = null
    pushUndo({
      undo: async () => {
        const recreated = await createSpot(spot.floorId, {
          code: snapshot.code,
          vehicleType: snapshot.vehicleType,
        })
        currentId = recreated.id
        await updateSpotLayout(currentId, snapshot.layout)
        onChanged()
      },
      redo: async () => {
        if (!currentId) return
        await deleteSpot(currentId)
        currentId = null
        onChanged()
      },
    })
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

      <div className="mb-2">
        <span className={microLabel}>Stall preset</span>
        <div className="flex flex-wrap gap-1.5">
          {STALL_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.note}
              onClick={() => {
                setWidth(String(p.size.width))
                setHeight(String(p.size.height))
              }}
              className={presetChip}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-3">
        <span className={microLabel}>Angle</span>
        <div className="flex flex-wrap gap-1.5">
          {ANGLE_PRESETS_DEG.map((deg) => (
            <button
              key={deg}
              type="button"
              onClick={() => setRotation(String(deg))}
              className={presetChip}
            >
              {deg}&deg;
            </button>
          ))}
        </div>
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
