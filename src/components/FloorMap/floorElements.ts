import * as d3 from 'd3'
import type { FloorElement, Geometry } from '../../types'
import { distance, formatMeters, polygonCentroid, type Point } from './geometry'
import {
  BOUNDARY_WALL_THICKNESS_M,
  COLUMN_DEFAULT_RADIUS_M,
  EDIT_HANDLE_FILL,
  ELEMENT_COLORS,
  ELEMENT_DASH,
  ELEMENT_STROKE_WIDTH,
  LANE_DEFAULT_WIDTH_M,
  STREET_DEFAULT_WIDTH_M,
} from './floorElementStyles'

export interface RenderContext {
  /** CSS px per meter at the current viewBox + zoom - for text sizing. */
  effectivePxPerMeter: number
  selectedId?: string | null
  interactive: boolean
  /** The floor's BOUNDARY, if drawn - an ENTRANCE rectangle hugs its wall band. */
  boundary?: FloorElement | null
}

export function pathDForGeometry(g: Geometry, close: boolean): string {
  const coords: Point[] = g.type === 'Point' ? [g.coordinates] : g.coordinates
  if (coords.length === 0) return ''
  const [head, ...rest] = coords
  return (
    `M${head[0]},${head[1]}` +
    rest.map((p) => `L${p[0]},${p[1]}`).join('') +
    (close && coords.length > 2 ? 'Z' : '')
  )
}

function laneWidth(el: FloorElement): number {
  return el.style?.widthM ?? (el.kind === 'STREET' ? STREET_DEFAULT_WIDTH_M : LANE_DEFAULT_WIDTH_M)
}

/**
 * Rebuild the children of each bound `g.element` from its geometry. Elements are
 * few and only re-rendered on data change, so a full rebuild per update keeps
 * the per-kind branching simple and correct when a PATCH changes `kind`.
 */
