import type { Geometry, Spot, VehicleType } from '../../types'

/** [x, y] in meters, floor-local. */
export type Point = [number, number]

export interface Bbox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

export function snapToGrid(p: Point, stepM: number): Point {
  if (!stepM || stepM <= 0) return p
  return [Math.round(p[0] / stepM) * stepM, Math.round(p[1] / stepM) * stepM]
}

/** Total length of a polyline / polygon ring (ring is not auto-closed). */
export function polylineLength(coords: Point[]): number {
  let total = 0
  for (let i = 1; i < coords.length; i++) total += distance(coords[i - 1], coords[i])
  return total
}

/** Absolute area of an implicitly-closed ring (shoelace). */
export function polygonArea(ring: Point[]): number {
  if (ring.length < 3) return 0
  let sum = 0
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[(i + 1) % n]
    sum += x1 * y2 - x2 * y1
  }
  return Math.abs(sum) / 2
}

export function polygonCentroid(ring: Point[]): Point {
  if (ring.length === 0) return [0, 0]
  let x = 0
  let y = 0
  for (const [px, py] of ring) {
    x += px
    y += py
  }
  return [x / ring.length, y / ring.length]
}

function coordList(g: Geometry): Point[] {
  return g.type === 'Point' ? [g.coordinates] : g.coordinates
}

export function bboxOfGeometry(g: Geometry): Bbox {
  const pts = coordList(g)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of pts) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY }
}

/** Spot extent, treating posX/posY as the center and ignoring rotation. */
export function bboxOfSpots(spots: Spot[]): Bbox | null {
  if (spots.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const s of spots) {
    const halfW = s.width / 2
    const halfH = s.height / 2
    minX = Math.min(minX, s.posX - halfW)
    minY = Math.min(minY, s.posY - halfH)
    maxX = Math.max(maxX, s.posX + halfW)
    maxY = Math.max(maxY, s.posY + halfH)
  }
  return { minX, minY, maxX, maxY }
}

export function unionBbox(boxes: (Bbox | null | undefined)[]): Bbox | null {
  const present = boxes.filter((b): b is Bbox => !!b && Number.isFinite(b.minX))
  if (present.length === 0) return null
  return present.reduce((acc, b) => ({
    minX: Math.min(acc.minX, b.minX),
    minY: Math.min(acc.minY, b.minY),
    maxX: Math.max(acc.maxX, b.maxX),
    maxY: Math.max(acc.maxY, b.maxY),
  }))
}

/**
 * A "nice" round scale-bar length (meters) - roughly 18% of the visible span,
 * snapped down to 1 / 2 / 5 x 10^k.
 */
export function niceScaleBarLength(spanM: number): number {
  const target = Math.max(spanM * 0.18, 0.1)
  const pow = Math.pow(10, Math.floor(Math.log10(target)))
  const candidates = [1, 2, 5, 10].map((m) => m * pow)
  let best = candidates[0]
  for (const c of candidates) if (c <= target) best = c
  return best
}

function mapCoords(g: Geometry, fn: (p: Point) => Point): Geometry {
  if (g.type === 'Point') return { type: 'Point', coordinates: fn(g.coordinates) }
  if (g.type === 'Polygon') return { type: 'Polygon', coordinates: g.coordinates.map(fn) }
  return { type: 'LineString', coordinates: g.coordinates.map(fn) }
}

export function translateGeometry(g: Geometry, dx: number, dy: number): Geometry {
  return mapCoords(g, ([x, y]) => [x + dx, y + dy])
}

export function setVertex(g: Geometry, i: number, p: Point): Geometry {
  if (g.type === 'Point') return { type: 'Point', coordinates: p }
  const next = g.coordinates.slice()
  if (i < 0 || i >= next.length) return g
  next[i] = p
  return g.type === 'Polygon'
    ? { type: 'Polygon', coordinates: next }
    : { type: 'LineString', coordinates: next }
}

/** Minimum vertex count that keeps a geometry valid for its shape. */
export function minVertices(g: Geometry): number {
  if (g.type === 'Polygon') return 3
  if (g.type === 'LineString') return 2
  return 1
}

export function removeVertex(g: Geometry, i: number): Geometry {
  if (g.type === 'Point') return g
  if (g.coordinates.length <= minVertices(g)) return g
  const next = g.coordinates.slice()
  if (i < 0 || i >= next.length) return g
  next.splice(i, 1)
  return g.type === 'Polygon'
    ? { type: 'Polygon', coordinates: next }
    : { type: 'LineString', coordinates: next }
}

export function formatMeters(m: number): string {
  if (m >= 100) return `${Math.round(m)} m`
  if (m >= 10) return `${m.toFixed(1)} m`
  return `${m.toFixed(2)} m`
}

