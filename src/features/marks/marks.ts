// Marks (ticket IX08): a place and a date the listener pressed M on. Pure list handling; the stored copy is in store.ts.

/** The date (as written in the data), the sound map's cell (both from 0) and when the mark was made (ISO text). */
export type Mark = { dataId: string; date: string; col: number; row: number; at: string }

/** The newest marks kept, across every data set. */
export const MARK_LIMIT = 50

/** Adds a mark at the end (the list is oldest first). Beyond MARK_LIMIT the oldest is dropped. */
export function addMark(marks: readonly Mark[], mark: Mark): Mark[] {
  return [...marks, mark].slice(-MARK_LIMIT)
}

/** The list without the mark at `index`. An index that is not in the list changes nothing. */
export function removeMark(marks: readonly Mark[], index: number): Mark[] {
  return Number.isInteger(index) && index >= 0 && index < marks.length ? marks.filter((_, i) => i !== index) : [...marks]
}

/** Puts a removed mark back where it was (or at the end if the list is shorter now), for undo. */
export function insertMark(marks: readonly Mark[], index: number, mark: Mark): Mark[] {
  const at = Math.min(Math.max(0, index), marks.length)
  return [...marks.slice(0, at), mark, ...marks.slice(at)].slice(-MARK_LIMIT)
}

export const sameMark = (a: Mark, b: Mark) => a.dataId === b.dataId && a.date === b.date && a.col === b.col && a.row === b.row && a.at === b.at
