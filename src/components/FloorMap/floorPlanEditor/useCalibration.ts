import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { distance, type Point } from '../geometry'
import type { DraftState, EditorTool } from './types'

export interface UseCalibrationArgs {
  draft: DraftState | null
  setDraft: Dispatch<SetStateAction<DraftState | null>>
  setToolState: Dispatch<SetStateAction<EditorTool>>
  onRescale: (factor: number) => void
}

/** The ruler-draft flow: draw two points, confirm a real-world length, rewrite the floor's scale. */
export function useCalibration(args: UseCalibrationArgs) {
  const { draft, setDraft, setToolState, onRescale } = args

  const moveRulerEnd = useCallback(
    (which: 0 | 1, world: Point) => {
      setDraft((prev) => {
        if (prev?.mode !== 'ruler') return prev
        const points: [Point, Point] = [prev.points[0], prev.points[1]]
        points[which] = world
        return { mode: 'ruler', points }
      })
    },
    [setDraft],
  )

  const rulerLengthM = draft?.mode === 'ruler' ? distance(draft.points[0], draft.points[1]) : null

  const commitCalibration = useCallback(
    (actualLengthM: number) => {
      if (draft?.mode !== 'ruler') return
      const drawn = distance(draft.points[0], draft.points[1])
      if (!drawn || !Number.isFinite(actualLengthM) || actualLengthM <= 0) return
      const factor = actualLengthM / drawn
      if (factor < 0.01 || factor > 100) {
        window.alert('That scale change is out of range (0.01x - 100x). Draw a longer ruler.')
        return
      }
      if (
        !window.confirm(
          `Rescale this floor by ${factor.toFixed(3)}x?\nThis rewrites every bay and plan element on the floor.`,
        )
      ) {
        return
      }
      onRescale(factor)
      setDraft(null)
      setToolState('select')
    },
    [draft, onRescale, setDraft, setToolState],
  )

  return { rulerLengthM, moveRulerEnd, commitCalibration }
}
