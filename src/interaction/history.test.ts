import { afterEach, describe, expect, it } from 'vitest'
import { UNDO_LIMIT, recordUndo, resetUndo, undoDepth, undoLast } from './history'

afterEach(resetUndo)

describe('undo history', () => {
  it('undoes the newest step first and returns its label', () => {
    const log: string[] = []
    recordUndo('one', () => log.push('one'))
    recordUndo('two', () => log.push('two'))
    expect(undoLast()).toBe('two')
    expect(undoLast()).toBe('one')
    expect(log).toEqual(['two', 'one'])
  })

  it('returns null when there is nothing to undo', () => {
    expect(undoLast()).toBeNull()
  })

  it(`keeps at most ${UNDO_LIMIT} steps, forgetting the oldest`, () => {
    const undone: number[] = []
    for (let i = 0; i < UNDO_LIMIT + 5; i++) recordUndo(`step ${i}`, () => undone.push(i))
    expect(undoDepth()).toBe(UNDO_LIMIT)
    while (undoLast() !== null) continue
    expect(undone).toHaveLength(UNDO_LIMIT)
    expect(undone[undone.length - 1]).toBe(5)
  })
})
