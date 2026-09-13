import { useCallback, type Dispatch, type SetStateAction } from 'react'
import type { FloorElement, Geometry } from '../../../types'
import type { FloorElementInput } from '../../../api/floorElements'
import { closestPointOnPath, distance, snapToGrid, type Point } from '../geometry'
import { elementHitTest } from '../floorElements'
import { TOOL_SHAPE, LENGTH_SNAP_M, type DraftState, type EditorTool } from './types'

export interface UseDrawingToolArgs {
  tool: EditorTool
  setToolState: Dispatch<SetStateAction<EditorTool>>
  draft: DraftState | null
  setDraft: Dispatch<SetStateAction<DraftState | null>>
  elements: FloorElement[]
  gridStepM: number
  snapEnabled: boolean
  boundaryRing: Point[] | null
  onCreate: (input: FloorElementInput) => void
  setSelectedElementId: Dispatch<SetStateAction<string | null>>
}

export function useDrawingTool(args: UseDrawingToolArgs) {
  const {
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
  } = args

  const snap = useCallback(
    (p: Point): Point => (snapEnabled ? snapToGrid(p, gridStepM) : p),
    [snapEnabled, gridStepM],
  )

  const snapDraftPoint = useCallback(
    (worldRaw: Point): Point => {
      if (tool === 'entrance') {
        return boundaryRing ? closestPointOnPath(worldRaw, boundaryRing, true).point : worldRaw
      }
      if (snapEnabled && gridStepM > 0) return snapToGrid(worldRaw, gridStepM)
      const anchor =
        draft?.mode === 'shape' && draft.vertices.length > 0
          ? draft.vertices[draft.vertices.length - 1]
          : null
      if (!anchor) return worldRaw
      const dx = worldRaw[0] - anchor[0]
      const dy = worldRaw[1] - anchor[1]
      const len = Math.hypot(dx, dy)
      if (len < 1e-9) return worldRaw
      const snapped = Math.round(len / LENGTH_SNAP_M) * LENGTH_SNAP_M
      const scale = snapped / len
      return [anchor[0] + dx * scale, anchor[1] + dy * scale]
    },
    [tool, boundaryRing, snapEnabled, gridStepM, draft],
  )

  const commitShape = useCallback(
    (d: DraftState | null) => {
      if (!d || d.mode !== 'shape') return
      if (d.vertices.length < (d.geomType === 'Polygon' ? 3 : 2)) return
      const geometry: Geometry =
        d.geomType === 'Polygon'
          ? { type: 'Polygon', coordinates: d.vertices }
          : { type: 'LineString', coordinates: d.vertices }
      onCreate({ kind: d.kind, geometry })
      setDraft(null)
      if (d.kind === 'BOUNDARY') setToolState('select')
    },
    [onCreate, setDraft, setToolState],
  )

  const canvasClick = useCallback(
    (worldRaw: Point) => {
      const world = snap(worldRaw)
      if (tool === 'select') {
        const tol = gridStepM > 0 ? gridStepM / 2 : 0.5
        setSelectedElementId(elementHitTest(elements, worldRaw, tol)?.id ?? null)
        return
      }
      if (tool === 'column') {
        onCreate({ kind: 'COLUMN', geometry: { type: 'Point', coordinates: world } })
        return
      }
      if (tool === 'calibrate') {
        setDraft((prev) =>
          prev?.mode === 'ruler'
            ? { mode: 'ruler', points: [prev.points[0], worldRaw] }
            : { mode: 'ruler', points: [worldRaw, worldRaw] },
        )
        return
      }
      const shape = TOOL_SHAPE[tool]
      if (!shape) return
      if (tool === 'entrance' && !boundaryRing) {
        window.alert('Draw the outer boundary first - an entrance is placed on it.')
        return
      }
      const existing = draft?.mode === 'shape' ? draft.vertices : []
      const pt = snapDraftPoint(worldRaw)
      const eps = Math.max(gridStepM * 0.5, 0.25)
      const last = existing[existing.length - 1]
      if (last && distance(pt, last) < eps) return
      if (shape.geomType === 'Polygon' && existing.length >= 3 && distance(pt, existing[0]) < eps) {
        onCreate({ kind: shape.kind, geometry: { type: 'Polygon', coordinates: existing } })
        setDraft(null)
        if (shape.kind === 'BOUNDARY') setToolState('select')
        return
      }
      const vertices = [...existing, pt]
      if (tool === 'entrance' && vertices.length === 2) {
        onCreate({ kind: 'ENTRANCE', geometry: { type: 'LineString', coordinates: vertices } })
        setDraft(null)
        return
      }
      setDraft({ mode: 'shape', ...shape, vertices })
    },
    [
      tool,
      snap,
      snapDraftPoint,
      gridStepM,
      elements,
      draft,
      boundaryRing,
      onCreate,
      setDraft,
      setSelectedElementId,
      setToolState,
    ],
  )

  const canvasDblClick = useCallback(() => commitShape(draft), [commitShape, draft])

  return { snap, snapDraftPoint, canvasClick, canvasDblClick, commitShape }
}