export function renderElement(
  selection: d3.Selection<SVGGElement, FloorElement, SVGGElement, unknown>,
  ctx: RenderContext,
): void {
  selection.each(function (el) {
    const g = d3.select<SVGGElement, FloorElement>(this)
    g.selectAll('*').remove()

    const colors = ELEMENT_COLORS[el.kind]
    const strokeWidth = el.style?.strokeWidth ?? ELEMENT_STROKE_WIDTH[el.kind]
    const dash = el.style?.strokeDasharray ?? ELEMENT_DASH[el.kind] ?? null
    const selected = ctx.selectedId === el.id
    const stroke = selected ? EDIT_HANDLE_FILL : el.style?.stroke ?? colors.stroke
    const fill = el.style?.fill ?? colors.fill
    const opacity = el.style?.opacity ?? 1
    const geom = el.geometry

    const addPath = (d: string, attrs: Record<string, string | number | null>) => {
      const p = g.append('path').attr('d', d).style('vector-effect', 'non-scaling-stroke')
      for (const [k, v] of Object.entries(attrs)) p.attr(k, v)
      return p
    }

    if (geom.type === 'Polygon') {
      const ringD = pathDForGeometry(geom, true)
      if (el.kind === 'BOUNDARY') {
        // The perimeter is the exterior wall - draw it the way a real plan does:
        // a solid poché band of true wall thickness tracing the ring, not a
        // hairline outline, so there's no separate "wall" to trace on top of it.
        // A crisp non-scaling centreline keeps the wall readable when zoomed out
        // far enough that the band collapses below a pixel.
        const wallM = el.style?.widthM ?? BOUNDARY_WALL_THICKNESS_M
        const wall = selected ? EDIT_HANDLE_FILL : el.style?.stroke ?? colors.stroke
        if (fill !== 'none') {
          addPath(ringD, { fill, 'fill-opacity': opacity, stroke: 'none' })
        }
        addPath(ringD, {
          fill: 'none',
          stroke: wall,
          'stroke-width': wallM,
          'stroke-linejoin': 'miter',
          'stroke-miterlimit': 4,
          'stroke-opacity': opacity,
        }).style('vector-effect', null)
        addPath(ringD, { fill: 'none', stroke: wall, 'stroke-width': selected ? 2 : 1 })

        // Keep the wall lengths on screen after the ring is closed, not just
        // while drawing: one dimension (m) per edge, sat just outside the wall.
        if (ctx.interactive && geom.coordinates.length >= 2) {
          const ring = geom.coordinates
          const c = polygonCentroid(ring)
          const fontM = 12 / Math.max(ctx.effectivePxPerMeter, 0.0001)
          for (let i = 0; i < ring.length; i++) {
            const a = ring[i]
            const b = ring[(i + 1) % ring.length]
            const len = distance(a, b)
            if (len < 1e-4) continue
            const mx = (a[0] + b[0]) / 2
            const my = (a[1] + b[1]) / 2
            const ol = Math.hypot(mx - c[0], my - c[1]) || 1
            const dist = wallM / 2 + fontM * 1.1
            g.append('text')
              .attr('x', mx + ((mx - c[0]) / ol) * dist)
              .attr('y', my + ((my - c[1]) / ol) * dist)
              .attr('text-anchor', 'middle')
              .attr('dominant-baseline', 'central')
              .attr('font-family', '"IBM Plex Mono", ui-monospace, monospace')
              .attr('font-size', fontM)
              .attr('font-weight', 600)
              .attr('fill', selected ? EDIT_HANDLE_FILL : '#0F172A')
              .attr('stroke', 'rgba(255,255,255,0.9)')
              .attr('stroke-width', fontM * 0.24)
              .style('paint-order', 'stroke')
              .style('pointer-events', 'none')
              .text(formatMeters(len))
          }
        }
        return
      }
      addPath(ringD, {
        fill,
        'fill-opacity': opacity,
        stroke,
        'stroke-width': selected ? strokeWidth + 1.5 : strokeWidth,
        'stroke-dasharray': dash,
      })
    } else if (geom.type === 'LineString') {
      if (el.kind === 'DRIVE_LANE' || el.kind === 'STREET') {
        const w = laneWidth(el)
        // Edge band behind, fill band in front - a cheap outlined-lane look.
        addPath(pathDForGeometry(geom, false), {
          fill: 'none',
          stroke: selected ? EDIT_HANDLE_FILL : colors.stroke,
          'stroke-width': w + 0.6,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }).style('vector-effect', null)
        addPath(pathDForGeometry(geom, false), {
          fill: 'none',
          stroke: fill === 'none' ? colors.fill : fill,
          'stroke-width': w,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'stroke-dasharray': dash,
          'stroke-opacity': opacity,
        }).style('vector-effect', null)
      } else if (el.kind === 'ENTRANCE') {
        // A real-plan opening in the perimeter wall: a thin rectangle spanning
        // that stretch of the boundary (strokes finer than the wall), the wall
        // band cleared inside it, captioned with an editable title + the width.
        const [a, b] = geom.coordinates as [Point, Point]
        const span = distance(a, b)
        if (span > 1e-4) {
          const bnd = ctx.boundary
          const t = bnd?.style?.widthM ?? BOUNDARY_WALL_THICKNESS_M
          const ux = (b[0] - a[0]) / span
          const uy = (b[1] - a[1]) / span
          const nx = -uy
          const ny = ux
          const h = t / 2
          const rectD =
            `M${a[0] + nx * h},${a[1] + ny * h}` +
            `L${b[0] + nx * h},${b[1] + ny * h}` +
            `L${b[0] - nx * h},${b[1] - ny * h}` +
            `L${a[0] - nx * h},${a[1] - ny * h}Z`
          // Clear the wall poché, then a hairline outline (thinner than BOUNDARY).
          addPath(rectD, { fill: '#F8FAFC', 'fill-opacity': opacity, stroke: 'none' })
          addPath(rectD, {
            fill: 'none',
            stroke,
            'stroke-width': selected ? 1.75 : 1,
          })

          if (ctx.interactive) {
            // Caption on the interior side so it clears the wall band.
            let side = 1
            if (bnd && bnd.geometry.type === 'Polygon') {
              const c = polygonCentroid(bnd.geometry.coordinates)
              const mx = (a[0] + b[0]) / 2
              const my = (a[1] + b[1]) / 2
              side = Math.sign((c[0] - mx) * nx + (c[1] - my) * ny) || 1
            }
            const fontM = 12 / Math.max(ctx.effectivePxPerMeter, 0.0001)
            const cx = (a[0] + b[0]) / 2 + nx * side * (h + fontM * 1.6)
            const cy = (a[1] + b[1]) / 2 + ny * side * (h + fontM * 1.6)
            const caption = (dyM: number, text: string, weight: number, sizeM: number) =>
              g
                .append('text')
                .attr('x', cx)
                .attr('y', cy + dyM)
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'central')
                .attr('font-family', '"IBM Plex Mono", ui-monospace, monospace')
                .attr('font-size', sizeM)
                .attr('font-weight', weight)
                .attr('fill', selected ? EDIT_HANDLE_FILL : colors.stroke)
                .attr('stroke', 'rgba(255,255,255,0.9)')
                .attr('stroke-width', sizeM * 0.24)
                .style('paint-order', 'stroke')
                .style('pointer-events', 'none')
                .text(text)
            caption(-fontM * 0.72, (el.style?.label ?? 'Entrance').toUpperCase(), 700, fontM)
            caption(fontM * 0.72, formatMeters(span), 600, fontM * 0.9)
          }
        }
      } else {
        addPath(pathDForGeometry(geom, false), {
          fill: 'none',
          stroke,
          'stroke-width': selected ? strokeWidth + 1.5 : strokeWidth,
          'stroke-dasharray': dash,
          'stroke-linecap': 'round',
        })
      }
    } else {
      // Point
      const [x, y] = geom.coordinates
      if (el.kind === 'LABEL') {
        const fontM = 12 / Math.max(ctx.effectivePxPerMeter, 0.0001)
        g.append('text')
          .attr('x', x)
          .attr('y', y)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('font-family', '"IBM Plex Mono", ui-monospace, monospace')
          .attr('font-size', fontM)
          .attr('font-weight', 600)
          .attr('fill', selected ? EDIT_HANDLE_FILL : fill)
          .attr('stroke', colors.stroke)
          .attr('stroke-width', fontM * 0.22)
          .style('paint-order', 'stroke')
          .text(el.style?.label ?? 'Label')
      } else {
        g.append('circle')
          .attr('cx', x)
          .attr('cy', y)
          .attr('r', el.style?.radiusM ?? COLUMN_DEFAULT_RADIUS_M)
          .attr('fill', fill === 'none' ? colors.fill : fill)
          .attr('fill-opacity', opacity)
          .attr('stroke', stroke)
          .attr('stroke-width', selected ? strokeWidth + 1 : strokeWidth)
          .style('vector-effect', 'non-scaling-stroke')
      }
    }
  })
}

