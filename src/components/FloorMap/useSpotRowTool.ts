import { useCallback, useEffect, useMemo, useState } from 'react'
import type { VehicleType } from '../../types'
import {
  computeSpotRow,
  distance,
  snapToGrid,
  spotRowCapacity,
  type Point,
  type SpotRowPlacement,
} from './geometry'
import { STALL_DIMENSIONS_BY_VEHICLE, type RowParkAngle } from './spotDimensions'

export interface SpotRowParams {
  angleDeg: RowParkAngle
  stallWidthM: number
  stallDepthM: number
  vehicleType: VehicleType
  /** Used when autoFill is off. */
  count: number
  /** Fill the whole baseline with as many stalls as fit. */
  autoFill: boolean
  side: 'left' | 'right'
  flip: boolean
  codePrefix: string
  codeStart: number
  /** Zero-pad the number to this width; 0 = off. */
  codePad: number
}

export interface SpotRowToolBag {
  active: boolean
  params: SpotRowParams
  setParams: (patch: Partial<SpotRowParams>) => void
  baseline: { p0: Point; p1: Point } | null
  phase: 'idle' | 'drawing' | 'ready'
  /** Live preview placements, recomputed from the baseline + params. */
  placements: SpotRowPlacement[]
  /** How many stalls fit along the current baseline (0 when none drawn). */
  capacity: number
  /** Unused baseline length after the placed stalls, meters. */
  leftoverM: number
  /** True once the row has been persisted (the second click has fired). */
  committed: boolean
  /** Ids of the spots this row currently has persisted (empty before the second click). */
  committedIds: string[]
  /** Placements whose code collides with a spot elsewhere on the floor - blocks auto-commit. */
  clash: SpotRowPlacement[]
  canvasClick: (world: Point) => void
  handlePointerMove: (world: Point) => void
  moveBaselineEnd: (which: 0 | 1, world: Point) => void
  /** Re-persists the current placements (e.g. after tweaking angle/count/etc). */
  applyChanges: () => Promise<void>
  /** Deletes any bays already persisted for this row and resets the tool. */
  cancel: () => Promise<void>
  /**
   * Clears the local draft/baseline/committed-ids without touching the
   * backend - for when the bays were already removed by something outside
   * the tool (a Cmd+Z undoing this same row session), so the preview outline
   * doesn't linger over bays that no longer exist.
   */
  resetSession: () => void
  busy: boolean
}

interface Draft {
  p0: Point
  p1: Point
  complete: boolean
}

const DEFAULT_PARAMS: SpotRowParams = {
  angleDeg: 90,
  stallWidthM: STALL_DIMENSIONS_BY_VEHICLE.CAR.width,
  stallDepthM: STALL_DIMENSIONS_BY_VEHICLE.CAR.height,
  vehicleType: 'CAR',
  count: 10,
  autoFill: true,
  side: 'left',
  flip: false,
  codePrefix: '',
  codeStart: 1,
  codePad: 2,
}

function buildPlacements(p0: Point, p1: Point, params: SpotRowParams): SpotRowPlacement[] {
  const capacity = spotRowCapacity(p0, p1, params.angleDeg, params.stallWidthM)
  const count = params.autoFill ? Math.max(1, capacity) : Math.max(0, Math.floor(params.count))
  return computeSpotRow({
    p0,
    p1,
    angleDeg: params.angleDeg,
    stallWidthM: params.stallWidthM,
    stallDepthM: params.stallDepthM,
    count,
    side: params.side,
    flip: params.flip,
    codePrefix: params.codePrefix,
    codeStart: Math.floor(params.codeStart) || 1,
    codePad: Math.max(0, Math.floor(params.codePad)),
    vehicleType: params.vehicleType,
  })
}

function clashesWith(
  placements: SpotRowPlacement[],
  existingCodes: Set<string>,
  committedCodes: Set<string>,
): boolean {
  return placements.some((p) => existingCodes.has(p.code) && !committedCodes.has(p.code))
}

/**
 * Finds a codeStart that doesn't collide with anything already on the floor,
 * starting from the current one - e.g. a floor already numbered 01-11 (built
 * before this row tool ever touched it) shouldn't block a first row that
 * defaults to codeStart 1. Jumps forward by a full row's worth of codes each
 * try, since a real clash is almost always a contiguous block used by other
 * spots, not a scattered handful.
 */
