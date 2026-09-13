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

/**
 * Closest point to `p` on a polyline. With `closed`, the segment from the last
 * vertex back to the first is considered too (i.e. treat `coords` as a ring).
 * Returns the projected point and its distance from `p`.
 */
export function closestPointOnPath(
  p: Point,
  coords: Point[],
  closed = false,
): { point: Point; dist: number } {
  const n = coords.length
  if (n === 0) return { point: p, dist: Infinity }
  if (n === 1) return { point: coords[0], dist: distance(p, coords[0]) }
  let best = coords[0]
  let bestD = Infinity
  const segs = closed ? n : n - 1
  for (let i = 0; i < segs; i++) {
    const a = coords[i]
    const b = coords[(i + 1) % n]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len2 = dx * dx + dy * dy
    let t = len2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2
    t = Math.max(0, Math.min(1, t))
    const q: Point = [a[0] + t * dx, a[1] + t * dy]
    const d = distance(p, q)
    if (d < bestD) {
      bestD = d
      best = q
    }
  }
  return { point: best, dist: bestD }
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

export function bboxOfSpot(s: Spot): Bbox {
  const halfW = s.width / 2
  const halfH = s.height / 2
  return { minX: s.posX - halfW, minY: s.posY - halfH, maxX: s.posX + halfW, maxY: s.posY + halfH }
}

export function bboxesIntersect(a: Bbox, b: Bbox): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
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

export interface SpotRowSpec {
  p0: Point
  p1: Point
  angleDeg: number
  stallWidthM: number
  stallDepthM: number
  count: number
  side: 'left' | 'right'
  flip: boolean
  codePrefix: string
  codeStart: number
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

export function computeSpotRow(spec: SpotRowSpec): SpotRowPlacement[] {
  const { p0, p1 } = spec
  const L = distance(p0, p1)
  if (L < 1e-6 || spec.count < 1) return []

  const ux = (p1[0] - p0[0]) / L
  const uy = (p1[1] - p0[1]) / L
  const phi = (spec.angleDeg * Math.PI) / 180
  const sinPhi = Math.max(Math.sin(phi), 1e-3)
  const pitch = spec.stallWidthM / sinPhi // centre-to-centre spacing along the baseline

  const sideSign = spec.side === 'left' ? 1 : -1
  const nx = -uy * sideSign
  const ny = ux * sideSign

  const lean = (Math.PI / 2 - phi) * (spec.flip ? -1 : 1) * sideSign
  const cos = Math.cos(lean)
  const sin = Math.sin(lean)
  const dirX = nx * cos - ny * sin 
  const dirY = nx * sin + ny * cos
  const rotationDeg = normalizeDeg((Math.atan2(dirY, dirX) * 180) / Math.PI - 90)

  const out: SpotRowPlacement[] = []
  for (let k = 0; k < spec.count; k++) {
    const along = (k + 0.5) * pitch 
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

export function geometrySummary(g: Geometry): string {
  if (g.type === 'Point') return 'Point'
  if (g.type === 'Polygon') {
    return `Polygon · ${g.coordinates.length} pts · ${Math.round(polygonArea(g.coordinates))} m²`
  }
  return `Line · ${formatMeters(polylineLength(g.coordinates))}`
}
