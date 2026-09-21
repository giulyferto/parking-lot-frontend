import type { VehicleType } from '../../types'

/**
 * Real-world stall dimensions (meters) - the single source of truth for how big
 * a bay is drawn, the sibling of spotColors.ts (fill by status) and
 * floorElementStyles.ts (per-kind element style). Numbers follow the European /
 * municipal metric convention rather than the US 9x18 ft figures:
 *
 *   Standard car / EV  2.5 x 5.0    Compact  2.3 x 4.5
 *   Motorcycle         1.0 x 2.5    ADA      3.5 x 5.0
 *
 * `width` is door-to-door (across the aisle), `height` is the nose-in depth -
 * matching Spot.width / Spot.height. The ADA bay is one wide rectangle with the
 * ~1.0 m striped access aisle baked into the width (no separate element).
 *
 * Plain `as const` objects + derived unions, not TS enums (tsconfig has
 * erasableSyntaxOnly on).
 */

export interface StallSize {
  /** Door-to-door, meters. */
  width: number
  /** Nose-in depth, meters. */
  height: number
}

/** Footprint a brand-new spot gets, keyed by its vehicle type. */
export const STALL_DIMENSIONS_BY_VEHICLE: Record<VehicleType, StallSize> = {
  CAR: { width: 2.5, height: 5.0 },
  EV: { width: 2.5, height: 5.0 }, // same as a standard car bay
  MOTORCYCLE: { width: 1.0, height: 2.5 },
  HANDICAP: { width: 3.5, height: 5.0 }, // access aisle included in the width
}

export interface StallPreset {
  id: 'standard' | 'compact' | 'ada' | 'motorcycle'
  label: string
  size: StallSize
  /** The vehicle type this footprint is meant for, when there is a clear one. */
  vehicleType?: VehicleType
  note?: string
}

/** Quick-fill presets for the SpotEditor size fields and the row tool. */
export const STALL_PRESETS: StallPreset[] = [
  { id: 'standard', label: 'Standard', size: { width: 2.5, height: 5.0 }, vehicleType: 'CAR' },
  { id: 'compact', label: 'Compact', size: { width: 2.3, height: 4.5 } },
  {
    id: 'ada',
    label: 'ADA',
    size: { width: 3.5, height: 5.0 },
    vehicleType: 'HANDICAP',
    note: '1.0 m access aisle included in the 3.5 m width',
  },
  { id: 'motorcycle', label: 'Motorcycle', size: { width: 1.0, height: 2.5 }, vehicleType: 'MOTORCYCLE' },
]

/** Rotation quick-set values (degrees) for the SpotEditor angle buttons. */
export const ANGLE_PRESETS_DEG = [0, 45, 60, 90] as const

/** Snap points the row angle dial offers (stall long-axis angle to the aisle). */
export const ROW_PARK_ANGLE_SNAPS = [30, 45, 60, 75, 90] as const
export type RowParkAngle = number

/** The dial (and the underlying geometry) only makes sense in this range - below
 * it the "pitch = width / sin(angle)" formula in geometry.ts blows up into
 * unusably long stalls; parallel parking is a different layout, not modeled here. */
export const ROW_ANGLE_MIN_DEG = 30
export const ROW_ANGLE_MAX_DEG = 90

/**
 * Informational drive-aisle width (meters) for a double-loaded row, at the
 * angles above - shown as a hint in the row panel, not enforced anywhere.
 * 90 deg two-way already equals LANE_DEFAULT_WIDTH_M (6).
 */
const AISLE_WIDTH_BREAKPOINTS: [number, number][] = [
  [30, 3.0], // one-way, tight
  [45, 3.6], // one-way
  [60, 4.5], // one-way
  [75, 5.2], // one-way, near two-way
  [90, 6.0], // two-way
]

/** Linearly interpolates the aisle-width hint between the breakpoints above,
 * so the dial's free-form angles still get a sensible (if approximate) guide. */
export function aisleWidthForAngle(angleDeg: number): number {
  const a = Math.min(ROW_ANGLE_MAX_DEG, Math.max(ROW_ANGLE_MIN_DEG, angleDeg))
  for (let i = 0; i < AISLE_WIDTH_BREAKPOINTS.length - 1; i++) {
    const [a0, w0] = AISLE_WIDTH_BREAKPOINTS[i]
    const [a1, w1] = AISLE_WIDTH_BREAKPOINTS[i + 1]
    if (a >= a0 && a <= a1) {
      const t = (a - a0) / (a1 - a0)
      return Math.round((w0 + t * (w1 - w0)) * 10) / 10
    }
  }
  return AISLE_WIDTH_BREAKPOINTS[AISLE_WIDTH_BREAKPOINTS.length - 1][1]
}
