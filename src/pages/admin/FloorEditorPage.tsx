import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getFloor, rescaleFloor } from '../../api/floors'
import {
  createSpot,
  deleteSpot,
  listSpots,
  updateSpotLayout,
  updateSpotStatus,
  type SpotInput,
  type SpotLayoutInput,
} from '../../api/spots'
import { createRatePlan, listRatePlans } from '../../api/ratePlans'
import {
  createFloorElement,
  deleteFloorElement,
  listFloorElements,
  updateFloorElement,
  type FloorElementInput,
  type FloorElementPatch,
} from '../../api/floorElements'
import { FloorMap } from '../../components/FloorMap/FloorMap'
import { SPOT_COLORS } from '../../components/FloorMap/spotColors'
import { ELEMENT_LABELS } from '../../components/FloorMap/floorElementStyles'
import {
  geometrySummary,
  minVertices,
  type SpotRowPlacement,
} from '../../components/FloorMap/geometry'
import {
  useFloorPlanEditor,
  type EditorTool,
  type FloorPlanEditorBag,
} from '../../components/FloorMap/useFloorPlanEditor'
import { useSpotRowTool, type SpotRowToolBag } from '../../components/FloorMap/useSpotRowTool'
import { useUndoStack, type UndoCommand, type UndoStackBag } from './useUndoStack'
import {
  AISLE_WIDTH_BY_ANGLE_M,
  ANGLE_PRESETS_DEG,
  ROW_PARK_ANGLES,
  STALL_DIMENSIONS_BY_VEHICLE,
  STALL_PRESETS,
} from '../../components/FloorMap/spotDimensions'
import { Eyebrow } from '../../components/ui'
import { btn, field } from '../../components/styles'
import type { Floor, FloorElement, RatePlan, Spot, SpotStatus, VehicleType } from '../../types'

const VEHICLE_TYPES: VehicleType[] = ['CAR', 'MOTORCYCLE', 'EV', 'HANDICAP']

// `select` is not in this strip - it's the floating arrow button pinned to the
// floor plan itself (see SelectHandle), so the default/idle tool sits on the
// canvas the way it does in a drawing app, not in the row of draw tools.
const TOOLS: Array<[EditorTool, string]> = [
  ['boundary', 'Boundary'],
  ['column', 'Column'],
  ['wall', 'Wall'],
  ['lane', 'Drive lane'],
  ['street', 'Street'],
  ['entrance', 'Entrance'],
  ['spotRow', 'Parking row'],
  ['calibrate', 'Calibrate'],
]

const TOOL_HINT: Record<EditorTool, string> = {
  select: '',
  boundary: 'Click each corner · click the first point or press Enter to close · Esc cancels',
  wall: 'Click along the wall · press Enter to finish · Esc cancels',
  lane: 'Click along the aisle · press Enter to finish · Esc cancels',
  street: 'Click along the road · press Enter to finish · Esc cancels',
  column: 'Click to drop a column',
  entrance: 'Draw the boundary first · then click the two ends of the opening — it snaps onto the wall',
  spotRow: 'Click the two ends of the row along the aisle, then set it up on the right · Esc cancels',
  calibrate: 'Click two points across a distance you know, then enter it on the right',
}

