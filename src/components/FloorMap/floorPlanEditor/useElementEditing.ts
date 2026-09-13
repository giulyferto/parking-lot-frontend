import { useCallback, type Dispatch, type SetStateAction } from 'react'
import type { FloorElement, FloorElementStyle } from '../../../types'
import type { FloorElementPatch } from '../../../api/floorElements'
import {
  closestPointOnPath,
  removeVertex as removeGeomVertex,
  setVertex,
  translateGeometry,
  type Point,
} from '../geometry'

export interface UseElementEditingArgs {
  elements: FloorElement[]
  selectedElementId: string | null
  setSelectedElementId: Dispatch<SetStateAction<string | null>>
  selectedElement: FloorElement | null
  boundaryRing: Point[] | null
  snap: (p: Point) => Point
  onUpdate: (id: string, patch: FloorElementPatch) => void
  onDelete: (id: string) => void
}

export function useElementEditing(args: UseElementEditingArgs) {
  const { elements, selectedElementId, setSelectedElementId, selectedElement, boundaryRing, snap, onUpdate, onDelete } =
    args

  const selectElement = useCallback(
    (id: string | null) => setSelectedElementId(id),
    [setSelectedElementId],
  )

  const endElementDrag = useCallback(
    (id: string, dx: number, dy: number) => {
      const el = elements.find((e) => e.id === id)
      if (!el || (dx === 0 && dy === 0)) return
      onUpdate(id, { geometry: translateGeometry(el.geometry, dx, dy) })
    },
    [elements, onUpdate],
  )

  const endVertexDrag = useCallback(
    (id: string, vertexIndex: number, worldRaw: Point) => {
      const el = elements.find((e) => e.id === id)
      if (!el) return
      const landed =
        el.kind === 'ENTRANCE' && boundaryRing
          ? closestPointOnPath(worldRaw, boundaryRing, true).point
          : snap(worldRaw)
      onUpdate(id, { geometry: setVertex(el.geometry, vertexIndex, landed) })
    },
    [elements, onUpdate, snap, boundaryRing],
  )

  const removeVertex = useCallback(
    (vertexIndex: number) => {
      if (!selectedElement) return
      const next = removeGeomVertex(selectedElement.geometry, vertexIndex)
      if (next === selectedElement.geometry) return
      onUpdate(selectedElement.id, { geometry: next })
    },
    [selectedElement, onUpdate],
  )

  const updateSelectedStyle = useCallback(
    (patch: Partial<FloorElementStyle>) => {
      if (!selectedElement) return
      onUpdate(selectedElement.id, { style: { ...selectedElement.style, ...patch } })
    },
    [selectedElement, onUpdate],
  )

  const deleteSelected = useCallback(() => {
    if (!selectedElementId) return
    onDelete(selectedElementId)
    setSelectedElementId(null)
  }, [selectedElementId, onDelete, setSelectedElementId])

  const deleteElement = useCallback(
    (id: string) => {
      onDelete(id)
      setSelectedElementId((cur) => (cur === id ? null : cur))
    },
    [onDelete, setSelectedElementId],
  )

  return {
    selectElement,
    endElementDrag,
    endVertexDrag,
    removeVertex,
    updateSelectedStyle,
    deleteSelected,
    deleteElement,
  }
}
