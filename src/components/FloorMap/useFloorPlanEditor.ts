import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FloorElement, FloorElementKind, FloorElementStyle, Geometry } from '../../types'
import type { FloorElementInput, FloorElementPatch } from '../../api/floorElements'
import {
  distance,
  minVertices,
  removeVertex as removeGeomVertex,
  setVertex,
  snapToGrid,
  translateGeometry,
  type Point,
} from './geometry'
import { elementHitTest } from './floorElements'

export type EditorTool =
  | 'select'
  | 'boundary'
  | 'column'
  | 'wall'
  | 'lane'
  | 'street'
  | 'entrance'
  | 'calibrate'

/** Tool -> the element kind + geometry shape it draws. `select`/`column`/`calibrate` absent. */
const TOOL_SHAPE: Partial<
  Record<EditorTool, { kind: FloorElementKind; geomType: 'Polygon' | 'LineString' }>
> = {
  boundary: { kind: 'BOUNDARY', geomType: 'Polygon' },
  wall: { kind: 'WALL', geomType: 'LineString' },
  lane: { kind: 'DRIVE_LANE', geomType: 'LineString' },
  street: { kind: 'STREET', geomType: 'LineString' },
  entrance: { kind: 'ENTRANCE', geomType: 'LineString' },
}

/**
 * Length increment (meters) the in-progress segment snaps to when grid snap is
 * off. A raw pixel cursor can't be placed between e.g. 3.97 m and 4.01 m when
 * zoomed out, so exact measurements would be unreachable without this.
 */
const LENGTH_SNAP_M = 0.05

export type DraftState =
  | { mode: 'shape'; kind: FloorElementKind; geomType: 'Polygon' | 'LineString'; vertices: Point[] }
  | { mode: 'ruler'; points: [Point, Point] }

export interface UseFloorPlanEditorOptions {
  elements: FloorElement[]
  gridStepM: number
  snapEnabled: boolean
  onCreate: (input: FloorElementInput) => void
  onUpdate: (id: string, patch: FloorElementPatch) => void
  onDelete: (id: string) => void
  onRescale: (factor: number) => void
}

export interface FloorPlanEditorBag {
  tool: EditorTool
  setTool: (t: EditorTool) => void
  draft: DraftState | null
  selectedElementId: string | null
  selectedElement: FloorElement | null
  rulerLengthM: number | null
  snapEnabled: boolean
  gridStepM: number
  /**
   * Where a click while drawing actually lands: grid snap when it's on,
   * otherwise the pending segment's length snapped to `LENGTH_SNAP_M` so exact
   * measurements are reachable at any zoom. Used for the live draw preview.
   */
  snapDraftPoint: (worldRaw: Point) => Point
  /** Pointer -> world (meters) from FloorMap's hit rect. */
  canvasClick: (world: Point) => void
  canvasDblClick: () => void
  selectElement: (id: string | null) => void
  /** Commit a whole-element move (drag end). */
  endElementDrag: (id: string, dx: number, dy: number) => void
  /** Commit a single-vertex move (drag end). */
  endVertexDrag: (id: string, vertexIndex: number, world: Point) => void
  /** Commit a ruler endpoint move (drag end). */
  moveRulerEnd: (which: 0 | 1, world: Point) => void
  commitCalibration: (actualLengthM: number) => void
  removeVertex: (vertexIndex: number) => void
  updateSelectedStyle: (patch: Partial<FloorElementStyle>) => void
  deleteSelected: () => void
  deleteElement: (id: string) => void
  cancelDraft: () => void
}

