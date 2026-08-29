import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { FloorElement, Spot } from '../../types'
import { SPOT_COLORS, SPOT_LABEL_COLOR, SPOT_SELECTED_STROKE, SPOT_STROKE } from './spotColors'
import {
  ELEMENT_COLORS,
  ENTRANCE_ARROW_LEN_M,
  EDIT_HANDLE_FILL,
  EDIT_HANDLE_RADIUS_PX,
  GRID_STROKE,
  RUBBER_BAND_STROKE,
  RULER_STROKE,
  SCALE_BAR_COLOR,
  ZOOM_SCALE_EXTENT,
} from './floorElementStyles'
import {
  bboxOfGeometry,
  bboxOfSpots,
  distance,
  formatMeters,
  niceScaleBarLength,
  unionBbox,
  type Bbox,
  type Point,
} from './geometry'
import { renderElement } from './floorElements'
import type { FloorPlanEditorBag } from './useFloorPlanEditor'

const PADDING_M = 2
const MIN_VIEW_W_M = 20
const MIN_VIEW_H_M = 14

interface ViewBox {
  x: number
  y: number
  w: number
  h: number
}

interface FloorMapProps {
  spots: Spot[]
  elements?: FloorElement[]
  selectedSpotId?: string
  showScaleBar?: boolean
  showGrid?: boolean
  gridStepM?: number
  /** Bumping this number resets pan/zoom to fit. */
  fitToken?: number
  onSpotClick?: (spot: Spot) => void
  /** Called on drag end with the spot's new x/y (meters) - only used by the admin layout editor. */
  onSpotDragEnd?: (spot: Spot, posX: number, posY: number) => void
  /** Present only in the admin editor - enables plan-drawing tools. */
  editor?: FloorPlanEditorBag
  className?: string
}

function polyD(pts: Point[], close: boolean): string {
  if (pts.length === 0) return ''
  const [h, ...rest] = pts
  return `M${h[0]},${h[1]}` + rest.map((p) => `L${p[0]},${p[1]}`).join('') + (close ? 'Z' : '')
}

/**
 * Renders a floor plan: the outer boundary, columns, drive lanes, streets and
 * entrances (the `elements` layer), then every bay as a color-coded stall on top.
 * "React owns the `<svg>` container, D3 owns the children": the effect below
 * re-runs the enter/update/exit joins whenever the inputs change. When `editor`
 * is passed, D3 also draws the drawing rubber-band / vertex handles / calibrate
 * ruler and wires pointer + `d3.zoom` (wheel zoom, drag pan) interactions -
 * still all from props, no per-element JSX.
 */
