import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { createSpot, deleteSpot, updateSpotLayout } from '../../../api/spots'
import type { SpotLayoutInput } from '../../../api/spots'
import { createFloorElement, deleteFloorElement, updateFloorElement } from '../../../api/floorElements'
import type { FloorElementInput } from '../../../api/floorElements'
import { translateGeometry } from '../../../components/FloorMap/geometry'
import type { FloorElement, Spot } from '../../../types'
import type { UndoStackBag } from '../useUndoStack'

function layoutOf(s: Spot): SpotLayoutInput {
  return { posX: s.posX, posY: s.posY, width: s.width, height: s.height, rotation: s.rotation }
}

/**
 * Actions on the mixed spot + element multi-selection. Each one is a single
 * undo entry covering both kinds, so undoing a group move or delete restores
 * the whole selection at once.
 */
export function useSelectionActions({
  floorId,
  setSpots,
  setElements,
  undoStack,
  reload,
}: {
  floorId: string | undefined
  setSpots: Dispatch<SetStateAction<Spot[]>>
  setElements: Dispatch<SetStateAction<FloorElement[]>>
  undoStack: UndoStackBag
  reload: () => void
}) {
  const moveSelection = useCallback(
    async (spots: Spot[], elements: FloorElement[], dx: number, dy: number) => {
      if ((dx === 0 && dy === 0) || spots.length + elements.length === 0) return
      const spotBefore = spots.map(layoutOf)
      const spotAfter = spotBefore.map((l) => ({ ...l, posX: l.posX + dx, posY: l.posY + dy }))
      const geomBefore = elements.map((e) => e.geometry)
      const geomAfter = geomBefore.map((g) => translateGeometry(g, dx, dy))

      const apply = (layouts: SpotLayoutInput[], geoms: typeof geomBefore) =>
        Promise.all([
          ...spots.map((s, i) => updateSpotLayout(s.id, layouts[i])),
          ...elements.map((e, i) => updateFloorElement(e.id, { geometry: geoms[i] })),
        ])

      const spotIdx = new Map(spots.map((s, i) => [s.id, i]))
      const elIdx = new Map(elements.map((e, i) => [e.id, i]))
      setSpots((prev) =>
        prev.map((s) => (spotIdx.has(s.id) ? { ...s, ...spotAfter[spotIdx.get(s.id)!] } : s)),
      )
      setElements((prev) =>
        prev.map((e) => (elIdx.has(e.id) ? { ...e, geometry: geomAfter[elIdx.get(e.id)!] } : e)),
      )
      try {
        await apply(spotAfter, geomAfter)
      } catch {
        reload()
        return
      }
      undoStack.push({
        undo: async () => {
          await apply(spotBefore, geomBefore)
          reload()
        },
        redo: async () => {
          await apply(spotAfter, geomAfter)
          reload()
        },
      })
      reload()
    },
    [setSpots, setElements, undoStack, reload],
  )

  const deleteSelection = useCallback(
    async (spots: Spot[], elements: FloorElement[]) => {
      if (!floorId || spots.length + elements.length === 0) return
      const spotSnapshots = spots.map((s) => ({
        code: s.code,
        vehicleType: s.vehicleType,
        layout: layoutOf(s),
      }))
      const elementSnapshots: FloorElementInput[] = elements.map((e) => ({
        kind: e.kind,
        geometry: e.geometry,
        style: e.style,
        z: e.z,
      }))
      await Promise.all([
        ...spots.map((s) => deleteSpot(s.id)),
        ...elements.map((e) => deleteFloorElement(e.id)),
      ])
      let spotIds: string[] = []
      let elementIds: string[] = []
      undoStack.push({
        undo: async () => {
          const [createdSpots, createdElements] = await Promise.all([
            Promise.all(
              spotSnapshots.map((s) => createSpot(floorId, { code: s.code, vehicleType: s.vehicleType })),
            ),
            Promise.all(elementSnapshots.map((input) => createFloorElement(floorId, input))),
          ])
          await Promise.all(
            createdSpots.map((c, i) => updateSpotLayout(c.id, spotSnapshots[i].layout)),
          )
          spotIds = createdSpots.map((c) => c.id)
          elementIds = createdElements.map((c) => c.id)
          reload()
        },
        redo: async () => {
          await Promise.all([
            ...spotIds.map((id) => deleteSpot(id)),
            ...elementIds.map((id) => deleteFloorElement(id)),
          ])
          spotIds = []
          elementIds = []
          reload()
        },
      })
      reload()
    },
    [floorId, undoStack, reload],
  )

  return { moveSelection, deleteSelection }
}
