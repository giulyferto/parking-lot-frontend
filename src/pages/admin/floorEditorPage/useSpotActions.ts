import { useCallback, useRef } from 'react'
import { createSpot, deleteSpot, updateSpotLayout, updateSpotStatus } from '../../../api/spots'
import type { SpotInput, SpotLayoutInput } from '../../../api/spots'
import type { SpotRowPlacement } from '../../../components/FloorMap/geometry'
import { STALL_DIMENSIONS_BY_VEHICLE } from '../../../components/FloorMap/spotDimensions'
import type { Spot, SpotStatus } from '../../../types'
import type { UndoCommand, UndoStackBag } from '../useUndoStack'

export function useSpotActions({
  floorId,
  spots,
  undoStack,
  reload,
}: {
  floorId: string | undefined
  spots: Spot[]
  undoStack: UndoStackBag
  reload: () => void
}) {
  const spotRowBusyRef = useRef(false)
  const spotRowResetRef = useRef<() => void>(() => {})
  const spotRowPhaseRef = useRef<'idle' | 'drawing' | 'ready'>('idle')

  const handleDragEnd = useCallback(
    async (spot: Spot, posX: number, posY: number) => {
      const before: SpotLayoutInput = {
        posX: spot.posX,
        posY: spot.posY,
        width: spot.width,
        height: spot.height,
        rotation: spot.rotation,
      }
      const after: SpotLayoutInput = { ...before, posX, posY }
      await updateSpotLayout(spot.id, after)
      undoStack.push({
        undo: async () => {
          await updateSpotLayout(spot.id, before)
          reload()
        },
        redo: async () => {
          await updateSpotLayout(spot.id, after)
          reload()
        },
      })
      reload()
    },
    [reload, undoStack],
  )

  const handleGroupDragEnd = useCallback(
    async (moves: Array<{ spot: Spot; posX: number; posY: number }>) => {
      const befores = moves.map(({ spot }) => ({
        posX: spot.posX,
        posY: spot.posY,
        width: spot.width,
        height: spot.height,
        rotation: spot.rotation,
      }))
      const afters = moves.map(({ posX, posY }, i) => ({ ...befores[i], posX, posY }))
      await Promise.all(moves.map(({ spot }, i) => updateSpotLayout(spot.id, afters[i])))
      undoStack.push({
        undo: async () => {
          await Promise.all(moves.map(({ spot }, i) => updateSpotLayout(spot.id, befores[i])))
          reload()
        },
        redo: async () => {
          await Promise.all(moves.map(({ spot }, i) => updateSpotLayout(spot.id, afters[i])))
          reload()
        },
      })
      reload()
    },
    [reload, undoStack],
  )

  const handleDeleteMany = useCallback(
    async (targets: Spot[]) => {
      if (!floorId || targets.length === 0) return
      const snapshots = targets.map((s) => ({
        code: s.code,
        vehicleType: s.vehicleType,
        layout: { posX: s.posX, posY: s.posY, width: s.width, height: s.height, rotation: s.rotation },
      }))
      await Promise.all(targets.map((s) => deleteSpot(s.id)))
      let currentIds: (string | null)[] = targets.map(() => null)
      undoStack.push({
        undo: async () => {
          const created = await Promise.all(
            snapshots.map((s) => createSpot(floorId, { code: s.code, vehicleType: s.vehicleType })),
          )
          currentIds = created.map((c) => c.id)
          await Promise.all(created.map((c, i) => updateSpotLayout(c.id, snapshots[i].layout)))
          reload()
        },
        redo: async () => {
          await Promise.all(currentIds.filter((id): id is string => !!id).map((id) => deleteSpot(id)))
          currentIds = currentIds.map(() => null)
          reload()
        },
      })
      reload()
    },
    [floorId, reload, undoStack],
  )

  const handleSetStatusMany = useCallback(
    async (targets: Spot[], status: SpotStatus) => {
      const eligible = targets.filter((s) => s.status !== 'OCCUPIED')
      await Promise.all(eligible.map((s) => updateSpotStatus(s.id, status)))
      reload()
    },
    [reload],
  )

  const handleCreateSpot = useCallback(
    async (input: SpotInput) => {
      if (!floorId) return
      try {
        const created = await createSpot(floorId, input)
        const dims = STALL_DIMENSIONS_BY_VEHICLE[input.vehicleType]
        if (created && created.id) {
          const n = spots.length
          const layout: SpotLayoutInput = {
            posX: (n % 8) * (dims.width + 0.6),
            posY: Math.floor(n / 8) * (dims.height + 0.6),
            width: dims.width,
            height: dims.height,
            rotation: 0,
          }
          await updateSpotLayout(created.id, layout)
          let currentId = created.id
          undoStack.push({
            undo: async () => {
              await deleteSpot(currentId)
              reload()
            },
            redo: async () => {
              const recreated = await createSpot(floorId, input)
              currentId = recreated.id
              await updateSpotLayout(currentId, layout)
              reload()
            },
          })
        }
      } catch {
        window.alert('Could not create that bay (the code may already be in use).')
      }
      reload()
    },
    [floorId, spots.length, reload, undoStack],
  )

  const handleCommitRow = useCallback(
    async (placements: SpotRowPlacement[], previousIds: string[]): Promise<string[]> => {
      if (!floorId) return []
      if (previousIds.length) {
        await Promise.all(previousIds.map((id) => deleteSpot(id).catch(() => {})))
      }
      const succeeded: { id: string; placement: SpotRowPlacement }[] = []
      const failed: string[] = []
      for (const p of placements) {
        try {
          const created = await createSpot(floorId, { code: p.code, vehicleType: p.vehicleType })
          if (created && created.id) {
            await updateSpotLayout(created.id, {
              posX: p.posX,
              posY: p.posY,
              width: p.width,
              height: p.height,
              rotation: p.rotation,
            })
            succeeded.push({ id: created.id, placement: p })
          }
        } catch {
          failed.push(p.code)
        }
      }
      const createdIds = succeeded.map((e) => e.id)
      if (succeeded.length > 0) {
        let currentIds = createdIds
        const redoPlacements = succeeded.map((e) => e.placement)
        const command: UndoCommand = {
          undo: async () => {
            await Promise.all(currentIds.map((id) => deleteSpot(id).catch(() => {})))
            currentIds = []
            if (spotRowPhaseRef.current !== 'drawing') spotRowResetRef.current()
            reload()
          },
          redo: async () => {
            const ids: string[] = []
            for (const p of redoPlacements) {
              const created = await createSpot(floorId, { code: p.code, vehicleType: p.vehicleType })
              if (created?.id) {
                await updateSpotLayout(created.id, {
                  posX: p.posX,
                  posY: p.posY,
                  width: p.width,
                  height: p.height,
                  rotation: p.rotation,
                })
                ids.push(created.id)
              }
            }
            currentIds = ids
            reload()
          },
        }
        if (previousIds.length === 0) undoStack.push(command)
        else undoStack.replaceTop(command)
      }
      reload()
      if (failed.length) {
        window.alert(
          `Created ${createdIds.length} of ${placements.length} bays. Failed (duplicate code?): ${failed.join(', ')}.`,
        )
      }
      return createdIds
    },
    [floorId, reload, undoStack],
  )

  return {
    handleDragEnd,
    handleGroupDragEnd,
    handleDeleteMany,
    handleSetStatusMany,
    handleCreateSpot,
    handleCommitRow,
    spotRowBusyRef,
    spotRowResetRef,
    spotRowPhaseRef,
  }
}