function resolveCodeStart(
  p0: Point,
  p1: Point,
  params: SpotRowParams,
  existingCodes: Set<string>,
  committedCodes: Set<string>,
): { placements: SpotRowPlacement[]; codeStart: number; ok: boolean } {
  let codeStart = Math.floor(params.codeStart) || 1
  for (let attempt = 0; attempt < 500; attempt++) {
    const placements = buildPlacements(p0, p1, { ...params, codeStart })
    if (placements.length === 0 || !clashesWith(placements, existingCodes, committedCodes)) {
      return { placements, codeStart, ok: true }
    }
    codeStart += placements.length
  }
  return { placements: buildPlacements(p0, p1, { ...params, codeStart }), codeStart, ok: false }
}

/**
 * State machine for the "Parking row" editor tool. Mirrors the ruler draft in
 * useFloorPlanEditor: first click drops p0, the pointer drags p1 live, the
 * second click freezes the baseline and immediately persists the row
 * (createSpot + updateSpotLayout per stall). The row stays selected afterward
 * (draggable endpoints, editable params) - dragging an endpoint or pressing
 * "Update" deletes the previously persisted bays and recreates them from the
 * new geometry, so `onCommitRow` always replaces whatever it created last.
 *
 * Kept separate from useFloorPlanEditor because bays are a different entity from
 * FloorElements with their own persistence path. The active-tool flag still
 * lives in useFloorPlanEditor (EditorTool union); this hook only reacts to it.
 */
