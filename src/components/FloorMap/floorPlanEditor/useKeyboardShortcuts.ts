import { useEffect, type Dispatch, type SetStateAction } from 'react'
import type { DraftState, EditorTool } from './types'

export interface UseKeyboardShortcutsArgs {
  tool: EditorTool
  selectedElementId: string | null
  setSelectedElementId: Dispatch<SetStateAction<string | null>>
  draft: DraftState | null
  setDraft: Dispatch<SetStateAction<DraftState | null>>
  commitShape: (d: DraftState | null) => void
  onDelete: (id: string) => void
}

export function useKeyboardShortcuts(args: UseKeyboardShortcutsArgs) {
  const { tool, selectedElementId, setSelectedElementId, draft, setDraft, commitShape, onDelete } = args

  useEffect(() => {
    if (tool === 'select' && !selectedElementId && !draft) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDraft(null)
        setSelectedElementId(null)
      } else if (e.key === 'Enter' && draft?.mode === 'shape') {
        e.preventDefault()
        commitShape(draft)
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        if (draft?.mode === 'shape' && draft.vertices.length > 0) {
          e.preventDefault()
          setDraft({ ...draft, vertices: draft.vertices.slice(0, -1) })
        } else if (selectedElementId) {
          e.preventDefault()
          onDelete(selectedElementId)
          setSelectedElementId(null)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [tool, selectedElementId, setSelectedElementId, draft, setDraft, commitShape, onDelete])
}
