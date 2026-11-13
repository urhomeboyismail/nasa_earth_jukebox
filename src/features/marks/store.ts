// The marks on this device (ticket IX08): kept under one key, read with zod. A bad entry is dropped alone, never the whole list.
// A small store so the explorer's M handler and the panel see the same list without passing it through the player.

import { z } from 'zod'
import { addMark, insertMark, removeMark, sameMark, type Mark } from './marks'

export const MARKS_KEY = 'earth-jukebox:marks'

const markSchema = z.object({
  dataId: z.string().min(1),
  date: z.string().min(1),
  col: z.number().int().min(0),
  row: z.number().int().min(0),
  at: z.string().min(1),
})

/** The saved marks. A list that cannot be read is empty; an entry that cannot be read is skipped. */
export function readMarks(): Mark[] {
  try {
    const raw = localStorage.getItem(MARKS_KEY)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap(entry => {
      const result = markSchema.safeParse(entry)
      return result.success ? [result.data] : []
    })
  } catch {
    return []
  }
}

function writeMarks(marks: readonly Mark[]): void {
  try {
    localStorage.setItem(MARKS_KEY, JSON.stringify(marks))
  } catch {
    // Storage blocked or full: the marks stay for this visit only.
  }
}

let current: Mark[] | null = null
const listeners = new Set<() => void>()

/** The list; the same array until it changes (what useSyncExternalStore needs). */
export function getMarks(): Mark[] {
  if (current === null) current = readMarks()
  return current
}

export function subscribeMarks(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function set(next: Mark[]) {
  current = next
  writeMarks(next)
  listeners.forEach(listener => listener())
}

export const addStoredMark = (mark: Mark) => set(addMark(getMarks(), mark))

/** Removes the mark at `index` of the whole list and returns it, or null if there is none there. */
export function removeStoredMark(index: number): Mark | null {
  const marks = getMarks()
  const mark = marks[index]
  if (!mark) return null
  set(removeMark(marks, index))
  return mark
}

/** Removes this very mark (undo of M), wherever it now is. */
export function removeStoredMarkLike(mark: Mark): void {
  const index = getMarks().findIndex(entry => sameMark(entry, mark))
  if (index >= 0) removeStoredMark(index)
}

/** Puts a removed mark back at its place (undo of Remove). */
export const restoreStoredMark = (index: number, mark: Mark) => set(insertMark(getMarks(), index, mark))

/** For tests: forget the cached list so the next read comes from storage. */
export function resetMarksStore(): void {
  current = null
  listeners.forEach(listener => listener())
}
