import * as d3 from 'd3'
import { SCALE_BAR_COLOR } from '../floorElementStyles'
import { niceScaleBarLength } from '../geometry'
import type { ViewBox } from './types'

export function drawChrome(
  chrome: d3.Selection<SVGGElement, unknown, null, undefined>,
  vb: ViewBox,
  viewToPx: number,
  showScaleBar: boolean | undefined,
  k: number,
): void {
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