// ---- hit testing -----------------------------------------------------------

function pointInRing(p: Point, ring: Point[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersect =
      yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1])
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

function distToPolyline(p: Point, coords: Point[]): number {
  let min = Infinity
  for (let i = 1; i < coords.length; i++) min = Math.min(min, distToSegment(p, coords[i - 1], coords[i]))
  return min
}

/** Topmost element under `world` within `tolM` meters (last in array wins). */
export function elementHitTest(
  elements: FloorElement[],
  world: Point,
  tolM: number,
): FloorElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i]
    const g = el.geometry
    if (g.type === 'Polygon') {
      if (pointInRing(world, g.coordinates) || distToPolyline(world, [...g.coordinates, g.coordinates[0]]) <= tolM) {
        return el
      }
    } else if (g.type === 'LineString') {
      const tol = el.kind === 'DRIVE_LANE' || el.kind === 'STREET' ? Math.max(tolM, laneWidth(el) / 2) : tolM
      if (distToPolyline(world, g.coordinates) <= tol) return el
    } else {
      const r = Math.max(tolM, (el.style?.radiusM ?? COLUMN_DEFAULT_RADIUS_M) + tolM)
      if (Math.hypot(world[0] - g.coordinates[0], world[1] - g.coordinates[1]) <= r) return el
    }
  }
  return null
}