export function FloorMap({
  spots,
  elements,
  selectedSpotId,
  showScaleBar,
  showGrid,
  gridStepM,
  fitToken,
  onSpotClick,
  onSpotDragEnd,
  editor,
  className,
}: FloorMapProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const frozenVbRef = useRef<ViewBox | null>(null)
  const cursorRef = useRef<Point | null>(null)
  const lastFitRef = useRef<number | undefined>(undefined)
  const wasDraftingRef = useRef(false)

  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return
    const svg = d3.select(svgEl)
    const els = elements ?? []
    const selectMode = !editor || editor.tool === 'select'
    const step = gridStepM && gridStepM > 0 ? gridStepM : 5

    // 1. Content bbox (meters): the boundary frames the plan if there is one,
    //    otherwise fall back to the union of everything drawn.
    const boundary = els.find((e) => e.kind === 'BOUNDARY')
    const box: Bbox =
      (boundary
        ? bboxOfGeometry(boundary.geometry)
        : unionBbox([bboxOfSpots(spots), ...els.map((e) => bboxOfGeometry(e.geometry))])) ?? {
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0,
      }

    // 2. viewBox - frozen while a draw/calibrate draft is in progress so the
    //    canvas doesn't jump under the cursor.
    const drafting = !!editor?.draft
    let vb: ViewBox
    if (drafting && frozenVbRef.current) {
      vb = frozenVbRef.current
    } else {
      let { minX, minY } = box
      const { maxX, maxY } = box
      if (!boundary) {
        minX = Math.min(minX, 0)
        minY = Math.min(minY, 0)
      }
      const contentW = Math.max(maxX - minX, MIN_VIEW_W_M)
      const contentH = Math.max(maxY - minY, MIN_VIEW_H_M)
      vb = {
        x: minX - PADDING_M,
        y: minY - PADDING_M,
        w: contentW + PADDING_M * 2,
        h: contentH + PADDING_M * 2,
      }
      frozenVbRef.current = vb
    }
    svg.attr('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`)

    const clientW = svgEl.clientWidth || 1
    const viewToPx = clientW / vb.w // px per meter at zoom k=1
    const pxToMeters = (px: number, k: number) => px / (viewToPx * k)

    const viewport = svg.select<SVGGElement>('g.viewport')
    const viewportNode = viewport.node()
    if (!viewportNode) return
    const dragContainer: SVGGElement = viewportNode
    const overlay = viewport.select<SVGGElement>('g.overlay')
    const chrome = svg.select<SVGGElement>('g.chrome')

    // 3. Scale bar (screen-pinned - lives outside the zoomed viewport).
    function drawChrome(k: number) {
      chrome.selectAll('*').remove()
      if (!showScaleBar) return
      const len = niceScaleBarLength(vb.w / k)
      const barUnits = len * k // chrome units are pre-zoom meters
      const x0 = vb.x + vb.w * 0.04
      const y0 = vb.y + vb.h - vb.h * 0.06
      const tick = 6 / viewToPx
      const font = 11 / viewToPx
      const g = chrome.append('g')
      g.append('line')
        .attr('x1', x0)
        .attr('y1', y0)
        .attr('x2', x0 + barUnits)
        .attr('y2', y0)
        .attr('stroke', SCALE_BAR_COLOR)
        .attr('stroke-width', 2)
        .style('vector-effect', 'non-scaling-stroke')
      for (const x of [x0, x0 + barUnits]) {
        g.append('line')
          .attr('x1', x)
          .attr('y1', y0 - tick)
          .attr('x2', x)
          .attr('y2', y0 + tick)
          .attr('stroke', SCALE_BAR_COLOR)
          .attr('stroke-width', 2)
          .style('vector-effect', 'non-scaling-stroke')
      }
      g.append('text')
        .attr('x', x0 + barUnits / 2)
        .attr('y', y0 - tick - font * 0.4)
        .attr('text-anchor', 'middle')
        .attr('font-family', '"IBM Plex Mono", ui-monospace, monospace')
        .attr('font-size', font)
        .attr('fill', SCALE_BAR_COLOR)
        .attr('stroke', 'rgba(255,255,255,0.85)')
        .attr('stroke-width', font * 0.28)
        .style('paint-order', 'stroke')
        .text(`${len} m`)
    }

    // 7. Editor overlay: draft rubber-band, vertex handles, calibrate ruler.
    function drawOverlay(k: number) {
      overlay.selectAll('*').remove()
      if (!editor) return
      const handleR = pxToMeters(EDIT_HANDLE_RADIUS_PX, k)
      const d = editor.draft

      if (d?.mode === 'shape') {
        const raw = cursorRef.current
        // Preview where the point will actually land (snapped), not the raw cursor.
        const cur = raw ? editor.snapDraftPoint(raw) : null
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

          // Live dimensions: length (m) at each segment's midpoint, nudged off
          // the line. The segment being stretched (last, when the cursor is
          // live) is drawn solid; already-placed ones are muted.
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
        const coords =
          sel.geometry.type === 'Point' ? [sel.geometry.coordinates] : sel.geometry.coordinates
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
        const vertexDrag = d3
          .drag<SVGCircleElement, { c: Point; i: number }>()
          .container(dragContainer)
          .on('start', (event) => event.sourceEvent.stopPropagation())
          .on('drag', function (event) {
            d3.select(this).attr('cx', event.x).attr('cy', event.y)
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
    }

    // 4. Pan/zoom. Recreated each run so its closures see fresh props; the
    //    transform itself lives on the DOM node and survives re-runs.
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent(ZOOM_SCALE_EXTENT)
      .filter((event: Event) => {
        if (event.type === 'wheel') return true
        if (event.type === 'dblclick') return false
        return !editor || editor.tool === 'select'
      })
      .on('zoom', (event) => {
        viewport.attr('transform', event.transform.toString())
        drawChrome(event.transform.k)
        drawOverlay(event.transform.k)
      })
    svg.call(zoom).on('dblclick.zoom', null)

    // Re-fit when the caller bumps fitToken, and also right after a draw/
    // calibrate draft ends - the frozen viewBox is gone, so snap the (possibly
    // zoomed-out) transform back to the fresh fit instead of leaving content
    // stranded off-screen.
    const draftJustEnded = wasDraftingRef.current && !drafting
    wasDraftingRef.current = drafting
    if (fitToken !== lastFitRef.current || draftJustEnded) {
      lastFitRef.current = fitToken
      svg.call(zoom.transform, d3.zoomIdentity)
    }
    const k0 = d3.zoomTransform(svgEl).k || 1
    viewport.attr('transform', d3.zoomTransform(svgEl).toString())

    // 5. Grid pattern (world-aligned; rect overshoots the viewBox so panning
    //    still shows grid). Kept to a small multiple - a huge tiled pattern is
    //    expensive, and the grid is a cosmetic aid.
    const gpad = Math.max(vb.w, vb.h)
    svg.select('#meter-grid').attr('width', step).attr('height', step)
    svg.select('#meter-grid path.grid-cell').attr('d', `M${step},0 L0,0 L0,${step}`)
    svg
      .select('rect.grid-fill')
      .attr('x', vb.x - gpad)
      .attr('y', vb.y - gpad)
      .attr('width', vb.w + gpad * 2)
      .attr('height', vb.h + gpad * 2)
      .attr('display', showGrid ? null : 'none')

    // 6. Elements layer.
    const elJoin = viewport
      .select<SVGGElement>('g.elements')
      .selectAll<SVGGElement, FloorElement>('g.element')
      .data(els, (d) => d.id)
    elJoin.exit().remove()
    const elMerged = elJoin.enter().append('g').attr('class', 'element').merge(elJoin)
    elMerged.style('pointer-events', editor && editor.tool === 'select' ? 'auto' : 'none')
    renderElement(elMerged, {
      effectivePxPerMeter: viewToPx * k0,
      selectedId: editor?.selectedElementId,
      interactive: !!editor,
    })
    if (editor && editor.tool === 'select') {
      elMerged.style('cursor', 'move').on('click', (event, d) => {
        event.stopPropagation()
        editor.selectElement(d.id)
      })
      const bodyDrag = d3
        .drag<SVGGElement, FloorElement>()
        .container(dragContainer)
        .on('start', (event) => event.sourceEvent.stopPropagation())
        .on('drag', function (event) {
          const node = this as SVGGElement & { __dx?: number; __dy?: number }
          node.__dx = (node.__dx ?? 0) + event.dx
          node.__dy = (node.__dy ?? 0) + event.dy
          d3.select(this).attr('transform', `translate(${node.__dx},${node.__dy})`)
        })
        .on('end', function (_event, d) {
          const node = this as SVGGElement & { __dx?: number; __dy?: number }
          const dx = node.__dx ?? 0
          const dy = node.__dy ?? 0
          node.__dx = 0
          node.__dy = 0
          d3.select(this).attr('transform', null)
          editor.endElementDrag(d.id, dx, dy)
        })
      elMerged.call(bodyDrag)
    } else {
      elMerged.on('.drag', null).on('click', null).style('cursor', null)
    }

    // 6b. Pointer surface for drawing (below spots/elements so their own
    //     handlers win; catches clicks on empty canvas). It lives inside the
    //     zoomed viewport, so at the zoomed-out limit the visible area is
    //     1/ZOOM_SCALE_EXTENT[0] times the viewBox; pad by that (plus slack for
    //     panning) or a click near the edge misses the rect and does nothing.
    //     It's transparent and unpatterned, so an oversized rect is cheap.
    const hitPad = (Math.max(vb.w, vb.h) * 3) / ZOOM_SCALE_EXTENT[0]
    const hit = viewport.select<SVGRectElement>('rect.hit')
    hit
      .attr('x', vb.x - hitPad)
      .attr('y', vb.y - hitPad)
      .attr('width', vb.w + hitPad * 2)
      .attr('height', vb.h + hitPad * 2)
      .attr('fill', 'transparent')
      .style('pointer-events', editor ? 'all' : 'none')
    if (editor) {
      const activeEditor = editor
      const placing = activeEditor.tool !== 'select'
      const place = (event: MouseEvent) => {
        const [mx, my] = d3.pointer(event, viewportNode)
        activeEditor.canvasClick([mx, my])
      }
      hit
        .style('cursor', placing ? 'crosshair' : 'default')
        .on('mousemove', (event: MouseEvent) => {
          cursorRef.current = d3.pointer(event, viewportNode) as Point
          if (activeEditor.draft?.mode === 'shape') drawOverlay(d3.zoomTransform(svgEl).k || 1)
        })
        .on('dblclick', (event: MouseEvent) => {
          event.preventDefault()
          activeEditor.canvasDblClick()
        })
      if (placing) {
        // In a drawing tool the point drops where you press - crisp, and a small
        // wobble on the button won't cancel it the way `click` would.
        hit.on('click', null).on('mousedown', (event: MouseEvent) => {
          if (event.button !== 0) return
          event.preventDefault()
          place(event)
        })
      } else {
        // `select` stays on `click` so a pan-drag doesn't deselect.
        hit.on('mousedown', null).on('click', (event: MouseEvent) => place(event))
      }
    } else {
      hit.on('mousedown', null).on('click', null).on('mousemove', null).on('dblclick', null)
    }

    // 8. Spots layer (unchanged shape; sized in meters now).
    const drag = d3
      .drag<SVGGElement, Spot>()
      .container(dragContainer)
      .on('start', function (event) {
        event.sourceEvent.stopPropagation()
        d3.select(this).raise().classed('is-dragging', true)
      })
      .on('drag', function (event, d) {
        d3.select(this).attr('transform', `translate(${event.x}, ${event.y}) rotate(${d.rotation})`)
      })
      .on('end', function (event, d) {
        d3.select(this).classed('is-dragging', false)
        onSpotDragEnd?.(d, event.x, event.y)
      })

    const groups = viewport
      .select<SVGGElement>('g.spots')
      .selectAll<SVGGElement, Spot>('g.spot')
      .data(spots, (d) => d.id)

    groups.exit().remove()

    const entered = groups
      .enter()
      .append('g')
      .attr('class', 'spot')
      .style('cursor', onSpotClick || onSpotDragEnd ? 'pointer' : 'default')

    entered
      .append('rect')
      .attr('class', 'spot-rect')
      .attr('rx', 0.25)
      .style('transition', 'fill 200ms ease')
      .style('vector-effect', 'non-scaling-stroke')
      .attr('filter', 'url(#spot-shadow)')
    entered
      .append('rect')
      .attr('class', 'spot-paint')
      .attr('fill', 'none')
      .attr('pointer-events', 'none')
      .style('vector-effect', 'non-scaling-stroke')
    entered
      .append('text')
      .attr('class', 'spot-label')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-family', '"IBM Plex Mono", ui-monospace, monospace')
      .attr('font-weight', 600)
      .attr('fill', SPOT_LABEL_COLOR)
      .attr('stroke', 'rgba(255,255,255,0.85)')
      .style('paint-order', 'stroke')
      .attr('pointer-events', 'none')

    const merged = entered.merge(groups)
    const labelFont = 11 / (viewToPx * k0)

    merged
      .attr('transform', (d) => `translate(${d.posX}, ${d.posY}) rotate(${d.rotation})`)
      .on('click', (_event, d) => onSpotClick?.(d))
    if (selectMode) merged.style('pointer-events', null)
    else merged.style('pointer-events', 'none')

    if (onSpotDragEnd && selectMode) {
      merged.call(drag)
    } else {
      merged.on('.drag', null)
    }

    merged
      .select<SVGRectElement>('rect.spot-rect')
      .attr('x', (d) => -d.width / 2)
      .attr('y', (d) => -d.height / 2)
      .attr('width', (d) => d.width)
      .attr('height', (d) => d.height)
      .attr('fill', (d) => SPOT_COLORS[d.status])
      .attr('fill-opacity', (d) => (d.status === 'DISABLED' ? 0.55 : 0.9))
      .attr('stroke', (d) => (d.id === selectedSpotId ? SPOT_SELECTED_STROKE : 'rgba(15,23,42,0.12)'))
      .attr('stroke-width', (d) => (d.id === selectedSpotId ? 2.5 : 1))

    merged
      .select<SVGRectElement>('rect.spot-paint')
      .attr('x', (d) => -d.width / 2 + 0.18)
      .attr('y', (d) => -d.height / 2 + 0.18)
      .attr('width', (d) => Math.max(d.width - 0.36, 0))
      .attr('height', (d) => Math.max(d.height - 0.36, 0))
      .attr('rx', 0.15)
      .attr('stroke', SPOT_STROKE)
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.7)
      .attr('stroke-dasharray', (d) => (d.status === 'MAINTENANCE' ? '4 3' : null))

    merged
      .select<SVGTextElement>('text.spot-label')
      .attr('font-size', labelFont)
      .attr('stroke-width', labelFont * 0.28)
      .text((d) => d.code)

    drawChrome(k0)
    drawOverlay(k0)
  }, [
    spots,
    elements,
    selectedSpotId,
    showScaleBar,
    showGrid,
    gridStepM,
    fitToken,
    onSpotClick,
    onSpotDragEnd,
    editor,
  ])

  return (
    <svg ref={svgRef} className={className ?? 'h-full w-full'}>
      <defs>
        <filter id="spot-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0.05" stdDeviation="0.06" floodColor="#0f172a" floodOpacity="0.14" />
        </filter>
        <marker
          id="entrance-arrow"
          viewBox="0 0 10 10"
          markerUnits="userSpaceOnUse"
          markerWidth={ENTRANCE_ARROW_LEN_M}
          markerHeight={ENTRANCE_ARROW_LEN_M}
          refX="7.5"
          refY="5"
          orient="auto"
        >
          <path d="M0,0 L10,5 L0,10 Z" fill={ELEMENT_COLORS.ENTRANCE.fill} />
        </marker>
        <pattern id="meter-grid" patternUnits="userSpaceOnUse" width={5} height={5}>
          <path
            className="grid-cell"
            d="M5,0 L0,0 L0,5"
            fill="none"
            stroke={GRID_STROKE}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </pattern>
      </defs>
      <g className="viewport">
        <rect className="grid-fill" fill="url(#meter-grid)" display="none" />
        <rect className="hit" fill="transparent" style={{ pointerEvents: 'none' }} />
        <g className="elements" />
        <g className="spots" />
        <g className="overlay" style={{ pointerEvents: 'none' }} />
      </g>
      <g className="chrome" style={{ pointerEvents: 'none' }} />
    </svg>
  )
}
