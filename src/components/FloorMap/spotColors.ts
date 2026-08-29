import type { SpotStatus } from '../../types'

/**
 * Spot fill color by status - the single source of truth for the D3 map and
 * every legend/status chip in the UI. AVAILABLE/OCCUPIED are driven entirely
 * by the check-in/checkout lifecycle on the backend; DISABLED/MAINTENANCE are
 * manual overrides. The near-white stroke (SPOT_STROKE) is the "paint" outline
 * every bay gets regardless of status, matching the empty-lot look.
 */
export const SPOT_COLORS: Record<SpotStatus, string> = {
  AVAILABLE: '#10B981', // emerald - free, ready for check-in
  OCCUPIED: '#EF4444', // red - a vehicle is checked in
  DISABLED: '#94A3B8', // slate - taken out of service by an admin/worker
  MAINTENANCE: '#F59E0B', // amber - temporarily unavailable
}

export const SPOT_STROKE = '#F8FAFC' // near-white "paint" line
export const SPOT_LABEL_COLOR = '#0F172A'
export const SPOT_SELECTED_STROKE = '#2563EB' // blue - "selected in the editor", not a status color
