import { aisleWidthForAngle } from '../../../components/FloorMap/spotDimensions'
import type { SpotRowToolBag } from '../../../components/FloorMap/useSpotRowTool'
import { Eyebrow } from '../../../components/ui'
import { btn, field } from '../../../components/styles'
import type { VehicleType } from '../../../types'
import { VEHICLE_TYPES } from './constants'
import { microLabel } from './styles'
import { RowAngleDial } from './RowAngleDial'

/**
 * The row tool's "how will this row look" decisions - angle, vehicle type,
 * stall footprint - asked up front as a popover anchored to the toolbar
 * button, before the aisle is drawn. Geometry-dependent decisions (count,
 * side, codes) stay in SpotRowPanel, since those only make sense once a
 * baseline exists to measure against. Reopenable afterwards via "Change
 * setup" there, so a row can still be re-angled once you've seen the space.
 */
export function RowSetupPopover({
  tool,
  onClose,
}: {
  tool: SpotRowToolBag
  onClose: () => void
}) {
  const { params } = tool
  const num = (raw: string) => (raw === '' ? 0 : Number(raw))

  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} />
      <div className="absolute left-0 top-full z-30 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <Eyebrow>Set up the row</Eyebrow>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 text-sm text-slate-600">
          <div>
            <span className={microLabel}>Parking angle</span>
            <RowAngleDial
              value={params.angleDeg}
              onChange={(angleDeg) => tool.setParams({ angleDeg })}
            />
            <p className="mt-1.5 text-[11px] text-slate-400">
              Aisle guidance: {aisleWidthForAngle(params.angleDeg)} m (
              {params.angleDeg === 90 ? 'two-way' : 'one-way'})
            </p>
          </div>

          <label className="block">
            <span className={microLabel}>Vehicle type</span>
            <select
              value={params.vehicleType}
              onChange={(e) => tool.setParams({ vehicleType: e.target.value as VehicleType })}
              className={`${field} px-2 py-1.5`}
            >
              {VEHICLE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-2">
            <label className="flex-1">
              <span className={microLabel}>Stall width (m)</span>
              <input
                type="number"
                min="0.5"
                step="0.1"
                value={params.stallWidthM}
                onChange={(e) => tool.setParams({ stallWidthM: num(e.target.value) })}
                className={`${field} px-2 py-1.5`}
              />
            </label>
            <label className="flex-1">
              <span className={microLabel}>Stall depth (m)</span>
              <input
                type="number"
                min="0.5"
                step="0.1"
                value={params.stallDepthM}
                onChange={(e) => tool.setParams({ stallDepthM: num(e.target.value) })}
                className={`${field} px-2 py-1.5`}
              />
            </label>
          </div>
        </div>

        <button type="button" onClick={onClose} className={`${btn.primary} mt-4 w-full`}>
          {tool.phase === 'idle' && !tool.committed ? 'Start drawing →' : 'Done'}
        </button>
      </div>
    </>
  )
}
