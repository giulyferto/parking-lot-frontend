import type { FloorElementKind } from '../../types'

/**
 * Fill + stroke per floor-plan element kind - the single source of truth for the
 * D3 element layer and the editor's element list (mirrors spotColors.ts).
 * Light-theme only. ENTRANCE blue is the editor-accent family (same as
 * SPOT_SELECTED_STROKE), deliberately not one of the four status colors.
 */
export const ELEMENT_COLORS: Record<FloorElementKind, { fill: string; stroke: string }> = {
  BOUNDARY: { fill: 'none', stroke: '#0F172A' }, // slate-900 poché - drawn as a solid wall band (BOUNDARY_WALL_THICKNESS_M), like an exterior wall on a real plan
  COLUMN: { fill: '#334155', stroke: '#F8FAFC' }, // solid slate-700, near-white edge
  WALL: { fill: 'none', stroke: '#475569' }, // slate-600 interior wall
  DRIVE_LANE: { fill: '#E2E8F0', stroke: '#CBD5E1' }, // asphalt: slate-200 / slate-300 edge
  STREET: { fill: '#CBD5E1', stroke: '#94A3B8' }, // darker asphalt for the public road
  ENTRANCE: { fill: '#2563EB', stroke: '#2563EB' }, // blue direction arrow
  LABEL: { fill: '#0F172A', stroke: 'rgba(255,255,255,0.85)' }, // text + halo
}

/** Screen-px stroke weights, applied together with vector-effect: non-scaling-stroke. */
export const ELEMENT_STROKE_WIDTH: Record<FloorElementKind, number> = {
  BOUNDARY: 2.5,
  COLUMN: 1,
  WALL: 1.75,
  DRIVE_LANE: 1,
  STREET: 1,
  ENTRANCE: 2,
  LABEL: 3,
}

export const ELEMENT_DASH: Partial<Record<FloorElementKind, string>> = {
  STREET: '6 4',
}

export const ELEMENT_LABELS: Record<FloorElementKind, string> = {
  BOUNDARY: 'Boundary',
  COLUMN: 'Column',
  WALL: 'Wall',
  DRIVE_LANE: 'Drive lane',
  STREET: 'Street',
  ENTRANCE: 'Entrance',
  LABEL: 'Label',
}

// Real-world default sizes (meters) - used when style.widthM / radiusM are absent.
export const BOUNDARY_WALL_THICKNESS_M = 0.3 // exterior perimeter wall poché band width
export const LANE_DEFAULT_WIDTH_M = 6
export const STREET_DEFAULT_WIDTH_M = 7
export const COLUMN_DEFAULT_RADIUS_M = 0.3
export const ENTRANCE_ARROW_LEN_M = 3

// Editor / map chrome.
export const GRID_STROKE = 'rgba(148,163,184,0.35)' // slate-400 @ low alpha
export const SCALE_BAR_COLOR = '#0F172A'
export const EDIT_HANDLE_FILL = '#2563EB'
export const EDIT_HANDLE_RADIUS_PX = 4
export const RUBBER_BAND_STROKE = '#2563EB'
export const RULER_STROKE = '#2563EB'
// Wheel-zoom range [min k, max k]. min 0.1 = zoom out to ~10x the fitted view
// (on a near-empty floor, whose viewBox is clamped to MIN_VIEW_W_M, that's
// ~240 m across - enough to lay out a whole lot before any boundary exists).
export const ZOOM_SCALE_EXTENT: [number, number] = [0.1, 20]
