import { useCallback, useRef } from 'react'
import {
  ROW_ANGLE_MAX_DEG,
  ROW_ANGLE_MIN_DEG,
  ROW_PARK_ANGLE_SNAPS,
} from '../../../components/FloorMap/spotDimensions'

const VB_W = 168
const VB_H = 108
const CENTER = { x: 16, y: 96 }
const RADIUS = 82
const SNAP_TOLERANCE_DEG = 2.5

function clampAngle(deg: number): number {
  return Math.min(ROW_ANGLE_MAX_DEG, Math.max(ROW_ANGLE_MIN_DEG, deg))
}

function snapAngle(deg: number): number {
  for (const snap of ROW_PARK_ANGLE_SNAPS) {
    if (Math.abs(deg - snap) <= SNAP_TOLERANCE_DEG) return snap
  }
  return deg
}

function pointOnArc(deg: number) {
  const rad = (deg * Math.PI) / 180
  return {
    x: CENTER.x + RADIUS * Math.cos(rad),
    y: CENTER.y - RADIUS * Math.sin(rad),
  }
}

/**
 * A quarter-circle protractor for the row tool's parking angle: the bottom bar
 * is the drive aisle, the tilted rectangle is a preview of the bay's nose-in
 * angle against it. Drag the handle or click a snap tick; the numeric field
 * next to it stays in sync for keyboard/precise entry. Angle is stall-to-aisle
 * degrees, clamped to [ROW_ANGLE_MIN_DEG, ROW_ANGLE_MAX_DEG] - see
 * spotDimensions.ts for why the geometry doesn't support shallower angles.
 */
export function RowAngleDial({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (deg: number) => void
  disabled?: boolean
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const angle = clampAngle(value)

  const angleFromClientPoint = useCallback((clientX: number, clientY: number): number => {
    const svg = svgRef.current
    if (!svg) return angle
    const rect = svg.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * VB_W
    const y = ((clientY - rect.top) / rect.height) * VB_H
    const dx = x - CENTER.x
    const dy = CENTER.y - y
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI
    return clampAngle(snapAngle(deg))
  }, [angle])

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (disabled) return
      event.currentTarget.setPointerCapture(event.pointerId)
      onChange(angleFromClientPoint(event.clientX, event.clientY))
    },
    [disabled, onChange, angleFromClientPoint],
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (disabled || event.buttons === 0) return
      onChange(angleFromClientPoint(event.clientX, event.clientY))
    },
    [disabled, onChange, angleFromClientPoint],
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (disabled) return
      const step = event.shiftKey ? 5 : 1
      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
        event.preventDefault()
        onChange(clampAngle(angle - step))
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
        event.preventDefault()
        onChange(clampAngle(angle + step))
      }
    },
    [disabled, onChange, angle],
  )

  const handlePos = pointOnArc(angle)
  const arcStart = pointOnArc(ROW_ANGLE_MIN_DEG)
  const arcEnd = pointOnArc(ROW_ANGLE_MAX_DEG)
  const bayTilt = angle - 90

  return (
    <div className="flex items-center gap-3">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className={`h-24 w-[8.4rem] shrink-0 touch-none ${disabled ? 'opacity-50' : 'cursor-pointer'}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
      >
        {/* Drive aisle */}
        <rect x={0} y={CENTER.y} width={VB_W} height={6} fill="#CBD5E1" />
        <line
          x1={0}
          y1={CENTER.y + 3}
          x2={VB_W}
          y2={CENTER.y + 3}
          stroke="#94A3B8"
          strokeWidth={1}
          strokeDasharray="3 3"
        />

        {/* Protractor arc + snap ticks */}
        <path
          d={`M ${arcStart.x} ${arcStart.y} A ${RADIUS} ${RADIUS} 0 0 0 ${arcEnd.x} ${arcEnd.y}`}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth={2}
        />
        {ROW_PARK_ANGLE_SNAPS.map((snap) => {
          const p = pointOnArc(snap)
          const isActive = snap === angle
          return (
            <circle
              key={snap}
              cx={p.x}
              cy={p.y}
              r={isActive ? 0 : 2}
              fill="#94A3B8"
              className="pointer-events-none"
            />
          )
        })}

        {/* Bay preview, tilted against the aisle */}
        <g transform={`translate(${CENTER.x}, ${CENTER.y}) rotate(${bayTilt})`} className="pointer-events-none">
          <rect x={-9} y={-64} width={18} height={34} rx={2} fill="#EFF6FF" stroke="#2563EB" strokeWidth={2} />
        </g>

        {/* Radius + handle */}
        <line x1={CENTER.x} y1={CENTER.y} x2={handlePos.x} y2={handlePos.y} stroke="#2563EB" strokeWidth={1.5} className="pointer-events-none" />
        <circle
          cx={handlePos.x}
          cy={handlePos.y}
          r={7}
          fill="#2563EB"
          stroke="#fff"
          strokeWidth={2}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label="Parking angle"
          aria-valuemin={ROW_ANGLE_MIN_DEG}
          aria-valuemax={ROW_ANGLE_MAX_DEG}
          aria-valuenow={angle}
          aria-valuetext={`${angle} degrees`}
          onKeyDown={handleKeyDown}
          className="cursor-grab focus:outline-none focus-visible:stroke-blue-300 active:cursor-grabbing"
        />
      </svg>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            aria-label="Parking angle, degrees to the aisle"
            min={ROW_ANGLE_MIN_DEG}
            max={ROW_ANGLE_MAX_DEG}
            step={1}
            value={angle}
            disabled={disabled}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (!Number.isNaN(n)) onChange(clampAngle(n))
            }}
            className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm font-semibold text-slate-900 disabled:bg-slate-50"
          />
          <span className="text-sm text-slate-400">&deg; to the aisle</span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {ROW_PARK_ANGLE_SNAPS.map((snap) => (
            <button
              key={snap}
              type="button"
              disabled={disabled}
              onClick={() => onChange(snap)}
              className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold transition-colors ${
                snap === angle
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
              }`}
            >
              {snap}&deg;
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
