import type { EditorTool } from '../../../components/FloorMap/useFloorPlanEditor'
import type { VehicleType } from '../../../types'

export const VEHICLE_TYPES: VehicleType[] = ['CAR', 'MOTORCYCLE', 'EV', 'HANDICAP']

// `select` is not in this strip - it's the floating arrow button pinned to the
// floor plan itself (see SelectHandle), so the default/idle tool sits on the
// canvas the way it does in a drawing app, not in the row of draw tools.
export const TOOLS: Array<[EditorTool, string]> = [
  ['boundary', 'Boundary'],
  ['column', 'Column'],
  ['wall', 'Wall'],
  ['lane', 'Drive lane'],
  ['street', 'Street'],
  ['entrance', 'Entrance'],
  ['spotRow', 'Parking row'],
  ['calibrate', 'Calibrate'],
]

export const TOOL_HINT: Record<EditorTool, string> = {
  select: '',
  boundary: 'Click each corner · click the first point or press Enter to close · Esc cancels',
  wall: 'Click along the wall · press Enter to finish · Esc cancels',
  lane: 'Click along the aisle · press Enter to finish · Esc cancels',
  street: 'Click along the road · press Enter to finish · Esc cancels',
  column: 'Click to drop a column',
  entrance: 'Draw the boundary first · then click the two ends of the opening — it snaps onto the wall',
  spotRow: 'Click the two ends of the row along the aisle, then set it up on the right · Esc cancels',
  calibrate: 'Click two points across a distance you know, then enter it on the right',
}
