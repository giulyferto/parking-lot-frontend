import * as d3 from 'd3'
import type { MutableRefObject } from 'react'
import type { Spot } from '../../../types'
import { RUBBER_BAND_STROKE, ZOOM_SCALE_EXTENT } from '../floorElementStyles'
import { bboxesIntersect, bboxOfSpot, distance, type Bbox, type Point } from '../geometry'
import type { FloorPlanEditorBag } from '../useFloorPlanEditor'
import type { SpotRowToolBag } from '../useSpotRowTool'
import type { ViewBox } from './types'

export interface HitLayerCtx {
  vb: ViewBox
  spots: Spot[]
  pxToMeters: (px: number, k: number) => number
  cursorRef: MutableRefObject<Point | null>
  redrawOverlay: (k: number) => void
  editor?: FloorPlanEditorBag
  spotRowTool?: SpotRowToolBag
  onMarqueeSelect?: (ids: string[], additive: boolean) => void
  onCanvasClick?: () => void
}

export function bindHitLayer(
  hit: d3.Selection<SVGRectElement, unknown, null, undefined>,
  overlay: d3.Selection<SVGGElement, unknown, null, undefined>,
  dragContainer: SVGGElement,
  viewportNode: SVGGElement,
  svgEl: SVGSVGElement,
  ctx: HitLayerCtx,
): void {
  const { vb, spots, pxToMeters, cursorRef, redrawOverlay, editor, spotRowTool, onMarqueeSelect, onCanvasClick } = ctx

  const hitPad = (Math.max(vb.w, vb.h) * 3) / ZOOM_SCALE_EXTENT[0]
  hit
    .attr('x', vb.x - hitPad)
    .attr('y', vb.y - hitPad)
    .attr('width', vb.w + hitPad * 2)
    .attr('height', vb.h + hitPad * 2)
    .attr('fill', 'transparent')
    .style('pointer-events', editor ? 'all' : 'none')

  if (!editor) {
    hit.on('.drag', null).on('mousedown', null).on('click', null).on('mousemove', null).on('dblclick', null)
    return
  }

  const activeEditor = editor
  const rowActive = !!spotRowTool?.active
  const placing = activeEditor.tool !== 'select'
  const place = (event: MouseEvent) => {
    const [mx, my] = d3.pointer(event, viewportNode)
    if (rowActive && spotRowTool) spotRowTool.canvasClick([mx, my])
    else activeEditor.canvasClick([mx, my])
  }
  hit
    .style('cursor', placing ? 'crosshair' : 'default')
    .on('mousemove', (event: MouseEvent) => {
      const world = d3.pointer(event, viewportNode) as Point
      cursorRef.current = world
      if (activeEditor.draft?.mode === 'shape') redrawOverlay(d3.zoomTransform(svgEl).k || 1)
      if (rowActive && spotRowTool?.baseline) {
        spotRowTool.handlePointerMove(world)
        redrawOverlay(d3.zoomTransform(svgEl).k || 1)
      }
    })
    .on('dblclick', (event: MouseEvent) => {
      event.preventDefault()
      activeEditor.canvasDblClick()
    })

  if (placing) {
    hit.on('.drag', null).on('click', null).on('mousedown', (event: MouseEvent) => {
      if (event.button !== 0) return
      event.preventDefault()
      place(event)
    })
  } else if (onMarqueeSelect) {
    let marqueeStart: Point | null = null
    let marqueeMoved = false
    const moveThreshold = pxToMeters(4, d3.zoomTransform(svgEl).k || 1)
    const marqueeDrag = d3
      .drag<SVGRectElement, unknown>()
      .container(dragContainer)
      .on('start', (event) => {
        marqueeStart = [event.x, event.y]
        marqueeMoved = false
      })
      .on('drag', (event) => {
        if (!marqueeStart) return
        if (!marqueeMoved && distance(marqueeStart, [event.x, event.y]) > moveThreshold) {
          marqueeMoved = true
        }
        if (!marqueeMoved) return
        const x0 = Math.min(marqueeStart[0], event.x)
        const y0 = Math.min(marqueeStart[1], event.y)
        const w = Math.abs(event.x - marqueeStart[0])
        const h = Math.abs(event.y - marqueeStart[1])
        let rect = overlay.select<SVGRectElement>('rect.marquee')
        if (rect.empty()) {
          rect = overlay
            .append('rect')
            .attr('class', 'marquee')
            .attr('fill', 'rgba(37,99,235,0.08)')
            .attr('stroke', RUBBER_BAND_STROKE)
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '4 3')
            .style('vector-effect', 'non-scaling-stroke')
        }
        rect.attr('x', x0).attr('y', y0).attr('width', w).attr('height', h)
      })
      .on('end', (event) => {
        const start = marqueeStart
        marqueeStart = null
        overlay.select('rect.marquee').remove()
        const additive = !!(event.sourceEvent as MouseEvent).shiftKey || !!(event.sourceEvent as MouseEvent).metaKey || !!(event.sourceEvent as MouseEvent).ctrlKey
        if (!marqueeMoved || !start) {
          place(event.sourceEvent as MouseEvent)
          onCanvasClick?.()
          return
        }
        const box: Bbox = {
          minX: Math.min(start[0], event.x),
          minY: Math.min(start[1], event.y),
          maxX: Math.max(start[0], event.x),
          maxY: Math.max(start[1], event.y),
        }
        const ids = spots.filter((s) => bboxesIntersect(bboxOfSpot(s), box)).map((s) => s.id)
        onMarqueeSelect(ids, additive)
      })
    hit.on('mousedown', null).on('click', null).call(marqueeDrag)
  } else {
    hit.on('.drag', null).on('mousedown', null).on('click', (event: MouseEvent) => place(event))
  }
}
