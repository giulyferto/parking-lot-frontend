import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { Spot } from '../../types'
import { SPOT_COLORS, SPOT_LABEL_COLOR, SPOT_SELECTED_STROKE, SPOT_STROKE } from './spotColors'

const PADDING = 40

interface FloorMapProps {
  spots: Spot[]
  selectedSpotId?: string
  onSpotClick?: (spot: Spot) => void
  /** Called on drag end with the spot's new x/y - only used by the admin layout editor. */
  onSpotDragEnd?: (spot: Spot, posX: number, posY: number) => void
  className?: string
}

/**
 * Renders every bay on a floor as a color-coded stall with a near-white
 * "paint" outline. This is a "React owns the container, D3 owns the children"
 * component: the effect below re-runs the D3 enter/update/exit join whenever
 * `spots` changes (including from a WebSocket push - see useFloorSocket), and a
 * CSS fill transition on the stall makes each status flip visible.
 */
export function FloorMap({ spots, selectedSpotId, onSpotClick, onSpotDragEnd, className }: FloorMapProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)

  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)

    const maxX = spots.length ? d3.max(spots, (s) => s.posX + s.width) ?? 0 : 0
    const maxY = spots.length ? d3.max(spots, (s) => s.posY + s.height) ?? 0 : 0
    const minX = spots.length ? d3.min(spots, (s) => s.posX) ?? 0 : 0
    const minY = spots.length ? d3.min(spots, (s) => s.posY) ?? 0 : 0
    const viewWidth = Math.max(maxX - Math.min(minX, 0), 400) + PADDING * 2
    const viewHeight = Math.max(maxY - Math.min(minY, 0), 300) + PADDING * 2
    svg.attr('viewBox', `${Math.min(minX, 0) - PADDING} ${Math.min(minY, 0) - PADDING} ${viewWidth} ${viewHeight}`)

    const drag = d3
      .drag<SVGGElement, Spot>()
      .on('start', function () {
        d3.select(this).raise().classed('is-dragging', true)
      })
      .on('drag', function (event, d) {
        d3.select(this).attr('transform', `translate(${event.x}, ${event.y}) rotate(${d.rotation})`)
      })
      .on('end', function (event, d) {
        d3.select(this).classed('is-dragging', false)
        onSpotDragEnd?.(d, event.x, event.y)
      })

    const groups = svg
      .select<SVGGElement>('g.spots')
      .selectAll<SVGGElement, Spot>('g.spot')
      .data(spots, (d) => d.id)

    groups.exit().remove()

    const entered = groups
      .enter()
      .append('g')
      .attr('class', 'spot')
      .style('cursor', onSpotClick || onSpotDragEnd ? 'pointer' : 'default')

    // Two rects: the status fill, then an inset near-white "painted line".
    entered
      .append('rect')
      .attr('class', 'spot-rect')
      .attr('rx', 5)
      .style('transition', 'fill 200ms ease')
      .attr('filter', 'url(#spot-shadow)')
    entered.append('rect').attr('class', 'spot-paint').attr('fill', 'none').attr('pointer-events', 'none')
    entered
      .append('text')
      .attr('class', 'spot-label')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-family', '"IBM Plex Mono", ui-monospace, monospace')
      .attr('font-size', 11)
      .attr('font-weight', 600)
      .attr('letter-spacing', 0.5)
      .attr('fill', SPOT_LABEL_COLOR)
      // Thin light halo so the code stays legible on any status fill.
      .attr('stroke', 'rgba(255,255,255,0.85)')
      .attr('stroke-width', 3)
      .style('paint-order', 'stroke')
      .attr('pointer-events', 'none')

    const merged = entered.merge(groups)

    merged
      .attr('transform', (d) => `translate(${d.posX}, ${d.posY}) rotate(${d.rotation})`)
      .on('click', (_event, d) => onSpotClick?.(d))

    if (onSpotDragEnd) {
      merged.call(drag)
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
      .attr('x', (d) => -d.width / 2 + 3.5)
      .attr('y', (d) => -d.height / 2 + 3.5)
      .attr('width', (d) => Math.max(d.width - 7, 0))
      .attr('height', (d) => Math.max(d.height - 7, 0))
      .attr('rx', 3)
      .attr('stroke', SPOT_STROKE)
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.7)
      .attr('stroke-dasharray', (d) => (d.status === 'MAINTENANCE' ? '4 3' : null))

    merged.select<SVGTextElement>('text.spot-label').text((d) => d.code)
  }, [spots, selectedSpotId, onSpotClick, onSpotDragEnd])

  return (
    <svg ref={svgRef} className={className ?? 'h-full w-full'}>
      <defs>
        <filter id="spot-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodColor="#0f172a" floodOpacity="0.14" />
        </filter>
      </defs>
      <g className="spots" />
    </svg>
  )
}