export function FloorEditorPage() {
  const { floorId } = useParams<{ floorId: string }>()
  const [floor, setFloor] = useState<Floor | null>(null)
  const [spots, setSpots] = useState<Spot[]>([])
  const [elements, setElements] = useState<FloorElement[]>([])
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([])
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null)

  const [gridStepM, setGridStepM] = useState(1)
  const [snapEnabled, setSnapEnabled] = useState(false)
  const [showGrid, setShowGrid] = useState(false)
  const [showScaleBar, setShowScaleBar] = useState(true)
  const [fitToken, setFitToken] = useState(0)

  const reload = useCallback(() => {
    if (!floorId) return
    getFloor(floorId).then(setFloor)
    listSpots(floorId).then(setSpots)
    listFloorElements(floorId).then(setElements)
    listRatePlans(floorId).then(setRatePlans)
  }, [floorId])

  useEffect(() => reload(), [reload])

  const spotRowBusyRef = useRef(false)
  const spotRowResetRef = useRef<() => void>(() => {})
  const spotRowPhaseRef = useRef<'idle' | 'drawing' | 'ready'>('idle')
  const undoStack = useUndoStack({ isBlocked: () => spotRowBusyRef.current })

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

  const editor = useFloorPlanEditor({
    elements,
    gridStepM: snapEnabled ? gridStepM : 0,
    snapEnabled,
    onCreate,
    onUpdate,
    onDelete,
    onRescale,
  })

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

  const existingCodes = useMemo(() => new Set(spots.map((s) => s.code)), [spots])

  const spotRow = useSpotRowTool({
    active: editor.tool === 'spotRow',
    gridStepM: snapEnabled ? gridStepM : 0,
    snapEnabled,
    existingCodes,
    onCommitRow: handleCommitRow,
  })

  useEffect(() => {
    spotRowBusyRef.current = spotRow.busy
  }, [spotRow.busy])

  useEffect(() => {
    spotRowResetRef.current = spotRow.resetSession
  }, [spotRow.resetSession])

  useEffect(() => {
    spotRowPhaseRef.current = spotRow.phase
  }, [spotRow.phase])

  const boundaryExists = useMemo(() => elements.some((e) => e.kind === 'BOUNDARY'), [elements])

  if (!floor) {
    return <div className="px-6 py-6 font-mono text-xs uppercase tracking-[0.16em] text-slate-400">Loading…</div>
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <Link
          to={`/admin/parking-lots/${floor.parkingLotId}`}
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          ← Back to floors
        </Link>
        <h1 className="mt-0.5 font-display text-xl font-semibold tracking-tight text-slate-900">
          {floor.name}
          <span className="ml-2 font-mono text-xs uppercase tracking-[0.16em] text-slate-400">
            Plan, layout &amp; rates
          </span>
        </h1>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
        <div className="flex min-h-[55vh] min-w-0 flex-col gap-2 p-4 md:min-h-0 md:flex-1 sm:p-6">
          <ToolStrip
            tool={editor.tool}
            onPick={editor.setTool}
            onFit={() => setFitToken((n) => n + 1)}
            boundaryExists={boundaryExists}
            undoStack={undoStack}
            rowBusy={spotRow.busy}
          />
          <div className="deck-grid relative h-full min-h-[24rem] w-full overflow-hidden rounded-xl border border-slate-200 md:min-h-0">
            {spots.length === 0 && elements.length === 0 && editor.tool === 'select' ? (
              <div className="flex h-full flex-col items-center justify-center gap-1 p-6 text-center">
                <p className="text-sm font-medium text-slate-600">Empty floor</p>
                <p className="text-sm text-slate-400">
                  Draw the outer boundary with the tools above, or add a bay from the panel.
                </p>
              </div>
            ) : (
              <>
                <FloorMap
                  spots={spots}
                  elements={elements}
                  selectedSpotId={selectedSpot?.id}
                  showGrid={showGrid}
                  showScaleBar={showScaleBar}
                  gridStepM={gridStepM}
                  fitToken={fitToken}
                  editor={editor}
                  spotRowTool={spotRow}
                  onSpotClick={setSelectedSpot}
                  onSpotDragEnd={handleDragEnd}
                />
                <SelectHandle
                  active={editor.tool === 'select'}
                  editing={editor.tool === 'select' && editor.selectedElementId != null}
                  onClick={() => editor.setTool('select')}
                />
              </>
            )}
            <ToolHint tool={editor.tool} />
          </div>
        </div>

        <aside className="w-full shrink-0 space-y-5 border-t border-slate-200 bg-white p-5 md:w-96 md:overflow-y-auto md:border-l md:border-t-0">
          <PlanScalePanel
            editor={editor}
            elements={elements}
            gridStepM={gridStepM}
            onGridStepM={setGridStepM}
            snapEnabled={snapEnabled}
            onSnapEnabled={setSnapEnabled}
            showGrid={showGrid}
            onShowGrid={setShowGrid}
            showScaleBar={showScaleBar}
            onShowScaleBar={setShowScaleBar}
          />
          <hr className="border-slate-100" />
          {editor.tool === 'spotRow' && (
            <>
              <SpotRowPanel tool={spotRow} onDone={() => editor.setTool('select')} />
              <hr className="border-slate-100" />
            </>
          )}
          <AddSpotForm onCreate={handleCreateSpot} />
          <hr className="border-slate-100" />
          {selectedSpot ? (
            <SpotEditor
              key={selectedSpot.id}
              spot={selectedSpot}
              onClose={() => setSelectedSpot(null)}
              onChanged={reload}
              pushUndo={undoStack.push}
            />
          ) : (
            <p className="text-sm text-slate-400">Click a bay to edit its size, rotation or status.</p>
          )}
          <hr className="border-slate-100" />
          <RatePlansEditor floorId={floor.id} ratePlans={ratePlans} onCreated={reload} />
        </aside>
      </div>
    </div>
  )
}

