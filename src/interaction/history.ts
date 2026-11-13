// Undo (ticket IX01): a stack of the last steps a listener took. Each handler that changes state records its own way back; `undoLast` runs the newest.

export const UNDO_LIMIT = 50

type Entry = { label: string; undo: () => void }

let stack: Entry[] = []

/** Remembers how to take back a step. The oldest step is forgotten beyond UNDO_LIMIT. */
export function recordUndo(label: string, undo: () => void): void {
  stack.push({ label, undo })
  if (stack.length > UNDO_LIMIT) stack.shift()
}

/** Runs the newest undo and returns its label, or null when there is nothing to undo. */
export function undoLast(): string | null {
  const entry = stack.pop()
  if (!entry) return null
  entry.undo()
  return entry.label
}

export const undoDepth = () => stack.length

/** For tests, and for a page that is left. */
export function resetUndo(): void {
  stack = []
}
