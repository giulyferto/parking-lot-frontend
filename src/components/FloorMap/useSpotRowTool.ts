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
  canvasClick: (world: Point) => void
  handlePointerMove: (world: Point) => void
  moveBaselineEnd: (which: 0 | 1, world: Point) => void
  generate: () => Promise<void>
  cancel: () => void
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
  autoFill: false,
  side: 'left',
  flip: false,
  codePrefix: '',
  codeStart: 1,
  codePad: 2,
}

/**
 * State machine for the "Parking row" editor tool. Mirrors the ruler draft in
 * useFloorPlanEditor: first click drops p0, the pointer drags p1 live, the
 * second click freezes the baseline, then "generate" hands the computed
 * placements to the page to persist (createSpot + updateSpotLayout per stall).
 *
 * Kept separate from useFloorPlanEditor because bays are a different entity from
 * FloorElements with their own persistence path. The active-tool flag still
 * lives in useFloorPlanEditor (EditorTool union); this hook only reacts to it.
 */
export function useSpotRowTool(opts: {
  active: boolean
  gridStepM: number
  snapEnabled: boolean
  onCommitRow: (placements: SpotRowPlacement[]) => Promise<void>
}): SpotRowToolBag {
  const { active, gridStepM, snapEnabled, onCommitRow } = opts

  const [params, setParamsState] = useState<SpotRowParams>(DEFAULT_PARAMS)
  const [draft, setDraft] = useState<Draft | null>(null)
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

  const canvasClick = useCallback(
    (world: Point) => {
      const p = snap(world)
      setDraft((prev) => {
        if (!prev || prev.complete) return { p0: p, p1: p, complete: false }
        return { p0: prev.p0, p1: p, complete: true }
      })
    },
    [snap],
  )

  const handlePointerMove = useCallback(
    (world: Point) => {
      setDraft((prev) => (prev && !prev.complete ? { ...prev, p1: snap(world) } : prev))
    },
    [snap],
  )

  const moveBaselineEnd = useCallback(
    (which: 0 | 1, world: Point) => {
      const p = snap(world)
      setDraft((prev) => {
        if (!prev) return prev
        return which === 0 ? { ...prev, p0: p } : { ...prev, p1: p }
      })
    },
    [snap],
  )

  const cancel = useCallback(() => setDraft(null), [])

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

  const placements = useMemo(() => {
    if (!baseline) return []
    const count = params.autoFill ? Math.max(1, capacity) : Math.max(0, Math.floor(params.count))
    return computeSpotRow({
      p0: baseline.p0,
      p1: baseline.p1,
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
  }, [baseline, capacity, params])

  const leftoverM = useMemo(() => {
    if (!baseline) return 0
    const sinPhi = Math.max(Math.sin((params.angleDeg * Math.PI) / 180), 1e-3)
    const pitch = params.stallWidthM / sinPhi
    return Math.max(0, distance(baseline.p0, baseline.p1) - placements.length * pitch)
  }, [baseline, params.angleDeg, params.stallWidthM, placements.length])

  const generate = useCallback(async () => {
    if (busy || placements.length === 0) return
    setBusy(true)
    try {
      await onCommitRow(placements)
    } finally {
      setBusy(false)
      setDraft(null)
    }
  }, [busy, placements, onCommitRow])

  // Leaving the tool (or the editor switching tools) clears any half-drawn row
  // so a stale start point can't be reused on the next activation. Same
  // tool-change-reset shape as MapPage's floor-change reset (an accepted
  // set-state-in-effect in this codebase).
  useEffect(() => {
    if (!active) setDraft(null)
  }, [active])

  // Esc cancels the current baseline while the tool is active.
  useEffect(() => {
    if (!active || !draft) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setDraft(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, draft])

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
      canvasClick,
      handlePointerMove,
      moveBaselineEnd,
      generate,
      cancel,
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
      canvasClick,
      handlePointerMove,
      moveBaselineEnd,
      generate,
      cancel,
      busy,
    ],
  )
}
