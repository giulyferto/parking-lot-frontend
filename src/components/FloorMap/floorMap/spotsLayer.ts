import * as d3 from 'd3'
import type { Spot } from '../../../types'
import { SPOT_COLORS, SPOT_LABEL_COLOR, SPOT_SELECTED_STROKE, SPOT_STROKE } from '../spotColors'

export interface SpotsLayerCtx {
  selectedSpotIds?: ReadonlySet<string>
  selectMode: boolean
  labelFont: number
  onSpotClick?: (spot: Spot, event: MouseEvent) => void
  onSpotDragEnd?: (spot: Spot, posX: number, posY: number) => void
  onSpotGroupDragEnd?: (moves: Array<{ spot: Spot; posX: number; posY: number }>) => void
}

type DragNode = SVGGElement & { __groupIds?: ReadonlySet<string> | null; __moved?: boolean }

export function renderSpotsLayer(
  viewport: d3.Selection<SVGGElement, unknown, null, undefined>,
  dragContainer: SVGGElement,
  spots: Spot[],
  ctx: SpotsLayerCtx,
): void {
  const { selectedSpotIds, selectMode, labelFont, onSpotClick, onSpotDragEnd, onSpotGroupDragEnd } = ctx

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

  const drag = d3
    .drag<SVGGElement, Spot>()
    .container(dragContainer)
    .subject((_event, d) => ({ x: d.posX, y: d.posY }))
    .on('start', function (event, d) {
      event.sourceEvent.stopPropagation()
      const node = this as DragNode
      node.__moved = false
      const grouped = !!selectedSpotIds && selectedSpotIds.size > 1 && selectedSpotIds.has(d.id)
      node.__groupIds = grouped ? selectedSpotIds! : null
    })
    .on('drag', function (event, d) {
      const node = this as DragNode
      if (!node.__moved) {
        node.__moved = true
        const nodes = node.__groupIds ? merged.filter((s) => node.__groupIds!.has(s.id)) : d3.select(this)
        nodes.raise().classed('is-dragging', true)
      }
      const dx = event.x - d.posX
      const dy = event.y - d.posY
      if (node.__groupIds) {
        merged
          .filter((s) => node.__groupIds!.has(s.id))
          .attr('transform', (s) => `translate(${s.posX + dx}, ${s.posY + dy}) rotate(${s.rotation})`)
      } else {
        d3.select(this).attr('transform', `translate(${event.x}, ${event.y}) rotate(${d.rotation})`)
      }
    })
    .on('end', function (event, d) {
      const node = this as DragNode
      const groupIds = node.__groupIds
      const moved = node.__moved
      node.__groupIds = null
      node.__moved = false
      if (!moved) return
      if (groupIds) {
        const dx = event.x - d.posX
        const dy = event.y - d.posY
        merged.filter((s) => groupIds.has(s.id)).classed('is-dragging', false)
        const moves = spots
          .filter((s) => groupIds.has(s.id))
          .map((s) => ({
            spot: s,
            posX: s.id === d.id ? event.x : s.posX + dx,
            posY: s.id === d.id ? event.y : s.posY + dy,
          }))
        onSpotGroupDragEnd?.(moves)
      } else {
        d3.select(this).classed('is-dragging', false)
        onSpotDragEnd?.(d, event.x, event.y)
      }
    })

  merged
    .attr('transform', (d) => `translate(${d.posX}, ${d.posY}) rotate(${d.rotation})`)
    .on('click', (event: MouseEvent, d) => onSpotClick?.(d, event))
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
    .attr('stroke', (d) => (selectedSpotIds?.has(d.id) ? SPOT_SELECTED_STROKE : 'rgba(15,23,42,0.12)'))
    .attr('stroke-width', (d) => (selectedSpotIds?.has(d.id) ? 2.5 : 1))

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
}
