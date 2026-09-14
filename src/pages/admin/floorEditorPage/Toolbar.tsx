import { useState } from 'react'
import type { EditorTool } from '../../../components/FloorMap/useFloorPlanEditor'
import type { UndoStackBag } from '../useUndoStack'
import { TOOLS, TOOL_HINT } from './constants'

export function ToolStrip({
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

export function ToolHint({ tool }: { tool: EditorTool }) {
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

export function SelectHandle({
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
