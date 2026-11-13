import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MARK_LIMIT, addMark, insertMark, removeMark, type Mark } from './marks'
import { MARKS_KEY, addStoredMark, getMarks, readMarks, removeStoredMark, removeStoredMarkLike, resetMarksStore, restoreStoredMark } from './store'

const mark = (n: number): Mark => ({ dataId: 'fixture', date: `2024-01-${String((n % 28) + 1).padStart(2, '0')}`, col: n, row: 1, at: `2026-11-13T09:00:${String(n % 60).padStart(2, '0')}.000Z` })

describe('marks (pure)', () => {
  it('adds a mark at the end and keeps only the newest 50', () => {
    let list: Mark[] = []
    for (let n = 0; n < MARK_LIMIT + 5; n++) list = addMark(list, mark(n))
    expect(list).toHaveLength(MARK_LIMIT)
    expect(list[0].col).toBe(5)
    expect(list[list.length - 1].col).toBe(MARK_LIMIT + 4)
  })

  it('removes by index, and leaves the list alone for an index that is not there', () => {
    const list = [mark(1), mark(2), mark(3)]
    expect(removeMark(list, 1).map(m => m.col)).toEqual([1, 3])
    expect(removeMark(list, 3)).toEqual(list)
    expect(removeMark(list, -1)).toEqual(list)
    expect(list).toHaveLength(3)
  })

  it('puts a removed mark back where it was', () => {
    const list = [mark(1), mark(3)]
    expect(insertMark(list, 1, mark(2)).map(m => m.col)).toEqual([1, 2, 3])
    expect(insertMark(list, 99, mark(4)).map(m => m.col)).toEqual([1, 3, 4])
  })
})

describe('marks (stored)', () => {
  beforeEach(() => { localStorage.clear(); resetMarksStore() })
  afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); resetMarksStore() })

  it('keeps marks across a reload', () => {
    addStoredMark(mark(1))
    addStoredMark(mark(2))
    resetMarksStore()
    expect(getMarks().map(m => m.col)).toEqual([1, 2])
  })

  it('drops a corrupt entry alone, not the whole list', () => {
    localStorage.setItem(MARKS_KEY, JSON.stringify([mark(1), { dataId: 'fixture', date: '2024-01-01', col: 'x', row: 1, at: 'now' }, null, 'nope', mark(2)]))
    expect(readMarks().map(m => m.col)).toEqual([1, 2])
  })

  it('reads a list that is not JSON, or not a list, as empty', () => {
    localStorage.setItem(MARKS_KEY, '{not json')
    expect(readMarks()).toEqual([])
    localStorage.setItem(MARKS_KEY, JSON.stringify({ a: 1 }))
    expect(readMarks()).toEqual([])
  })

  it('still works for this visit when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    addStoredMark(mark(1))
    expect(getMarks()).toHaveLength(1)
  })

  it('removes a mark and puts it back, and removes one by what it is', () => {
    addStoredMark(mark(1))
    addStoredMark(mark(2))
    const removed = removeStoredMark(0)
    expect(removed?.col).toBe(1)
    expect(getMarks().map(m => m.col)).toEqual([2])
    restoreStoredMark(0, mark(1))
    expect(getMarks().map(m => m.col)).toEqual([1, 2])
    removeStoredMarkLike(mark(2))
    expect(getMarks().map(m => m.col)).toEqual([1])
    expect(removeStoredMark(5)).toBeNull()
  })
})
