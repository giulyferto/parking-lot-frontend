import { aisleWidthForAngle } from '../../../components/FloorMap/spotDimensions'
import type { SpotRowToolBag } from '../../../components/FloorMap/useSpotRowTool'
import { Eyebrow } from '../../../components/ui'
import { btn, field } from '../../../components/styles'
import { microLabel, presetChip } from './styles'

export function SpotRowPanel({
  tool,
  onDone,
  onEditSetup,
}: {
  tool: SpotRowToolBag
  onDone: () => void
  onEditSetup: () => void
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
          the second click lands. Drag an endpoint afterwards to reposition the row.
        </p>
      )}

      <div className="mb-3 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <span>
          <span className="font-semibold text-slate-900">{params.angleDeg}&deg;</span>{' '}
          {params.vehicleType.toLowerCase()} · {params.stallWidthM}&times;{params.stallDepthM} m ·{' '}
          {aisleWidthForAngle(params.angleDeg)} m aisle
        </span>
        <button
          type="button"
          onClick={onEditSetup}
          className="shrink-0 font-semibold text-blue-600 hover:text-blue-700"
        >
          Change setup
        </button>
      </div>

      <div className="space-y-3 text-sm text-slate-600">
        {tool.phase !== 'idle' && (
          <>
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
          </>
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