export function useSpotRowTool(opts: {
  active: boolean
  gridStepM: number
  snapEnabled: boolean
  /** All spot codes currently on the floor (including this row's own persisted bays). */
  existingCodes: Set<string>
  onCommitRow: (placements: SpotRowPlacement[], previousIds: string[]) => Promise<string[]>
}): SpotRowToolBag {
  const { active, gridStepM, snapEnabled, existingCodes, onCommitRow } = opts

  const [params, setParamsState] = useState<SpotRowParams>(DEFAULT_PARAMS)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [committedIds, setCommittedIds] = useState<string[]>([])
  // Codes from this row's own last successful commit - `existingCodes` still
  // contains them (until the parent's next reload), but a code the row is
  // about to replace with itself isn't a real clash.
  const [committedCodes, setCommittedCodes] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const snap = useCallback(
    (p: Point): Point => (snapEnabled && gridStepM > 0 ? snapToGrid(p, gridStepM) : p),
    [snapEnabled, gridStepM],
  )

  const setParams = useCallback((patch: Partial<SpotRowParams>) => {
    setParamsState((prev) => {
      const next = { ...prev, ...patch }
      // Switching vehicle type re-seeds the stall footprint to that type's standard.
      if (patch.vehicleType && patch.vehicleType !== prev.vehicleType) {
        const dims = STALL_DIMENSIONS_BY_VEHICLE[patch.vehicleType]
        next.stallWidthM = dims.width
        next.stallDepthM = dims.height
      }
      return next
    })
  }, [])

  // Deletes whatever this row last persisted (if anything) and creates
  // `nextPlacements` in its place, tracking the freshly created ids.
  const persist = useCallback(
    async (nextPlacements: SpotRowPlacement[]) => {
      setBusy(true)
      try {
        const ids = await onCommitRow(nextPlacements, committedIds)
        setCommittedIds(ids)
        setCommittedCodes(new Set(nextPlacements.map((p) => p.code)))
      } finally {
        setBusy(false)
      }
    },
    [onCommitRow, committedIds],
  )

  const canvasClick = useCallback(
    (world: Point) => {
      const p = snap(world)
      if (!draft || draft.complete) {
        // Starting a fresh row after a committed one - advance codeStart past
        // it so the new row's default codes don't collide with what the last
        // one just claimed (they'd otherwise both start from the same number).
        if (committedIds.length > 0) {
          const bumped = committedIds.length
          setParamsState((prev) => ({ ...prev, codeStart: prev.codeStart + bumped }))
        }
        setCommittedIds([])
        setCommittedCodes(new Set())
        setDraft({ p0: p, p1: p, complete: false })
        return
      }
      setDraft({ p0: draft.p0, p1: p, complete: true })
      const resolved = resolveCodeStart(draft.p0, p, params, existingCodes, committedCodes)
      if (resolved.codeStart !== params.codeStart) {
        setParamsState((prev) => ({ ...prev, codeStart: resolved.codeStart }))
      }
      // A real (unresolvable) clash would just 500 per-item; leave it
      // uncommitted so the clash warning is the first thing the user sees.
      if (resolved.ok) void persist(resolved.placements)
    },
    [snap, draft, params, persist, existingCodes, committedCodes, committedIds],
  )

  const handlePointerMove = useCallback(
    (world: Point) => {
      setDraft((prev) => (prev && !prev.complete ? { ...prev, p1: snap(world) } : prev))
    },
    [snap],
  )

  const moveBaselineEnd = useCallback(
    (which: 0 | 1, world: Point) => {
      if (!draft) return
      const p = snap(world)
      const next = which === 0 ? { ...draft, p0: p } : { ...draft, p1: p }
      setDraft(next)
      // Only a completed row is draggable (see FloorMap), so this always
      // means "reposition the already-persisted row" - recommit in place,
      // unless the new geometry lands on a colliding code (see canvasClick).
      if (draft.complete) {
        const resolved = resolveCodeStart(next.p0, next.p1, params, existingCodes, committedCodes)
        if (resolved.codeStart !== params.codeStart) {
          setParamsState((prev) => ({ ...prev, codeStart: resolved.codeStart }))
        }
        if (resolved.ok) void persist(resolved.placements)
      }
    },
    [snap, draft, params, persist, existingCodes, committedCodes],
  )

  const baseline = useMemo(
    () => (draft ? { p0: draft.p0, p1: draft.p1 } : null),
    [draft],
  )

  const phase: SpotRowToolBag['phase'] = !draft ? 'idle' : draft.complete ? 'ready' : 'drawing'

  const capacity = useMemo(
    () =>
      baseline
        ? spotRowCapacity(baseline.p0, baseline.p1, params.angleDeg, params.stallWidthM)
        : 0,
    [baseline, params.angleDeg, params.stallWidthM],
  )

  const placements = useMemo(
    () => (baseline ? buildPlacements(baseline.p0, baseline.p1, params) : []),
    [baseline, params],
  )

  const clash = useMemo(
    () => placements.filter((p) => existingCodes.has(p.code) && !committedCodes.has(p.code)),
    [placements, existingCodes, committedCodes],
  )

  const leftoverM = useMemo(() => {
    if (!baseline) return 0
    const sinPhi = Math.max(Math.sin((params.angleDeg * Math.PI) / 180), 1e-3)
    const pitch = params.stallWidthM / sinPhi
    return Math.max(0, distance(baseline.p0, baseline.p1) - placements.length * pitch)
  }, [baseline, params.angleDeg, params.stallWidthM, placements.length])

  // For post-hoc param tweaks (angle, count, stall size, side, ...) that don't
  // move the baseline - those don't recommit on every keystroke, so this is an
  // explicit "push the current preview" action.
  const applyChanges = useCallback(async () => {
    if (busy || !baseline || placements.length === 0) return
    const resolved = resolveCodeStart(baseline.p0, baseline.p1, params, existingCodes, committedCodes)
    if (resolved.codeStart !== params.codeStart) {
      setParamsState((prev) => ({ ...prev, codeStart: resolved.codeStart }))
    }
    if (resolved.ok) await persist(resolved.placements)
  }, [busy, baseline, placements, params, existingCodes, committedCodes, persist])

  const cancel = useCallback(async () => {
    if (busy) return
    if (committedIds.length) {
      setBusy(true)
      try {
        await onCommitRow([], committedIds)
      } finally {
        setBusy(false)
      }
    }
    setCommittedIds([])
    setCommittedCodes(new Set())
    setDraft(null)
  }, [busy, committedIds, onCommitRow])

  const resetSession = useCallback(() => {
    setDraft(null)
    setCommittedIds([])
    setCommittedCodes(new Set())
  }, [])

  // Leaving the tool (or the editor switching tools) clears any half-drawn row
  // so a stale start point can't be reused on the next activation. Whatever was
  // already persisted stays on the floor - only the explicit Cancel path
  // deletes bays. Same tool-change-reset shape as MapPage's floor-change reset
  // (an accepted set-state-in-effect in this codebase).
  useEffect(() => {
    if (!active) {
      setDraft(null)
      setCommittedIds([])
      setCommittedCodes(new Set())
    }
  }, [active])

  // Esc aborts the current row, deleting anything it already persisted.
  useEffect(() => {
    if (!active || !draft) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') void cancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, draft, cancel])

  return useMemo(
    () => ({
      active,
      params,
      setParams,
      baseline,
      phase,
      placements,
      capacity,
      leftoverM,
      committed: committedIds.length > 0,
      committedIds,
      clash,
      canvasClick,
      handlePointerMove,
      moveBaselineEnd,
      applyChanges,
      cancel,
      resetSession,
      busy,
    }),
    [
      active,
      params,
      setParams,
      baseline,
      phase,
      placements,
      capacity,
      leftoverM,
      committedIds,
      clash,
      canvasClick,
      handlePointerMove,
      moveBaselineEnd,
      applyChanges,
      cancel,
      resetSession,
      busy,
    ],
  )
}