function ToolStrip({
  tool,
  onPick,
  onFit,
  boundaryExists,
  undoStack,
  rowBusy,
}: {
  tool: EditorTool
  onPick: (t: EditorTool) => void
  onFit: () => void
  boundaryExists: boolean
  undoStack: UndoStackBag
  rowBusy: boolean
}) {
  const rowBusyHint = 'Saving the parking row…'
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {TOOLS.map(([value, label]) => {
        const active = tool === value
        const disabled = value === 'boundary' && boundaryExists
        return (
          <button
            key={value}
            type="button"
            onClick={() => onPick(value)}
            disabled={disabled}
            title={disabled ? 'This floor already has a boundary - select it to edit' : undefined}
            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
              active
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            } disabled:opacity-40`}
          >
            {label}
          </button>
        )
      })}
      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={undoStack.undo}
          disabled={rowBusy || !undoStack.canUndo || undoStack.busy}
          title={rowBusy ? rowBusyHint : 'Undo (Cmd/Ctrl+Z)'}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={undoStack.redo}
          disabled={rowBusy || !undoStack.canRedo || undoStack.busy}
          title={rowBusy ? rowBusyHint : 'Redo (Cmd/Ctrl+Shift+Z)'}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
        >
          Redo
        </button>
        <button
          type="button"
          onClick={onFit}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
        >
          Fit
        </button>
      </div>
    </div>
  )
}

function ToolHint({ tool }: { tool: EditorTool }) {
  const visible = tool !== 'select'
  const [shown, setShown] = useState<EditorTool>(visible ? tool : 'boundary')
  if (visible && tool !== shown) setShown(tool)

  const label = TOOLS.find(([value]) => value === shown)?.[1] ?? ''
  const steps = TOOL_HINT[shown].split('·').map((s) => s.trim())

  return (
    <div
      role="status"
      aria-hidden={!visible}
      className={`pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-3 transition duration-200 ease-out ${
        visible ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
      }`}
    >
      <div className="flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-[11px] leading-snug text-slate-600 shadow-sm backdrop-blur">
        <span className="font-mono font-semibold uppercase tracking-[0.14em] text-blue-700">
          {label}
        </span>
        {steps.map((step, i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <span className="text-slate-300">/</span>}
            <span>{renderHintStep(step)}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function renderHintStep(step: string) {
  return step.split(/\b(Enter|Esc)\b/).map((chunk, i) =>
    chunk === 'Enter' || chunk === 'Esc' ? (
      <kbd
        key={i}
        className="rounded border border-slate-300 bg-slate-50 px-1 font-mono text-[10px] text-slate-500"
      >
        {chunk}
      </kbd>
    ) : (
      <span key={i}>{chunk}</span>
    ),
  )
}

function SelectHandle({
  active,
  editing,
  onClick,
}: {
  active: boolean
  editing: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Select / move"
      aria-label="Select / move"
      aria-pressed={active}
      className={`absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg border shadow-sm transition-colors ${
        editing
          ? 'border-slate-900 bg-white/95 text-slate-900 ring-1 ring-slate-900'
          : active
            ? 'border-blue-300 bg-blue-50 text-blue-700'
            : 'border-slate-200 bg-white/95 text-slate-600 hover:bg-slate-50'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z" />
      </svg>
    </button>
  )
}

const microLabel = 'mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400'

const presetChip =
  'rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50'

function PlanScalePanel({
  editor,
  elements,
  gridStepM,
  onGridStepM,
  snapEnabled,
  onSnapEnabled,
  showGrid,
  onShowGrid,
  showScaleBar,
  onShowScaleBar,
}: {
  editor: FloorPlanEditorBag
  elements: FloorElement[]
  gridStepM: number
  onGridStepM: (n: number) => void
  snapEnabled: boolean
  onSnapEnabled: (b: boolean) => void
  showGrid: boolean
  onShowGrid: (b: boolean) => void
  showScaleBar: boolean
  onShowScaleBar: (b: boolean) => void
}) {
  const [actualLength, setActualLength] = useState('')
  const sel = editor.selectedElement

  return (
    <div>
      <Eyebrow className="mb-3">Plan &amp; scale</Eyebrow>

      <div className="mb-4 space-y-2 text-sm text-slate-600">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => onShowGrid(e.target.checked)}
          />
          Show meter grid
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={snapEnabled}
            onChange={(e) => onSnapEnabled(e.target.checked)}
          />
          Snap to grid
        </label>
        <label className="block">
          <span className={microLabel}>Grid / snap step (m)</span>
          <input
            type="number"
            min="0.25"
            step="0.25"
            value={gridStepM}
            onChange={(e) => onGridStepM(Math.max(Number(e.target.value) || 0, 0.25))}
            className={`${field} px-2 py-1.5`}
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showScaleBar}
            onChange={(e) => onShowScaleBar(e.target.checked)}
          />
          Show scale bar
        </label>
      </div>

      {editor.tool === 'calibrate' && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="font-mono text-xs text-slate-600">
            Drawn:{' '}
            <span className="font-semibold text-slate-900">
              {editor.rulerLengthM != null ? `${editor.rulerLengthM.toFixed(2)} m` : '—'}
            </span>
          </p>
          <p className="mt-1 mb-2 text-xs text-slate-500">
            Click two points across a feature whose real length you know, then enter it.
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="0.1"
              value={actualLength}
              onChange={(e) => setActualLength(e.target.value)}
              placeholder="Actual length (m)"
              className={`${field} px-2 py-1.5`}
            />
            <button
              type="button"
              disabled={editor.rulerLengthM == null || !actualLength}
              onClick={() => {
                editor.commitCalibration(Number(actualLength))
                setActualLength('')
              }}
              className={btn.primary}
            >
              Apply
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-slate-500">
            Rescales every bay and plan element on this floor.
          </p>
        </div>
      )}

      <span className={microLabel}>Elements ({elements.length})</span>
      <ul className="mb-3 space-y-1.5">
        {elements.map((el) => (
          <li
            key={el.id}
            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${
              editor.selectedElementId === el.id
                ? 'border-blue-200 bg-blue-50'
                : 'border-slate-200'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                editor.setTool('select')
                editor.selectElement(el.id)
              }}
              className="min-w-0 flex-1 text-left"
            >
              <span className="font-mono font-semibold uppercase tracking-[0.1em] text-slate-800">
                {ELEMENT_LABELS[el.kind]}
              </span>
              <span className="block truncate text-slate-500">{geometrySummary(el.geometry)}</span>
            </button>
            <button
              type="button"
              onClick={() => editor.deleteElement(el.id)}
              className="ml-2 shrink-0 font-semibold text-red-600 hover:text-red-700"
            >
              Delete
            </button>
          </li>
        ))}
        {elements.length === 0 && <li className="text-xs text-slate-400">Nothing drawn yet.</li>}
      </ul>

      {sel && <SelectedElementEditor key={sel.id} editor={editor} element={sel} />}
    </div>
  )
}

