import * as d3 from 'd3'
import type { FloorElement, Spot } from '../../../types'

const EMPTY: ReadonlySet<string> = new Set()

/**
 * The mixed spot + element multi-selection as the D3 layers see it. Dragging
 * any member moves every member, so both layers share one live preview and
 * one commit callback instead of each moving only its own kind.
 */
export interface SelectionDrag {
  spotIds: ReadonlySet<string>
  elementIds: ReadonlySet<string>
  /** True when dragging the item with this id should move the whole selection. */
  isGroupMember: (id: string) => boolean
  preview: (dx: number, dy: number) => void
  setDragging: (on: boolean) => void
  commit?: (dx: number, dy: number) => void
}

export function createSelectionDrag(
  viewport: d3.Selection<SVGGElement, unknown, null, undefined>,
  spotIds: ReadonlySet<string> | undefined,
  elementIds: ReadonlySet<string> | undefined,
  commit: ((dx: number, dy: number) => void) | undefined,
): SelectionDrag {
  const spots = spotIds ?? EMPTY
  const elements = elementIds ?? EMPTY
  const grouped = !!commit && spots.size + elements.size > 1
  const spotNodes = () =>
    viewport.selectAll<SVGGElement, Spot>('g.spot').filter((s) => spots.has(s.id))
  const elementNodes = () =>
    viewport.selectAll<SVGGElement, FloorElement>('g.element').filter((e) => elements.has(e.id))

  return {
    spotIds: spots,
    elementIds: elements,
    isGroupMember: (id) => grouped && (spots.has(id) || elements.has(id)),
    preview: (dx, dy) => {
      spotNodes().attr('transform', (s) => `translate(${s.posX + dx}, ${s.posY + dy}) rotate(${s.rotation})`)
      elementNodes().attr('transform', `translate(${dx},${dy})`)
    },
    setDragging: (on) => {
      const nodes = spotNodes().classed('is-dragging', on)
      if (on) nodes.raise()
    },
    commit,
  }
}
