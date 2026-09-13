import { useCallback, useEffect, useRef, useState } from 'react'

export interface UndoCommand {
  undo: () => Promise<void>
  redo: () => Promise<void>
}

export interface UndoStackBag {
  canUndo: boolean
  canRedo: boolean
  busy: boolean
  push: (command: UndoCommand) => void
  undo: () => void
  redo: () => void
}

/**
 * Generic undo/redo command stack for the plan editor. Every entry is a
 * persisted action's inverse pair (see FloorEditorPage's handlers) - there's
 * no client-only draft state here, each undo/redo re-issues real API calls,
 * so entries run one at a time (`busy`) and the stacks live in refs rather
 * than state to avoid StrictMode's double-invoked updater re-running an API
 * call. `canUndo`/`canRedo` mirror the stack lengths into plain state
 * (updated wherever the refs change) so render never reads a ref directly.
 * Wired to Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z; `isBlocked()` (checked fresh on
 * every keypress, e.g. while the parking-row tool has an in-flight edit of
 * its own) suspends the shortcut without discarding the stacks.
 */
export function useUndoStack(options: { isBlocked?: () => boolean } = {}): UndoStackBag {
  const { isBlocked } = options
  const isBlockedRef = useRef(isBlocked)
  useEffect(() => {
    isBlockedRef.current = isBlocked
  }, [isBlocked])

  const undoRef = useRef<UndoCommand[]>([])
  const redoRef = useRef<UndoCommand[]>([])
  const busyRef = useRef(false)
  const [counts, setCounts] = useState({ undo: 0, redo: 0 })
  const [busy, setBusy] = useState(false)

  const push = useCallback((command: UndoCommand) => {
    undoRef.current = [...undoRef.current, command]
    redoRef.current = []
    setCounts({ undo: undoRef.current.length, redo: 0 })
  }, [])

  const run = useCallback((command: UndoCommand, direction: 'undo' | 'redo') => {
    busyRef.current = true
    setBusy(true)
    const from = direction === 'undo' ? undoRef : redoRef
    const to = direction === 'undo' ? redoRef : undoRef
    from.current = from.current.slice(0, -1)
    setCounts({ undo: undoRef.current.length, redo: redoRef.current.length })
    ;(direction === 'undo' ? command.undo() : command.redo())
      .then(() => {
        to.current = [...to.current, command]
      })
      .catch((err) => {
        console.error(`Failed to ${direction}`, err)
        from.current = [...from.current, command]
      })
      .finally(() => {
        busyRef.current = false
        setBusy(false)
        setCounts({ undo: undoRef.current.length, redo: redoRef.current.length })
      })
  }, [])

  const undo = useCallback(() => {
    if (busyRef.current || undoRef.current.length === 0) return
    run(undoRef.current[undoRef.current.length - 1], 'undo')
  }, [run])

  const redo = useCallback(() => {
    if (busyRef.current || redoRef.current.length === 0) return
    run(redoRef.current[redoRef.current.length - 1], 'redo')
  }, [run])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isBlockedRef.current?.()) return
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])

  return {
    canUndo: counts.undo > 0,
    canRedo: counts.redo > 0,
    busy,
    push,
    undo,
    redo,
  }
}
