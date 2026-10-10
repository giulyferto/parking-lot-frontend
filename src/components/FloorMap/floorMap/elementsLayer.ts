import * as d3 from 'd3'
import type { FloorElement } from '../../../types'
import { renderElement } from '../floorElements'
import type { FloorPlanEditorBag } from '../useFloorPlanEditor'
import type { SelectionDrag } from './selection'

export interface ElementsLayerCtx {
  effectivePxPerMeter: number
  editor?: FloorPlanEditorBag
  boundary?: FloorElement
  selection: SelectionDrag
  onElementClick?: (element: FloorElement, event: MouseEvent) => void
}

type DragNode = SVGGElement & { __dx?: number; __dy?: number; __grouped?: boolean }

export function renderElementsLayer(
  viewport: d3.Selection<SVGGElement, unknown, null, undefined>,
  dragContainer: SVGGElement,
  els: FloorElement[],
  ctx: ElementsLayerCtx,
): void {
  const { effectivePxPerMeter, editor, boundary, selection, onElementClick } = ctx
  const elJoin = viewport
    .select<SVGGElement>('g.elements')
    .selectAll<SVGGElement, FloorElement>('g.element')
    .data(els, (d) => d.id)
  elJoin.exit().remove()
  const elMerged = elJoin.enter().append('g').attr('class', 'element').merge(elJoin)
  // A drag leaves its preview translate on the node; the committed geometry
  // arriving here is what replaces it.
  elMerged.attr('transform', null)
  elMerged.style('pointer-events', editor && editor.tool === 'select' ? 'auto' : 'none')
  renderElement(elMerged, {
    effectivePxPerMeter,
    selectedId: editor?.selectedElementId,
    selectedIds: selection.elementIds,
    interactive: !!editor,
    boundary,
  })
  if (editor && editor.tool === 'select') {
    elMerged.style('cursor', 'move').on('click', (event: MouseEvent, d) => {
      event.stopPropagation()
      if (onElementClick) onElementClick(d, event)
      else editor.selectElement(d.id)
    })
    const bodyDrag = d3
      .drag<SVGGElement, FloorElement>()
      .container(dragContainer)
      .on('start', function (event, d) {
        event.sourceEvent.stopPropagation()
        const node = this as DragNode
        node.__dx = 0
        node.__dy = 0
        node.__grouped = selection.isGroupMember(d.id)
        if (node.__grouped) selection.setDragging(true)
      })
      .on('drag', function (event) {
        const node = this as DragNode
        const dx = (node.__dx ?? 0) + event.dx
        const dy = (node.__dy ?? 0) + event.dy
        node.__dx = dx
        node.__dy = dy
        if (node.__grouped) selection.preview(dx, dy)
        else d3.select(this).attr('transform', `translate(${dx},${dy})`)
      })
      .on('end', function (_event, d) {
        const node = this as DragNode
        const dx = node.__dx ?? 0
        const dy = node.__dy ?? 0
        const grouped = node.__grouped
        node.__dx = 0
        node.__dy = 0
        node.__grouped = false
        if (grouped) {
          selection.setDragging(false)
          if (dx !== 0 || dy !== 0) selection.commit?.(dx, dy)
        } else {
          editor.endElementDrag(d.id, dx, dy)
        }
      })
    elMerged.call(bodyDrag)
  } else {
    elMerged.on('.drag', null).on('click', null).style('cursor', null)
  }
}
