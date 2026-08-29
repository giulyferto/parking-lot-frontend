import type { SpotStatus } from '../../types'

/**
 * Spot fill color by status. AVAILABLE/OCCUPIED are driven entirely by the
 * check-in/checkout lifecycle on the backend; DISABLED/MAINTENANCE are
 * manual overrides. The base stroke (SPOT_STROKE) is the neutral white/gray
 * outline every spot gets regardless of status, matching the "empty lot"
 * look before you look at the fill color.
 */
export const SPOT_COLORS: Record<SpotStatus, string> = {
  AVAILABLE: '#22c55e', // green
  OCCUPIED: '#ef4444', // red
  DISABLED: '#9ca3af', // gray - taken out of service by an admin/worker
  MAINTENANCE: '#eab308', // yellow/amber - temporarily unavailable
}

export const SPOT_STROKE = '#f8fafc' // near-white
export const SPOT_LABEL_COLOR = '#0f172a'
export const SPOT_SELECTED_STROKE = '#2563eb' // blue - reserved for "selected in the editor", not a status
