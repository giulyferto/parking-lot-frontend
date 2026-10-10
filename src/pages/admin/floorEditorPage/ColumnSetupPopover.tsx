import type { FloorPlanEditorBag } from '../../../components/FloorMap/useFloorPlanEditor'
import { Eyebrow } from '../../../components/ui'
import { btn, field } from '../../../components/styles'
import type { ColumnShape } from '../../../types'
import { columnSizeLabel } from './constants'
import { microLabel } from './styles'

const SHAPES: Array<[ColumnShape, string]> = [
  ['circle', 'Circular'],
  ['square', 'Square'],
]

export function ColumnShapePicker({
  value,
  onChange,
}: {
  value: ColumnShape
  onChange: (shape: ColumnShape) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {SHAPES.map(([shape, label]) => {
        const active = value === shape
        return (
          <button
            key={shape}
            type="button"
            onClick={() => onChange(shape)}
            aria-pressed={active}
            className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs font-semibold transition-colors ${
              active
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
              {shape === 'circle' ? (
                <circle cx="12" cy="12" r="8" fill="currentColor" />
              ) : (
                <rect x="4" y="4" width="16" height="16" fill="currentColor" />
              )}
            </svg>
            {label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * The column tool's setup - shape and size - asked up front as a popover
 * anchored to the toolbar button, like the parking row's RowSetupPopover.
 * Every column dropped afterwards uses it until it's changed.
 */
export function ColumnSetupPopover({
  editor,
  onClose,
}: {
  editor: FloorPlanEditorBag
  onClose: () => void
}) {
  const { columnSetup } = editor

  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} />
      <div className="absolute left-0 top-full z-30 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <Eyebrow>Set up the column</Eyebrow>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 text-sm text-slate-600">
          <div>
            <span className={microLabel}>Shape</span>
            <ColumnShapePicker
              value={columnSetup.shape}
              onChange={(shape) => editor.setColumnSetup({ shape })}
            />
          </div>

          <label className="block">
            <span className={microLabel}>{columnSizeLabel(columnSetup.shape)}</span>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={columnSetup.sizeM}
              onChange={(e) =>
                editor.setColumnSetup({ sizeM: e.target.value === '' ? 0 : Number(e.target.value) })
              }
              className={`${field} px-2 py-1.5`}
            />
          </label>
        </div>

        <button type="button" onClick={onClose} className={`${btn.primary} mt-4 w-full`}>
          Start placing →
        </button>
      </div>
    </>
  )
}
