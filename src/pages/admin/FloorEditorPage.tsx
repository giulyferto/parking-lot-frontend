import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getFloor } from '../../api/floors'
import { listSpots } from '../../api/spots'
import { listFloorElements } from '../../api/floorElements'
import { FloorMap } from '../../components/FloorMap/FloorMap'
import { useFloorPlanEditor, type EditorTool } from '../../components/FloorMap/useFloorPlanEditor'
import { useSpotRowTool } from '../../components/FloorMap/useSpotRowTool'
import { useUndoStack } from './useUndoStack'
import { AddSpotForm, SelectionPanel, SpotEditor } from './floorEditorPage/SpotPanels'
import { PlanScalePanel } from './floorEditorPage/PlanScalePanel'
import { SelectHandle, ToolHint, ToolStrip } from './floorEditorPage/Toolbar'
import { SpotRowPanel } from './floorEditorPage/SpotRowPanel'
import { useFloorElementActions } from './floorEditorPage/useFloorElementActions'
import { useSelectionActions } from './floorEditorPage/useSelectionActions'
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
  const [selectedElementIds, setSelectedElementIds] = useState<Set<string>>(() => new Set())
  const selectedElements = useMemo(
    () => elements.filter((e) => selectedElementIds.has(e.id)),
    [elements, selectedElementIds],
  )
  const selectionSize = selectedSpots.length + selectedElements.length

  const [gridStepM, setGridStepM] = useState(1)
  const [snapEnabled, setSnapEnabled] = useState(false)
  const [showGrid, setShowGrid] = useState(false)
  const [showScaleBar, setShowScaleBar] = useState(true)
  const [fitToken, setFitToken] = useState(0)
  const [setupOpen, setSetupOpen] = useState(false)

  const reload = useCallback(() => {
    if (!floorId) return
    getFloor(floorId).then(setFloor)
    listSpots(floorId).then(setSpots)
    listFloorElements(floorId).then(setElements)
  }, [floorId])

  useEffect(() => reload(), [reload])

  const undoStack = useUndoStack({ isBlocked: () => spotActions.spotRowBusyRef.current })

  const spotActions = useSpotActions({ floorId, spots, setSpots, undoStack, reload })
  const {
    handleDragEnd,
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
    setElements,
    undoStack,
    reload,
  })

  const { moveSelection, deleteSelection } = useSelectionActions({
    floorId,
    setSpots,
    setElements,
    undoStack,
    reload,
  })

  const editor = useFloorPlanEditor({
    elements,
    gridStepM: snapEnabled ? gridStepM : 0,
    snapEnabled,
    onCreate,
    onUpdate,
    onDelete,
    onRescale,
  })

  const clearSelection = useCallback(() => {
    setSelectedSpotIds(new Set())
    setSelectedElementIds(new Set())
  }, [])

  // The editor's single "being edited" element (vertex handles, style panel)
  // is separate from the multi-selection; a shift-click or shift-marquee folds
  // it into the multi-selection so it isn't silently dropped.
  const takeEditedElement = useCallback((): string | null => {
    const id = editor.selectedElementId
    if (id) editor.selectElement(null)
    return id
  }, [editor])

  const handleSpotClick = useCallback(
    (spot: Spot, event: MouseEvent) => {
      if (event.shiftKey || event.metaKey || event.ctrlKey) {
        const edited = takeEditedElement()
        if (edited) setSelectedElementIds((prev) => new Set(prev).add(edited))
        setSelectedSpotIds((prev) => toggled(prev, spot.id))
        return
      }
      editor.selectElement(null)
      setSelectedElementIds(new Set())
      setSelectedSpotIds(new Set([spot.id]))
    },
    [editor, takeEditedElement],
  )

  const handleElementClick = useCallback(
    (element: FloorElement, event: MouseEvent) => {
      if (event.shiftKey || event.metaKey || event.ctrlKey) {
        const edited = takeEditedElement()
        if (edited === element.id) return
        setSelectedElementIds((prev) => {
          const next = toggled(prev, element.id)
          if (edited) next.add(edited)
          return next
        })
        return
      }
      clearSelection()
      editor.selectElement(element.id)
    },
    [editor, takeEditedElement, clearSelection],
  )

  const handleMarqueeSelect = useCallback(
    (spotIds: string[], elementIds: string[], additive: boolean) => {
      if (!additive) {
        if (spotIds.length === 0 && elementIds.length === 1) {
          clearSelection()
          editor.selectElement(elementIds[0])
          return
        }
        editor.selectElement(null)
        setSelectedSpotIds(new Set(spotIds))
        setSelectedElementIds(new Set(elementIds))
        return
      }
      const edited = takeEditedElement()
      setSelectedSpotIds((prev) => new Set([...prev, ...spotIds]))
      setSelectedElementIds((prev) => new Set([...prev, ...elementIds, ...(edited ? [edited] : [])]))
    },
    [editor, takeEditedElement, clearSelection],
  )

  const handleSelectionDragEnd = useCallback(
    (dx: number, dy: number) => void moveSelection(selectedSpots, selectedElements, dx, dy),
    [moveSelection, selectedSpots, selectedElements],
  )

  const handleDeleteSelection = useCallback(() => {
    void deleteSelection(selectedSpots, selectedElements)
    clearSelection()
  }, [deleteSelection, selectedSpots, selectedElements, clearSelection])

  const setTool = useCallback(
    (t: EditorTool) => {
      editor.setTool(t)
      if (t !== 'select') clearSelection()
      setSetupOpen(false)
    },
    [editor, clearSelection],
  )

  useEffect(() => {
    if (editor.tool !== 'select' || editor.selectedElementId || selectionSize === 0) return
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (e.key === 'Escape') {
        clearSelection()
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        handleDeleteSelection()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editor.tool, editor.selectedElementId, selectionSize, clearSelection, handleDeleteSelection])

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
            editor={editor}
            setupOpen={setupOpen}
            onSetupOpenChange={setSetupOpen}
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
                  selectedElementIds={selectedElementIds}
                  showGrid={showGrid}
                  showScaleBar={showScaleBar}
                  gridStepM={gridStepM}
                  fitToken={fitToken}
                  editor={editor}
                  spotRowTool={spotRow}
                  onSpotClick={handleSpotClick}
                  onSpotDragEnd={handleDragEnd}
                  onElementClick={handleElementClick}
                  onSelectionDragEnd={handleSelectionDragEnd}
                  onMarqueeSelect={handleMarqueeSelect}
                  onCanvasClick={clearSelection}
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
              clearSelection()
              editor.selectElement(id)
            }}
          />
          <hr className="border-slate-100" />
          {editor.tool === 'spotRow' && (
            <>
              <SpotRowPanel
                tool={spotRow}
                onDone={() => setTool('select')}
                onEditSetup={() => setSetupOpen(true)}
              />
              <hr className="border-slate-100" />
            </>
          )}
          <AddSpotForm onCreate={handleCreateSpot} />
          <hr className="border-slate-100" />
          {selectedSpots.length === 1 && selectedElements.length === 0 ? (
            <SpotEditor
              key={selectedSpots[0].id}
              spot={selectedSpots[0]}
              onClose={clearSelection}
              onChanged={reload}
              pushUndo={undoStack.push}
            />
          ) : selectionSize > 0 ? (
            <SelectionPanel
              spots={selectedSpots}
              elements={selectedElements}
              onClose={clearSelection}
              onSetStatus={(status: SpotStatus) => handleSetStatusMany(selectedSpots, status)}
              onDelete={handleDeleteSelection}
            />
          ) : (
            <p className="text-sm text-slate-400">
              Click a bay to edit it - shift/cmd-click or drag a rectangle to select several bays,
              columns or walls.
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}

function toggled(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}
