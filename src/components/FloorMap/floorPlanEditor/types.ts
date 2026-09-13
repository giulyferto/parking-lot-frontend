import type { FloorElement, FloorElementKind, FloorElementStyle } from '../../../types'
import type { FloorElementInput, FloorElementPatch } from '../../../api/floorElements'
import type { Point } from '../geometry'

export type EditorTool =
  | 'select'
  | 'boundary'
  | 'column'
  | 'wall'
  | 'lane'
  | 'street'
  | 'entrance'
  | 'calibrate'
  | 'spotRow'

/** Tool -> the element kind + geometry shape it draws. `select`/`column`/`calibrate` absent. */
export const TOOL_SHAPE: Partial<
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
export const LENGTH_SNAP_M = 0.05

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
