import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { FloorElement, Spot } from '../../types'
import { GRID_STROKE, ZOOM_SCALE_EXTENT } from './floorElementStyles'
import { bboxOfGeometry, bboxOfSpots, unionBbox, type Bbox, type Point } from './geometry'
import type { FloorPlanEditorBag } from './useFloorPlanEditor'
import type { SpotRowToolBag } from './useSpotRowTool'
import { drawChrome } from './floorMap/chrome'
import { drawOverlay } from './floorMap/overlay'
import { renderElementsLayer } from './floorMap/elementsLayer'
import { bindHitLayer } from './floorMap/hitLayer'
import { renderSpotsLayer } from './floorMap/spotsLayer'
import type { ViewBox } from './floorMap/types'

const PADDING_M = 3
const MIN_VIEW_W_M = 40
const MIN_VIEW_H_M = 28

interface FloorMapProps {
  spots: Spot[]
  elements?: FloorElement[]
  selectedSpotIds?: ReadonlySet<string>
  showScaleBar?: boolean
  showGrid?: boolean
  gridStepM?: number
  fitToken?: number
  onSpotClick?: (spot: Spot, event: MouseEvent) => void
  onSpotDragEnd?: (spot: Spot, posX: number, posY: number) => void
  onSpotGroupDragEnd?: (moves: Array<{ spot: Spot; posX: number; posY: number }>) => void
  onMarqueeSelect?: (ids: string[], additive: boolean) => void
  onCanvasClick?: () => void
  editor?: FloorPlanEditorBag
  spotRowTool?: SpotRowToolBag
  className?: string
}

export function FloorMap({
  spots,
  elements,
  selectedSpotIds,
  showScaleBar,
  showGrid,
  gridStepM,
  fitToken,
  onSpotClick,
  onSpotDragEnd,
  onSpotGroupDragEnd,
  onMarqueeSelect,
  onCanvasClick,
  editor,
  spotRowTool,
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
    const paintRank = (k: FloorElement['kind']) =>
      k === 'BOUNDARY' ? 0 : k === 'ENTRANCE' ? 2 : k === 'LABEL' ? 3 : 1
    const els = (elements ?? []).slice().sort((a, b) => paintRank(a.kind) - paintRank(b.kind))
    const selectMode = !editor || editor.tool === 'select'
    const step = gridStepM && gridStepM > 0 ? gridStepM : 5

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

    const drafting = !!editor?.draft || (!!spotRowTool?.active && !!spotRowTool.baseline)
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

    const redrawChrome = (k: number) => drawChrome(chrome, vb, viewToPx, showScaleBar, k)
    const redrawOverlay = (k: number) =>
      drawOverlay(overlay, viewport, dragContainer, k, {
        editor,
        spotRowTool,
        cursor: cursorRef.current,
        boundary,
        viewToPx,
        pxToMeters,
      })

    // Pan/zoom. Recreated each run so its closures see fresh props; the
    // transform itself lives on the DOM node and survives re-runs.
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
        redrawChrome(event.transform.k)
        redrawOverlay(event.transform.k)
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

    renderElementsLayer(viewport, dragContainer, els, {
      effectivePxPerMeter: viewToPx * k0,
      editor,
      boundary,
    })

    const hit = viewport.select<SVGRectElement>('rect.hit')
    bindHitLayer(hit, overlay, dragContainer, viewportNode, svgEl, {
      vb,
      spots,
      pxToMeters,
      cursorRef,
      redrawOverlay,
      editor,
      spotRowTool,
      onMarqueeSelect,
      onCanvasClick,
    })

    renderSpotsLayer(viewport, dragContainer, spots, {
      selectedSpotIds,
      selectMode,
      labelFont: 11 / (viewToPx * k0),
      onSpotClick,
      onSpotDragEnd,
      onSpotGroupDragEnd,
    })

    redrawChrome(k0)
    redrawOverlay(k0)
  }, [
    spots,
    elements,
    selectedSpotIds,
    showScaleBar,
    showGrid,
    gridStepM,
    fitToken,
    onSpotClick,
    onSpotDragEnd,
    onSpotGroupDragEnd,
    onMarqueeSelect,
    onCanvasClick,
    editor,
    spotRowTool,
  ])

  return (
    <svg ref={svgRef} className={className ?? 'h-full w-full'}>
      <defs>
        <filter id="spot-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0.05" stdDeviation="0.06" floodColor="#0f172a" floodOpacity="0.14" />
        </filter>
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