function SelectedElementEditor({
  editor,
  element,
}: {
  editor: FloorPlanEditorBag
  element: FloorElement
}) {
  const coords =
    element.geometry.type === 'Point'
      ? [element.geometry.coordinates]
      : element.geometry.coordinates
  const removable = coords.length > minVertices(element.geometry)
  const isLane = element.kind === 'DRIVE_LANE' || element.kind === 'STREET'
  const isBoundary = element.kind === 'BOUNDARY'

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-slate-900">
          {ELEMENT_LABELS[element.kind]}
        </h3>
        <button
          type="button"
          onClick={() => editor.selectElement(null)}
          className="text-xs font-medium text-slate-400 hover:text-slate-600"
        >
          Close
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-3">
        {element.kind !== 'ENTRANCE' && element.kind !== 'WALL' && (
          <label className="block">
            <span className={microLabel}>Fill</span>
            <input
              type="color"
              value={hexOr(element.style?.fill, '#e2e8f0')}
              onChange={(e) => editor.updateSelectedStyle({ fill: e.target.value })}
              className="h-8 w-12 rounded border border-slate-200"
            />
          </label>
        )}
        <label className="block">
          <span className={microLabel}>Stroke</span>
          <input
            type="color"
            value={hexOr(element.style?.stroke, '#0f172a')}
            onChange={(e) => editor.updateSelectedStyle({ stroke: e.target.value })}
            className="h-8 w-12 rounded border border-slate-200"
          />
        </label>
        {(isLane || isBoundary) && (
          <label className="block">
            <span className={microLabel}>{isBoundary ? 'Wall thickness (m)' : 'Lane width (m)'}</span>
            <input
              type="number"
              min={isBoundary ? '0.1' : '0.5'}
              step={isBoundary ? '0.05' : '0.5'}
              defaultValue={element.style?.widthM ?? ''}
              onBlur={(e) =>
                e.target.value && editor.updateSelectedStyle({ widthM: Number(e.target.value) })
              }
              className={`${field} w-24 px-2 py-1.5`}
            />
          </label>
        )}
        {element.kind === 'COLUMN' && (
          <label className="block">
            <span className={microLabel}>Radius (m)</span>
            <input
              type="number"
              min="0.1"
              step="0.1"
              defaultValue={element.style?.radiusM ?? ''}
              onBlur={(e) =>
                e.target.value && editor.updateSelectedStyle({ radiusM: Number(e.target.value) })
              }
              className={`${field} w-24 px-2 py-1.5`}
            />
          </label>
        )}
        {(element.kind === 'LABEL' || element.kind === 'ENTRANCE') && (
          <label className="block">
            <span className={microLabel}>{element.kind === 'ENTRANCE' ? 'Title' : 'Text'}</span>
            <input
              type="text"
              defaultValue={element.style?.label ?? ''}
              placeholder={element.kind === 'ENTRANCE' ? 'Entrance' : undefined}
              onBlur={(e) => editor.updateSelectedStyle({ label: e.target.value })}
              className={`${field} px-2 py-1.5`}
            />
          </label>
        )}
      </div>

      <span className={microLabel}>Vertices</span>
      <ul className="max-h-40 space-y-1 overflow-y-auto">
        {coords.map((c, i) => (
          <li
            key={i}
            className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400"
          >
            <span>
              [{c[0].toFixed(2)}, {c[1].toFixed(2)}]
            </span>
            {removable && (
              <button
                type="button"
                onClick={() => editor.removeVertex(i)}
                className="px-1 text-slate-400 hover:text-red-600"
                aria-label={`Remove vertex ${i + 1}`}
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function hexOr(value: string | undefined, fallback: string): string {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback
}

function SpotRowPanel({
  tool,
  onDone,
}: {
  tool: SpotRowToolBag
  onDone: () => void
}) {
  const { params, placements, clash } = tool
  const sinPhi = Math.max(Math.sin((params.angleDeg * Math.PI) / 180), 1e-3)
  const pitch = params.stallWidthM / sinPhi
  const first = placements[0]?.code
  const last = placements[placements.length - 1]?.code
  const num = (raw: string) => (raw === '' ? 0 : Number(raw))

  return (
    <div>
      <Eyebrow className="mb-3">Parking row</Eyebrow>

      {tool.phase === 'idle' && (
        <p className="mb-3 text-xs leading-relaxed text-slate-500">
          Click the two ends of the row along the aisle on the plan - the bays are created as soon as
          the second click lands. Drag an endpoint afterwards to reposition the row, or tweak the
          fields below and press Update.
        </p>
      )}

      <div className="space-y-3 text-sm text-slate-600">
        <div>
          <span className={microLabel}>Parking angle</span>
          <div className="flex flex-wrap gap-1.5">
            {ROW_PARK_ANGLES.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => tool.setParams({ angleDeg: a })}
                className={`${presetChip} ${
                  params.angleDeg === a ? 'border-blue-200 bg-blue-50 text-blue-700' : ''
                }`}
              >
                {a}&deg;
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Aisle guidance: {AISLE_WIDTH_BY_ANGLE_M[params.angleDeg]} m (
            {params.angleDeg === 90 ? 'two-way' : 'one-way'})
          </p>
        </div>

        <label className="block">
          <span className={microLabel}>Vehicle type</span>
          <select
            value={params.vehicleType}
            onChange={(e) => tool.setParams({ vehicleType: e.target.value as VehicleType })}
            className={`${field} px-2 py-1.5`}
          >
            {VEHICLE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-2">
          <label className="flex-1">
            <span className={microLabel}>Stall width (m)</span>
            <input
              type="number"
              min="0.5"
              step="0.1"
              value={params.stallWidthM}
              onChange={(e) => tool.setParams({ stallWidthM: num(e.target.value) })}
              className={`${field} px-2 py-1.5`}
            />
          </label>
          <label className="flex-1">
            <span className={microLabel}>Stall depth (m)</span>
            <input
              type="number"
              min="0.5"
              step="0.1"
              value={params.stallDepthM}
              onChange={(e) => tool.setParams({ stallDepthM: num(e.target.value) })}
              className={`${field} px-2 py-1.5`}
            />
          </label>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={params.autoFill}
            onChange={(e) => tool.setParams({ autoFill: e.target.checked })}
          />
          Fill the baseline to length
        </label>

        {params.autoFill ? (
          <p className="text-[11px] text-slate-400">
            Fits {tool.capacity} {tool.capacity === 1 ? 'bay' : 'bays'} · {tool.leftoverM.toFixed(2)} m
            left over
          </p>
        ) : (
          <label className="block">
            <span className={microLabel}>Count</span>
            <input
              type="number"
              min="1"
              step="1"
              value={params.count}
              onChange={(e) => tool.setParams({ count: num(e.target.value) })}
              className={`${field} px-2 py-1.5`}
            />
          </label>
        )}

        <div>
          <span className={microLabel}>Side of the line</span>
          <div className="flex flex-wrap gap-1.5">
            {(['left', 'right'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => tool.setParams({ side: s })}
                className={`${presetChip} ${
                  params.side === s ? 'border-blue-200 bg-blue-50 text-blue-700' : ''
                }`}
              >
                {s === 'left' ? 'Left of line' : 'Right of line'}
              </button>
            ))}
          </div>
        </div>

        {params.angleDeg !== 90 && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={params.flip}
              onChange={(e) => tool.setParams({ flip: e.target.checked })}
            />
            Flip the angle direction
          </label>
        )}

        <div className="flex gap-2">
          <label className="flex-1">
            <span className={microLabel}>Code prefix</span>
            <input
              type="text"
              value={params.codePrefix}
              onChange={(e) => tool.setParams({ codePrefix: e.target.value })}
              placeholder="e.g. A-"
              className={`${field} px-2 py-1.5`}
            />
          </label>
          <label className="w-20">
            <span className={microLabel}>Start</span>
            <input
              type="number"
              min="0"
              step="1"
              value={params.codeStart}
              onChange={(e) => tool.setParams({ codeStart: num(e.target.value) })}
              className={`${field} px-2 py-1.5`}
            />
          </label>
          <label className="w-20">
            <span className={microLabel}>Pad</span>
            <input
              type="number"
              min="0"
              step="1"
              value={params.codePad}
              onChange={(e) => tool.setParams({ codePad: num(e.target.value) })}
              className={`${field} px-2 py-1.5`}
            />
          </label>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        {placements.length > 0 ? (
          <>
            <p>
              <span className="font-semibold text-slate-900">
                {placements.length} {placements.length === 1 ? 'bay' : 'bays'}
              </span>{' '}
              · {params.stallWidthM} &times; {params.stallDepthM} m · {params.angleDeg}&deg; · row{' '}
              {(placements.length * pitch).toFixed(1)} m
            </p>
            {first && <p className="mt-0.5 font-mono text-slate-500">{first} … {last}</p>}
          </>
        ) : (
          <p className="text-slate-400">Draw a baseline to preview the row.</p>
        )}
        {clash.length > 0 && (
          <p className="mt-1 font-semibold text-amber-600">
            Codes already in use: {clash.map((p) => p.code).join(', ')} - the code start will
            auto-advance past them when this saves.
          </p>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        {tool.committed && (
          <button
            type="button"
            disabled={tool.phase !== 'ready' || tool.busy || placements.length === 0}
            onClick={() => void tool.applyChanges()}
            className={`${btn.primary} flex-1`}
          >
            {tool.busy ? 'Updating…' : `Update ${placements.length || ''} ${placements.length === 1 ? 'bay' : 'bays'}`}
          </button>
        )}
        <button
          type="button"
          disabled={tool.busy}
          onClick={onDone}
          className={tool.committed ? btn.ghost : `${btn.primary} flex-1`}
        >
          Done
        </button>
        <button
          type="button"
          disabled={tool.busy}
          onClick={async () => {
            await tool.cancel()
            onDone()
          }}
          className={btn.ghost}
        >
          {tool.committed ? 'Delete row' : 'Cancel'}
        </button>
      </div>
    </div>
  )
}

function AddSpotForm({ onCreate }: { onCreate: (input: SpotInput) => Promise<void> }) {
  const [code, setCode] = useState('')
  const [vehicleType, setVehicleType] = useState<VehicleType>('CAR')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await onCreate({ code, vehicleType })
      setCode('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Eyebrow className="mb-3">Add bay</Eyebrow>
      <div className="mb-2 flex gap-2">
        <input
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Code, e.g. A-01"
          className={field}
        />
        <select
          value={vehicleType}
          onChange={(e) => setVehicleType(e.target.value as VehicleType)}
          className={`${field} w-auto`}
        >
          {VEHICLE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={submitting} className={`${btn.ghost} w-full`}>
        Add bay — standard stall size for its type
      </button>
    </form>
  )
}

function SpotEditor({
  spot,
  onClose,
  onChanged,
  pushUndo,
}: {
  spot: Spot
  onClose: () => void
  onChanged: () => void
  pushUndo: (command: UndoCommand) => void
}) {
  const [width, setWidth] = useState(String(spot.width))
  const [height, setHeight] = useState(String(spot.height))
  const [rotation, setRotation] = useState(String(spot.rotation))
  const [saving, setSaving] = useState(false)

  async function handleSaveGeometry(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      const before: SpotLayoutInput = {
        posX: spot.posX,
        posY: spot.posY,
        width: spot.width,
        height: spot.height,
        rotation: spot.rotation,
      }
      const after: SpotLayoutInput = {
        ...before,
        width: Number(width),
        height: Number(height),
        rotation: Number(rotation),
      }
      await updateSpotLayout(spot.id, after)
      pushUndo({
        undo: async () => {
          await updateSpotLayout(spot.id, before)
          onChanged()
        },
        redo: async () => {
          await updateSpotLayout(spot.id, after)
          onChanged()
        },
      })
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  async function handleSetStatus(status: SpotStatus) {
    await updateSpotStatus(spot.id, status)
    onChanged()
  }

  async function handleDelete() {
    const snapshot: SpotInput & { layout: SpotLayoutInput } = {
      code: spot.code,
      vehicleType: spot.vehicleType,
      layout: {
        posX: spot.posX,
        posY: spot.posY,
        width: spot.width,
        height: spot.height,
        rotation: spot.rotation,
      },
    }
    await deleteSpot(spot.id)
    let currentId: string | null = null
    pushUndo({
      undo: async () => {
        const recreated = await createSpot(spot.floorId, {
          code: snapshot.code,
          vehicleType: snapshot.vehicleType,
        })
        currentId = recreated.id
        await updateSpotLayout(currentId, snapshot.layout)
        onChanged()
      },
      redo: async () => {
        if (!currentId) return
        await deleteSpot(currentId)
        currentId = null
        onChanged()
      },
    })
    onClose()
    onChanged()
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-4 rounded-[3px] ring-1 ring-inset ring-white/70"
            style={{ backgroundColor: SPOT_COLORS[spot.status] }}
          />
          <h2 className="font-display text-sm font-semibold tracking-tight text-slate-900">
            Bay {spot.code}
          </h2>
        </div>
        <button onClick={onClose} className="text-xs font-medium text-slate-400 hover:text-slate-600">
          Close
        </button>
      </div>

      <div className="mb-2">
        <span className={microLabel}>Stall preset</span>
        <div className="flex flex-wrap gap-1.5">
          {STALL_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.note}
              onClick={() => {
                setWidth(String(p.size.width))
                setHeight(String(p.size.height))
              }}
              className={presetChip}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-3">
        <span className={microLabel}>Angle</span>
        <div className="flex flex-wrap gap-1.5">
          {ANGLE_PRESETS_DEG.map((deg) => (
            <button
              key={deg}
              type="button"
              onClick={() => setRotation(String(deg))}
              className={presetChip}
            >
              {deg}&deg;
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSaveGeometry} className="mb-4 space-y-2.5">
        <div className="flex gap-2">
          {[
            ['Width', width, setWidth] as const,
            ['Height', height, setHeight] as const,
            ['Rotation', rotation, setRotation] as const,
          ].map(([label, value, set]) => (
            <div key={label} className="flex-1">
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">
                {label}
              </label>
              <input
                type="number"
                value={value}
                onChange={(e) => set(e.target.value)}
                className={`${field} px-2 py-1.5`}
              />
            </div>
          ))}
        </div>
        <button type="submit" disabled={saving} className={`${btn.ghost} w-full`}>
          Save size &amp; rotation
        </button>
      </form>

      {spot.status !== 'OCCUPIED' ? (
        <div className="mb-4">
          <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">
            Status
          </label>
          <div className="flex flex-wrap gap-2">
            {(['AVAILABLE', 'DISABLED', 'MAINTENANCE'] as SpotStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => handleSetStatus(s)}
                disabled={spot.status === s}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:border-blue-200 disabled:bg-blue-50 disabled:text-blue-700"
              >
                <span
                  className="inline-block h-2.5 w-3.5 rounded-[2px] ring-1 ring-inset ring-white/70"
                  style={{ backgroundColor: SPOT_COLORS[s] }}
                />
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="mb-4 text-xs leading-relaxed text-slate-500">
          This bay is occupied. Use the map’s check-out flow, not this panel, to free it.
        </p>
      )}

      <button
        onClick={handleDelete}
        className="text-xs font-semibold text-red-600 hover:text-red-700"
      >
        Delete bay
      </button>
    </div>
  )
}

function RatePlansEditor({
  floorId,
  ratePlans,
  onCreated,
}: {
  floorId: string
  ratePlans: RatePlan[]
  onCreated: () => void
}) {
  const [vehicleType, setVehicleType] = useState<VehicleType>('CAR')
  const [hourlyRate, setHourlyRate] = useState('')
  const [nightRate, setNightRate] = useState('')
  const [dayRate, setDayRate] = useState('')
  const [monthRate, setMonthRate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await createRatePlan(floorId, {
        vehicleType,
        hourlyRate: Number(hourlyRate),
        nightRate: nightRate ? Number(nightRate) : undefined,
        dayRate: dayRate ? Number(dayRate) : undefined,
        monthRate: monthRate ? Number(monthRate) : undefined,
      })
      setHourlyRate('')
      setNightRate('')
      setDayRate('')
      setMonthRate('')
      onCreated()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <Eyebrow className="mb-3">Rate plans</Eyebrow>
      <ul className="mb-3 space-y-1.5">
        {ratePlans.map((plan) => (
          <li
            key={plan.id}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600"
          >
            <span className="font-mono font-semibold uppercase tracking-[0.1em] text-slate-800">
              {plan.vehicleType}
            </span>{' '}
            — hourly {plan.currency} {plan.hourlyRate}
            {plan.nightRate ? `, night ${plan.nightRate}` : ''}
            {plan.dayRate ? `, day ${plan.dayRate}` : ''}
            {plan.monthRate ? `, month ${plan.monthRate}` : ''}
          </li>
        ))}
        {ratePlans.length === 0 && (
          <li className="text-xs text-slate-400">No rate plans yet.</li>
        )}
      </ul>
      <form onSubmit={handleSubmit} className="space-y-2">
        <select
          value={vehicleType}
          onChange={(e) => setVehicleType(e.target.value as VehicleType)}
          className={field}
        >
          {VEHICLE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          required
          type="number"
          min="0"
          step="0.01"
          value={hourlyRate}
          onChange={(e) => setHourlyRate(e.target.value)}
          placeholder="Hourly rate (required)"
          className={field}
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={nightRate}
          onChange={(e) => setNightRate(e.target.value)}
          placeholder="Night rate (optional)"
          className={field}
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={dayRate}
          onChange={(e) => setDayRate(e.target.value)}
          placeholder="Day rate (optional)"
          className={field}
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={monthRate}
          onChange={(e) => setMonthRate(e.target.value)}
          placeholder="Month rate (optional)"
          className={field}
        />
        <button type="submit" disabled={submitting} className={`${btn.primary} w-full`}>
          Add rate plan
        </button>
      </form>
    </div>
  )
}
