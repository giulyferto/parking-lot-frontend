import * as d3 from 'd3'
import type { FloorElement } from '../../../types'
import {
  EDIT_HANDLE_FILL,
  EDIT_HANDLE_RADIUS_PX,
  RUBBER_BAND_STROKE,
  RULER_STROKE,
} from '../floorElementStyles'
import { distance, formatMeters, setVertex, type Point } from '../geometry'
import { renderElement } from '../floorElements'
import type { FloorPlanEditorBag } from '../useFloorPlanEditor'
import type { SpotRowToolBag } from '../useSpotRowTool'
import { SPOT_SELECTED_STROKE } from '../spotColors'

function polyD(pts: Point[], close: boolean): string {
  if (pts.length === 0) return ''
  const [h, ...rest] = pts
  return `M${h[0]},${h[1]}` + rest.map((p) => `L${p[0]},${p[1]}`).join('') + (close ? 'Z' : '')
}

export interface DrawOverlayCtx {
  editor?: FloorPlanEditorBag
  spotRowTool?: SpotRowToolBag
  cursor: Point | null
  boundary?: FloorElement
  viewToPx: number
  pxToMeters: (px: number, k: number) => number
}

export function drawOverlay(
  overlay: d3.Selection<SVGGElement, unknown, null, undefined>,
  viewport: d3.Selection<SVGGElement, unknown, null, undefined>,
  dragContainer: SVGGElement,
  k: number,
  ctx: DrawOverlayCtx,
): void {
  overlay.selectAll('*').remove()
  const { editor, spotRowTool, cursor, boundary, viewToPx, pxToMeters } = ctx
  if (!editor) return
  const handleR = pxToMeters(EDIT_HANDLE_RADIUS_PX, k)
  const d = editor.draft

  if (d?.mode === 'shape') {
    const cur = cursor ? editor.snapDraftPoint(cursor) : null
    const preview = cur ? [...d.vertices, cur] : d.vertices
    if (preview.length >= 2) {
      overlay
        .append('path')
        .attr('d', polyD(preview, d.geomType === 'Polygon' && preview.length > 2))
        .attr('fill', d.geomType === 'Polygon' ? 'rgba(37,99,235,0.08)' : 'none')
        .attr('stroke', RUBBER_BAND_STROKE)
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4 3')
        .style('vector-effect', 'non-scaling-stroke')

      const font = pxToMeters(12, k)
      const off = pxToMeters(11, k)
      for (let i = 1; i < preview.length; i++) {
        const a = preview[i - 1]
        const b = preview[i]
        const len = distance(a, b)
        if (len < 1e-4) continue
        const nx = -(b[1] - a[1]) / len
        const ny = (b[0] - a[0]) / len
        const live = i === preview.length - 1 && !!cur
        overlay
          .append('text')
          .attr('x', (a[0] + b[0]) / 2 + nx * off)
          .attr('y', (a[1] + b[1]) / 2 + ny * off)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('font-family', '"IBM Plex Mono", ui-monospace, monospace')
          .attr('font-size', font)
          .attr('font-weight', live ? 700 : 600)
          .attr('fill', live ? RUBBER_BAND_STROKE : 'rgba(37,99,235,0.6)')
          .attr('stroke', 'rgba(255,255,255,0.9)')
          .attr('stroke-width', font * 0.24)
          .style('paint-order', 'stroke')
          .text(formatMeters(len))
      }
    }
    overlay
      .selectAll('circle.dv')
      .data(d.vertices)
      .enter()
      .append('circle')
      .attr('class', 'dv')
      .attr('cx', (p) => p[0])
      .attr('cy', (p) => p[1])
      .attr('r', handleR)
      .attr('fill', EDIT_HANDLE_FILL)
    // Hollow ring at the pending next point.
    if (cur) {
      overlay
        .append('circle')
        .attr('cx', cur[0])
        .attr('cy', cur[1])
        .attr('r', handleR * 1.5)
        .attr('fill', 'none')
        .attr('stroke', RUBBER_BAND_STROKE)
        .attr('stroke-width', 1.5)
        .style('vector-effect', 'non-scaling-stroke')
    }
  }

  const sel = editor.selectedElement
  if (sel && editor.tool === 'select') {
    const coords = sel.geometry.type === 'Point' ? [sel.geometry.coordinates] : sel.geometry.coordinates
    const isPoint = sel.geometry.type === 'Point'
    const handles = overlay
      .selectAll('circle.sv')
      .data(coords.map((c, i) => ({ c: c as Point, i })))
      .enter()
      .append('circle')
      .attr('class', 'sv')
      .attr('cx', (h) => h.c[0])
      .attr('cy', (h) => h.c[1])
      .attr('r', handleR * 1.15)
      .attr('fill', '#fff')
      .attr('stroke', EDIT_HANDLE_FILL)
      .attr('stroke-width', 2)
      .style('vector-effect', 'non-scaling-stroke')
      .style('pointer-events', 'all')
      .style('cursor', 'pointer')
    const elLayer = viewport.select<SVGGElement>('g.elements')
    const renderLive = (geom: typeof sel.geometry) =>
      elLayer
        .selectAll<SVGGElement, FloorElement>('g.element')
        .filter((el) => el.id === sel.id)
        .datum({ ...sel, geometry: geom })
        .call(renderElement, {
          effectivePxPerMeter: viewToPx * k,
          selectedId: sel.id,
          interactive: true,
          boundary,
        })
    const vertexDrag = d3
      .drag<SVGCircleElement, { c: Point; i: number }>()
      .container(dragContainer)
      .on('start', (event) => event.sourceEvent.stopPropagation())
      .on('drag', function (event, h) {
        d3.select(this).attr('cx', event.x).attr('cy', event.y)
        renderLive(setVertex(sel.geometry, isPoint ? 0 : h.i, [event.x, event.y]))
      })
      .on('end', (event, h) => editor.endVertexDrag(sel.id, isPoint ? 0 : h.i, [event.x, event.y]))
    handles.call(vertexDrag)
  }

  if (d?.mode === 'ruler') {
    const [a, b] = d.points
    overlay
      .append('line')
      .attr('class', 'ruler')
      .attr('x1', a[0])
      .attr('y1', a[1])
      .attr('x2', b[0])
      .attr('y2', b[1])
      .attr('stroke', RULER_STROKE)
      .attr('stroke-width', 2)
      .style('vector-effect', 'non-scaling-stroke')
    const font = pxToMeters(12, k)
    overlay
      .append('text')
      .attr('class', 'ruler-label')
      .attr('x', (a[0] + b[0]) / 2)
      .attr('y', (a[1] + b[1]) / 2 - font)
      .attr('text-anchor', 'middle')
      .attr('font-family', '"IBM Plex Mono", ui-monospace, monospace')
      .attr('font-size', font)
      .attr('fill', RULER_STROKE)
      .attr('stroke', 'rgba(255,255,255,0.9)')
      .attr('stroke-width', font * 0.22)
      .style('paint-order', 'stroke')
      .text(formatMeters(distance(a, b)))
    const ends = overlay
      .selectAll('circle.re')
      .data([0, 1] as const)
      .enter()
      .append('circle')
      .attr('class', 're')
      .attr('cx', (i) => d.points[i][0])
      .attr('cy', (i) => d.points[i][1])
      .attr('r', handleR * 1.3)
      .attr('fill', '#fff')
      .attr('stroke', RULER_STROKE)
      .attr('stroke-width', 2)
      .style('vector-effect', 'non-scaling-stroke')
      .style('pointer-events', 'all')
      .style('cursor', 'pointer')
    const rulerDrag = d3
      .drag<SVGCircleElement, 0 | 1>()
      .container(dragContainer)
      .on('start', (event) => event.sourceEvent.stopPropagation())
      .on('drag', function (event, i) {
        d3.select(this).attr('cx', event.x).attr('cy', event.y)
        overlay
          .select('line.ruler')
          .attr(i === 0 ? 'x1' : 'x2', event.x)
          .attr(i === 0 ? 'y1' : 'y2', event.y)
      })
      .on('end', (event, i) => editor.moveRulerEnd(i, [event.x, event.y]))
    ends.call(rulerDrag)
  }

  // "Parking row" tool: dashed baseline + a dashed preview rect per stall,
  // plus draggable baseline endpoints once the row is placed. Mirrors the
  // ruler above; all sizes are meters, strokes non-scaling.
  const rt = spotRowTool
  if (rt?.active && rt.baseline) {
    const { p0, p1 } = rt.baseline
    const g = overlay.append('g').attr('class', 'row-preview')
    g.append('line')
      .attr('x1', p0[0])
      .attr('y1', p0[1])
      .attr('x2', p1[0])
      .attr('y2', p1[1])
      .attr('stroke', SPOT_SELECTED_STROKE)
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4 3')
      .style('vector-effect', 'non-scaling-stroke')
    g.selectAll<SVGRectElement, (typeof rt.placements)[number]>('rect.row-cell')
      .data(rt.placements)
      .enter()
      .append('rect')
      .attr('class', 'row-cell')
      .attr('transform', (p) => `translate(${p.posX},${p.posY}) rotate(${p.rotation})`)
      .attr('x', (p) => -p.width / 2)
      .attr('y', (p) => -p.height / 2)
      .attr('width', (p) => p.width)
      .attr('height', (p) => p.height)
      .attr('rx', 0.15)
      .attr('fill', 'rgba(37,99,235,0.08)')
      .attr('stroke', SPOT_SELECTED_STROKE)
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4 3')
      .style('vector-effect', 'non-scaling-stroke')
    const rowFont = pxToMeters(12, k)
    g.append('text')
      .attr('x', (p0[0] + p1[0]) / 2)
      .attr('y', (p0[1] + p1[1]) / 2 - rowFont)
      .attr('text-anchor', 'middle')
      .attr('font-family', '"IBM Plex Mono", ui-monospace, monospace')
      .attr('font-size', rowFont)
      .attr('fill', SPOT_SELECTED_STROKE)
      .attr('stroke', 'rgba(255,255,255,0.9)')
      .attr('stroke-width', rowFont * 0.22)
      .style('paint-order', 'stroke')
      .text(`${rt.placements.length} ${rt.placements.length === 1 ? 'bay' : 'bays'}`)
    if (rt.phase === 'ready') {
      const pts: [Point, Point] = [p0, p1]
      const rowEnds = g
        .selectAll<SVGCircleElement, 0 | 1>('circle.rb')
        .data([0, 1] as const)
        .enter()
        .append('circle')
        .attr('class', 'rb')
        .attr('cx', (i) => pts[i][0])
        .attr('cy', (i) => pts[i][1])
        .attr('r', handleR * 1.3)
        .attr('fill', '#fff')
        .attr('stroke', SPOT_SELECTED_STROKE)
        .attr('stroke-width', 2)
        .style('vector-effect', 'non-scaling-stroke')
        .style('pointer-events', 'all')
        .style('cursor', 'pointer')
      const rowDrag = d3
        .drag<SVGCircleElement, 0 | 1>()
        .container(dragContainer)
        .on('start', (event) => event.sourceEvent.stopPropagation())
        .on('drag', function (event) {
          d3.select(this).attr('cx', event.x).attr('cy', event.y)
        })
        .on('end', (event, i) => rt.moveBaselineEnd(i, [event.x, event.y]))
      rowEnds.call(rowDrag)
    }
  }
}
