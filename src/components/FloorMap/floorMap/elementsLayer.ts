import * as d3 from 'd3'
import type { FloorElement } from '../../../types'
import { renderElement } from '../floorElements'
import type { FloorPlanEditorBag } from '../useFloorPlanEditor'

export interface ElementsLayerCtx {
  effectivePxPerMeter: number
  editor?: FloorPlanEditorBag
  boundary?: FloorElement
}

export function renderElementsLayer(
  viewport: d3.Selection<SVGGElement, unknown, null, undefined>,
  dragContainer: SVGGElement,
  els: FloorElement[],
  ctx: ElementsLayerCtx,
): void {
  const { effectivePxPerMeter, editor, boundary } = ctx
  const elJoin = viewport
    .select<SVGGElement>('g.elements')
    .selectAll<SVGGElement, FloorElement>('g.element')
    .data(els, (d) => d.id)
  elJoin.exit().remove()
  const elMerged = elJoin.enter().append('g').attr('class', 'element').merge(elJoin)
  elMerged.style('pointer-events', editor && editor.tool === 'select' ? 'auto' : 'none')
  renderElement(elMerged, {
    effectivePxPerMeter,
    selectedId: editor?.selectedElementId,
    interactive: !!editor,
    boundary,
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
}
