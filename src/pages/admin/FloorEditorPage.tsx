import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getFloor } from '../../api/floors'
import { listSpots } from '../../api/spots'
import { listFloorElements } from '../../api/floorElements'
import { FloorMap } from '../../components/FloorMap/FloorMap'
import { useFloorPlanEditor, type EditorTool } from '../../components/FloorMap/useFloorPlanEditor'
import { useSpotRowTool } from '../../components/FloorMap/useSpotRowTool'
import { useUndoStack } from './useUndoStack'
import { AddSpotForm, MultiSpotPanel, SpotEditor } from './floorEditorPage/SpotPanels'
import { PlanScalePanel } from './floorEditorPage/PlanScalePanel'
import { SelectHandle, ToolHint, ToolStrip } from './floorEditorPage/Toolbar'
import { SpotRowPanel } from './floorEditorPage/SpotRowPanel'
import { useFloorElementActions } from './floorEditorPage/useFloorElementActions'
import { useSpotActions } from './floorEditorPage/useSpotActions'
import type { Floor, FloorElement, Spot, SpotStatus } from '../../types'

export function FloorEditorPage() {
  const { floorId } = useParams<{ floorId: string }>()
  const [floor, setFloor] = useState<Floor | null>(null)
  const [spots, setSpots] = useState<Spot[]>([])
  const [elements, setElements] = useState<FloorElement[]>([])
  const [selectedSpotIds, setSelectedSpotIds] = useState<Set<string>>(() => new Set())
  const selectedSpots = useMemo(
    () => spots.filter((s) => selectedSpotIds.has(s.id)),
    [spots, selectedSpotIds],
  )

  const [gridStepM, setGridStepM] = useState(1)
  const [snapEnabled, setSnapEnabled] = useState(false)
  const [showGrid, setShowGrid] = useState(false)
  const [showScaleBar, setShowScaleBar] = useState(true)
  const [fitToken, setFitToken] = useState(0)
  const [rowSetupOpen, setRowSetupOpen] = useState(false)

  const reload = useCallback(() => {
    if (!floorId) return
    getFloor(floorId).then(setFloor)
    listSpots(floorId).then(setSpots)
    listFloorElements(floorId).then(setElements)
  }, [floorId])

  useEffect(() => reload(), [reload])

  const undoStack = useUndoStack({ isBlocked: () => spotActions.spotRowBusyRef.current })

  const spotActions = useSpotActions({ floorId, spots, undoStack, reload })
  const {
    handleDragEnd,
    handleGroupDragEnd,
    handleDeleteMany,
    handleSetStatusMany,
    handleCreateSpot,
    handleCommitRow,
    spotRowBusyRef,
    spotRowResetRef,
    spotRowPhaseRef,
  } = spotActions

  const { onCreate, onUpdate, onDelete, onRescale } = useFloorElementActions({
    floorId,
    elements,
    undoStack,
    reload,
  })

  const handleSpotClick = useCallback((spot: Spot, event: MouseEvent) => {
    const additive = event.shiftKey || event.metaKey || event.ctrlKey
    setSelectedSpotIds((prev) => {
      if (additive) {
        const next = new Set(prev)
        if (next.has(spot.id)) next.delete(spot.id)
        else next.add(spot.id)
        return next
      }
      return new Set([spot.id])
    })
  }, [])

  const handleMarqueeSelect = useCallback((ids: string[], additive: boolean) => {
    setSelectedSpotIds((prev) => {
      if (!additive) return new Set(ids)
      const next = new Set(prev)
      for (const id of ids) next.add(id)
      return next
    })
  }, [])

  const editor = useFloorPlanEditor({
    elements,
    gridStepM: snapEnabled ? gridStepM : 0,
    snapEnabled,
    onCreate,
    onUpdate,
    onDelete,
    onRescale,
  })

  const setTool = useCallback(
    (t: EditorTool) => {
      editor.setTool(t)
      if (t !== 'select') setSelectedSpotIds(new Set())
      if (t !== 'spotRow') setRowSetupOpen(false)
    },
    [editor],
  )

  useEffect(() => {
    if (editor.tool !== 'select' || editor.selectedElementId || selectedSpotIds.size === 0) return
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (e.key === 'Escape') {
        setSelectedSpotIds(new Set())
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        void handleDeleteMany(selectedSpots)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editor.tool, editor.selectedElementId, selectedSpotIds, selectedSpots, handleDeleteMany])

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
  }, [spotRow.busy, spotRowBusyRef])

  useEffect(() => {
    spotRowResetRef.current = spotRow.resetSession
  }, [spotRow.resetSession, spotRowResetRef])

  useEffect(() => {
    spotRowPhaseRef.current = spotRow.phase
  }, [spotRow.phase, spotRowPhaseRef])

  const boundaryExists = useMemo(() => elements.some((e) => e.kind === 'BOUNDARY'), [elements])

  if (!floor) {
    return <div className="px-6 py-6 font-mono text-xs uppercase tracking-[0.16em] text-slate-400">Loading…</div>
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div>
          <Link
            to={`/admin/parking-lots/${floor.parkingLotId}`}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            ← Back to floors
          </Link>
          <h1 className="mt-0.5 font-display text-xl font-semibold tracking-tight text-slate-900">
            {floor.name}
            <span className="ml-2 font-mono text-xs uppercase tracking-[0.16em] text-slate-400">
              Plan &amp; layout
            </span>
          </h1>
        </div>
        <Link
          to={`/admin/floors/${floor.id}/rates`}
          className="mt-0.5 shrink-0 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          Rate plans →
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
        <div className="flex min-h-[55vh] min-w-0 flex-col gap-2 p-4 md:min-h-0 md:flex-1 sm:p-6">
          <ToolStrip
            tool={editor.tool}
            onPick={setTool}
            onFit={() => setFitToken((n) => n + 1)}
            boundaryExists={boundaryExists}
            undoStack={undoStack}
            rowBusy={spotRow.busy}
            spotRow={spotRow}
            rowSetupOpen={rowSetupOpen}
            onRowSetupOpenChange={setRowSetupOpen}
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
                  selectedSpotIds={selectedSpotIds}
                  showGrid={showGrid}
                  showScaleBar={showScaleBar}
                  gridStepM={gridStepM}
                  fitToken={fitToken}
                  editor={editor}
                  spotRowTool={spotRow}
                  onSpotClick={handleSpotClick}
                  onSpotDragEnd={handleDragEnd}
                  onSpotGroupDragEnd={handleGroupDragEnd}
                  onMarqueeSelect={handleMarqueeSelect}
                  onCanvasClick={() => setSelectedSpotIds(new Set())}
                />
                <SelectHandle
                  active={editor.tool === 'select'}
                  editing={editor.tool === 'select' && editor.selectedElementId != null}
                  onClick={() => setTool('select')}
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
            onSelectElement={(id) => {
              setTool('select')
              setSelectedSpotIds(new Set())
              editor.selectElement(id)
            }}
          />
          <hr className="border-slate-100" />
          {editor.tool === 'spotRow' && (
            <>
              <SpotRowPanel
                tool={spotRow}
                onDone={() => setTool('select')}
                onEditSetup={() => setRowSetupOpen(true)}
              />
              <hr className="border-slate-100" />
            </>
          )}
          <AddSpotForm onCreate={handleCreateSpot} />
          <hr className="border-slate-100" />
          {selectedSpots.length === 1 ? (
            <SpotEditor
              key={selectedSpots[0].id}
              spot={selectedSpots[0]}
              onClose={() => setSelectedSpotIds(new Set())}
              onChanged={reload}
              pushUndo={undoStack.push}
            />
          ) : selectedSpots.length > 1 ? (
            <MultiSpotPanel
              spots={selectedSpots}
              onClose={() => setSelectedSpotIds(new Set())}
              onSetStatus={(status: SpotStatus) => handleSetStatusMany(selectedSpots, status)}
              onDelete={() => handleDeleteMany(selectedSpots)}
            />
          ) : (
            <p className="text-sm text-slate-400">
              Click a bay to edit it - shift/cmd-click or drag a rectangle to select several.
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}