export function useFloorPlanEditor(opts: UseFloorPlanEditorOptions): FloorPlanEditorBag {
  const { elements, gridStepM, snapEnabled, onCreate, onUpdate, onDelete, onRescale } = opts

  const [tool, setToolState] = useState<EditorTool>('select')
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)

  const snap = useCallback(
    (p: Point): Point => (snapEnabled ? snapToGrid(p, gridStepM) : p),
    [snapEnabled, gridStepM],
  )

  const snapDraftPoint = useCallback(
    (worldRaw: Point): Point => {
      // Grid snap, when the user turned it on, still wins.
      if (snapEnabled && gridStepM > 0) return snapToGrid(worldRaw, gridStepM)
      // Otherwise snap the length of the segment being drawn (from the last
      // placed vertex) to LENGTH_SNAP_M, keeping the cursor's direction.
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
    [snapEnabled, gridStepM, draft],
  )

  const setTool = useCallback((t: EditorTool) => {
    setToolState(t)
    setDraft(null)
    setSelectedElementId(null)
  }, [])

  const selectedElement = useMemo(
    () => elements.find((e) => e.id === selectedElementId) ?? null,
    [elements, selectedElementId],
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
    [onCreate],
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
      const existing = draft?.mode === 'shape' ? draft.vertices : []
      // Length-snap the pending point so exact segment measurements are reachable.
      const pt = snapDraftPoint(worldRaw)
      const eps = Math.max(gridStepM * 0.5, 0.25)
      const last = existing[existing.length - 1]
      // Swallow the stray trailing click of a double-click (lands on the last point).
      if (last && distance(pt, last) < eps) return
      // Polygon: clicking back on the first vertex closes the ring.
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
    [tool, snap, snapDraftPoint, gridStepM, elements, draft, onCreate],
  )

  const canvasDblClick = useCallback(() => commitShape(draft), [commitShape, draft])

  const selectElement = useCallback((id: string | null) => setSelectedElementId(id), [])

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
      onUpdate(id, { geometry: setVertex(el.geometry, vertexIndex, snap(worldRaw)) })
    },
    [elements, onUpdate, snap],
  )

  const moveRulerEnd = useCallback((which: 0 | 1, world: Point) => {
    setDraft((prev) => {
      if (prev?.mode !== 'ruler') return prev
      const points: [Point, Point] = [prev.points[0], prev.points[1]]
      points[which] = world
      return { mode: 'ruler', points }
    })
  }, [])

  const rulerLengthM =
    draft?.mode === 'ruler' ? distance(draft.points[0], draft.points[1]) : null

  const commitCalibration = useCallback(
    (actualLengthM: number) => {
      if (draft?.mode !== 'ruler') return
      const drawn = distance(draft.points[0], draft.points[1])
      if (!drawn || !Number.isFinite(actualLengthM) || actualLengthM <= 0) return
      const factor = actualLengthM / drawn
      if (factor < 0.01 || factor > 100) {
        window.alert('That scale change is out of range (0.01x - 100x). Draw a longer ruler.')
        return
      }
      if (
        !window.confirm(
          `Rescale this floor by ${factor.toFixed(3)}x?\nThis rewrites every bay and plan element on the floor.`,
        )
      ) {
        return
      }
      onRescale(factor)
      setDraft(null)
      setToolState('select')
    },
    [draft, onRescale],
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
  }, [selectedElementId, onDelete])

  const deleteElement = useCallback(
    (id: string) => {
      onDelete(id)
      setSelectedElementId((cur) => (cur === id ? null : cur))
    },
    [onDelete],
  )

  const cancelDraft = useCallback(() => {
    setDraft(null)
    setSelectedElementId(null)
  }, [])

  // Keyboard shortcuts while a tool is active or something is selected.
  useEffect(() => {
    if (tool === 'select' && !selectedElementId && !draft) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDraft(null)
        setSelectedElementId(null)
      } else if (e.key === 'Enter' && draft?.mode === 'shape') {
        e.preventDefault()
        commitShape(draft)
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        if (draft?.mode === 'shape' && draft.vertices.length > 0) {
          e.preventDefault()
          setDraft({ ...draft, vertices: draft.vertices.slice(0, -1) })
        } else if (selectedElementId) {
          e.preventDefault()
          onDelete(selectedElementId)
          setSelectedElementId(null)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [tool, selectedElementId, draft, commitShape, onDelete])

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
