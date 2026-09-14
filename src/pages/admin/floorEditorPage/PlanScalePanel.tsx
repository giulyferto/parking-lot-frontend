import { useState } from 'react'
import { ELEMENT_LABELS } from '../../../components/FloorMap/floorElementStyles'
import { geometrySummary, minVertices } from '../../../components/FloorMap/geometry'
import type { FloorPlanEditorBag } from '../../../components/FloorMap/useFloorPlanEditor'
import { Eyebrow } from '../../../components/ui'
import { btn, field } from '../../../components/styles'
import type { FloorElement } from '../../../types'
import { microLabel } from './styles'

export function PlanScalePanel({
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
  onSelectElement,
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
  onSelectElement: (id: string) => void
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
              onClick={() => onSelectElement(el.id)}
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