// ---------------------------------------------------------------------------
// Parking-row layout - pure math for the "Parking row" editor tool. Given a
// baseline drawn along a drive aisle, produce the centered/rotated rectangles
// (meters + degrees, the same space as Spot.posX/posY/rotation) for a whole row
// of stalls at a chosen parking angle.
// ---------------------------------------------------------------------------

export interface SpotRowSpec {
  /** Baseline = the front edge of the row, along the aisle. Drawn p0 -> p1. */
  p0: Point
  p1: Point
  /** Stall long-axis angle to the baseline: 90 = perpendicular, 45/60 = angled. */
  angleDeg: number
  /** Door-to-door width and nose-in depth, meters. */
  stallWidthM: number
  stallDepthM: number
  /** How many stalls to place (the caller resolves any auto-fill first). */
  count: number
  /** Which side of the p0 -> p1 direction the stalls occupy. */
  side: 'left' | 'right'
  /** Reverse the angled lean (the correct sign depends on aisle travel direction). */
  flip: boolean
  codePrefix: string
  codeStart: number
  /** Zero-pad the numeric part to this width; 0 = no padding. */
  codePad: number
  vehicleType: VehicleType
}

export interface SpotRowPlacement {
  posX: number
  posY: number
  width: number
  height: number
  rotation: number
  code: string
  vehicleType: VehicleType
}

function normalizeDeg(d: number): number {
  return ((d % 360) + 360) % 360
}

/** How many stalls of width W (at parking angle phi) fit along baseline p0 -> p1. */
export function spotRowCapacity(
  p0: Point,
  p1: Point,
  angleDeg: number,
  stallWidthM: number,
): number {
  const L = distance(p0, p1)
  const sinPhi = Math.max(Math.sin((angleDeg * Math.PI) / 180), 1e-3)
  const pitch = stallWidthM / sinPhi
  if (pitch <= 0) return 0
  return Math.max(0, Math.floor(L / pitch + 1e-6))
}

/**
 * Lay out a row of stall rectangles along the baseline. Each footprint is a
 * plain rotated rectangle (W x D), not a parallelogram - matching how spots are
 * modelled everywhere else; the sawtooth edge of angled parking comes from the
 * arrangement, not skewed cells.
 */
export function computeSpotRow(spec: SpotRowSpec): SpotRowPlacement[] {
  const { p0, p1 } = spec
  const L = distance(p0, p1)
  if (L < 1e-6 || spec.count < 1) return []

  const ux = (p1[0] - p0[0]) / L
  const uy = (p1[1] - p0[1]) / L
  const phi = (spec.angleDeg * Math.PI) / 180
  const sinPhi = Math.max(Math.sin(phi), 1e-3)
  const pitch = spec.stallWidthM / sinPhi // centre-to-centre spacing along the baseline

  // Unit normal to the chosen side (u rotated +/-90 degrees).
  const sideSign = spec.side === 'left' ? 1 : -1
  const nx = -uy * sideSign
  const ny = ux * sideSign

  // Angled lean, measured off the side normal; 0 at 90 degrees.
  const lean = (Math.PI / 2 - phi) * (spec.flip ? -1 : 1) * sideSign
  const cos = Math.cos(lean)
  const sin = Math.sin(lean)
  const dirX = nx * cos - ny * sin // stall long-axis unit vector (aisle -> back of stall)
  const dirY = nx * sin + ny * cos
  const rotationDeg = normalizeDeg((Math.atan2(dirY, dirX) * 180) / Math.PI - 90)

  const out: SpotRowPlacement[] = []
  for (let k = 0; k < spec.count; k++) {
    const along = (k + 0.5) * pitch // first stall flush at p0
    const baseX = p0[0] + ux * along
    const baseY = p0[1] + uy * along
    const num = spec.codeStart + k
    out.push({
      posX: baseX + dirX * (spec.stallDepthM / 2),
      posY: baseY + dirY * (spec.stallDepthM / 2),
      width: spec.stallWidthM,
      height: spec.stallDepthM,
      rotation: rotationDeg,
      code:
        spec.codePrefix +
        (spec.codePad > 0 ? String(num).padStart(spec.codePad, '0') : String(num)),
      vehicleType: spec.vehicleType,
    })
  }
  return out
}

/** Short human summary of a geometry for the editor's element list. */
export function geometrySummary(g: Geometry): string {
  if (g.type === 'Point') return 'Point'
  if (g.type === 'Polygon') {
    return `Polygon · ${g.coordinates.length} pts · ${Math.round(polygonArea(g.coordinates))} m²`
  }
  return `Line · ${formatMeters(polylineLength(g.coordinates))}`
}
