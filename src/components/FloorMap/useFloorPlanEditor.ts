import { useCallback, useMemo, useState } from 'react'
import { minVertices } from './geometry'
import {
  type DraftState,
  type EditorTool,
  type FloorPlanEditorBag,
  type UseFloorPlanEditorOptions,
} from './floorPlanEditor/types'
import { useDrawingTool } from './floorPlanEditor/useDrawingTool'
import { useCalibration } from './floorPlanEditor/useCalibration'
import { useElementEditing } from './floorPlanEditor/useElementEditing'
import { useKeyboardShortcuts } from './floorPlanEditor/useKeyboardShortcuts'

export type { EditorTool, DraftState, UseFloorPlanEditorOptions, FloorPlanEditorBag } from './floorPlanEditor/types'

export function useFloorPlanEditor(opts: UseFloorPlanEditorOptions): FloorPlanEditorBag {
  const { elements, gridStepM, snapEnabled, onCreate, onUpdate, onDelete, onRescale } = opts

  const [tool, setToolState] = useState<EditorTool>('select')
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)

  // The perimeter ring, if one is drawn. An ENTRANCE is an opening *in* this
  // wall, so its points are always projected onto it (draw preview, click,
  // vertex drag) rather than snapped to the grid.
  const boundaryRing = useMemo(() => {
    const b = elements.find((e) => e.kind === 'BOUNDARY')
    return b && b.geometry.type === 'Polygon' ? b.geometry.coordinates : null
  }, [elements])

  const selectedElement = useMemo(
    () => elements.find((e) => e.id === selectedElementId) ?? null,
    [elements, selectedElementId],
  )

  const setTool = useCallback((t: EditorTool) => {
    setToolState(t)
    setDraft(null)
    setSelectedElementId(null)
  }, [])

  const { snap, snapDraftPoint, canvasClick, canvasDblClick, commitShape } = useDrawingTool({
    tool,
    setToolState,
    draft,
    setDraft,
    elements,
    gridStepM,
    snapEnabled,
    boundaryRing,
    onCreate,
    setSelectedElementId,
  })

  const { rulerLengthM, moveRulerEnd, commitCalibration } = useCalibration({
    draft,
    setDraft,
    setToolState,
    onRescale,
  })

  const {
    selectElement,
    endElementDrag,
    endVertexDrag,
    removeVertex,
    updateSelectedStyle,
    deleteSelected,
    deleteElement,
  } = useElementEditing({
    elements,
    selectedElementId,
    setSelectedElementId,
    selectedElement,
    boundaryRing,
    snap,
    onUpdate,
    onDelete,
  })

  const cancelDraft = useCallback(() => {
    setDraft(null)
    setSelectedElementId(null)
  }, [])

  useKeyboardShortcuts({
    tool,
    selectedElementId,
    setSelectedElementId,
    draft,
    setDraft,
    commitShape,
    onDelete,
  })

  return useMemo(
    () => ({
      tool,
      setTool,
      draft,
      selectedElementId,
      selectedElement,
      rulerLengthM,
      snapEnabled,
      gridStepM,
      snapDraftPoint,
      canvasClick,
      canvasDblClick,
      selectElement,
      endElementDrag,
      endVertexDrag,
      moveRulerEnd,
      commitCalibration,
      removeVertex,
      updateSelectedStyle,
      deleteSelected,
      deleteElement,
      cancelDraft,
    }),
    [
      tool,
      setTool,
      draft,
      selectedElementId,
      selectedElement,
      rulerLengthM,
      snapEnabled,
      gridStepM,
      snapDraftPoint,
      canvasClick,
      canvasDblClick,
      selectElement,
      endElementDrag,
      endVertexDrag,
      moveRulerEnd,
      commitCalibration,
      removeVertex,
      updateSelectedStyle,
      deleteSelected,
      deleteElement,
      cancelDraft,
    ],
  )
}

export { minVertices }
