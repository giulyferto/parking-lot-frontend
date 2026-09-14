import { useCallback } from 'react'
import { rescaleFloor } from '../../../api/floors'
import {
  createFloorElement,
  deleteFloorElement,
  updateFloorElement,
} from '../../../api/floorElements'
import type { FloorElementInput, FloorElementPatch } from '../../../api/floorElements'
import type { FloorElement } from '../../../types'
import type { UndoStackBag } from '../useUndoStack'

export function useFloorElementActions({
  floorId,
  elements,
  undoStack,
  reload,
}: {
  floorId: string | undefined
  elements: FloorElement[]
  undoStack: UndoStackBag
  reload: () => void
}) {
  const onCreate = useCallback(
    async (input: FloorElementInput) => {
      if (!floorId) return
      try {
        const created = await createFloorElement(floorId, input)
        let currentId = created.id
        undoStack.push({
          undo: async () => {
            await deleteFloorElement(currentId)
            reload()
          },
          redo: async () => {
            const recreated = await createFloorElement(floorId, input)
            currentId = recreated.id
            reload()
          },
        })
      } catch {
        window.alert('Could not save that element. A floor can only have one boundary.')
      }
      reload()
    },
    [floorId, reload, undoStack],
  )

  const onUpdate = useCallback(
    async (id: string, patch: FloorElementPatch) => {
      const before = elements.find((e) => e.id === id)
      await updateFloorElement(id, patch)
      if (before) {
        const inverse: FloorElementPatch = {}
        if (patch.geometry !== undefined) inverse.geometry = before.geometry
        if (patch.style !== undefined) inverse.style = before.style
        if (patch.kind !== undefined) inverse.kind = before.kind
        if (patch.z !== undefined) inverse.z = before.z
        undoStack.push({
          undo: async () => {
            await updateFloorElement(id, inverse)
            reload()
          },
          redo: async () => {
            await updateFloorElement(id, patch)
            reload()
          },
        })
      }
      reload()
    },
    [elements, reload, undoStack],
  )

  const onDelete = useCallback(
    async (id: string) => {
      const before = elements.find((e) => e.id === id)
      await deleteFloorElement(id)
      if (before && floorId) {
        const recreateInput: FloorElementInput = {
          kind: before.kind,
          geometry: before.geometry,
          style: before.style,
          z: before.z,
        }
        let currentId = id
        undoStack.push({
          undo: async () => {
            const recreated = await createFloorElement(floorId, recreateInput)
            currentId = recreated.id
            reload()
          },
          redo: async () => {
            await deleteFloorElement(currentId)
            reload()
          },
        })
      }
      reload()
    },
    [elements, floorId, reload, undoStack],
  )

  const onRescale = useCallback(
    async (factor: number) => {
      if (!floorId) return
      await rescaleFloor(floorId, factor)
      undoStack.push({
        undo: async () => {
          await rescaleFloor(floorId, 1 / factor)
          reload()
        },
        redo: async () => {
          await rescaleFloor(floorId, factor)
          reload()
        },
      })
      reload()
    },
    [floorId, reload, undoStack],
  )

  return { onCreate, onUpdate, onDelete, onRescale }
}
