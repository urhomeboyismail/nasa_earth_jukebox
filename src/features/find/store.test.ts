import { afterEach, describe, expect, it, vi } from 'vitest'
import { FIND_KEY, bestKey, readFindRecord, saveResult } from './store'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('the find game record', () => {
  it('is empty when nothing is kept', () => {
    expect(readFindRecord()).toEqual({ best: {} })
  })

  it('round-trips a valid record', () => {
    saveResult(bestKey('fixture', 2), { score: 1500, seconds: 12.5 })
    expect(JSON.parse(localStorage.getItem(FIND_KEY)!)).toEqual({ best: { 'fixture:2': { score: 1500, seconds: 12.5 } } })
    expect(readFindRecord()).toEqual({ best: { 'fixture:2': { score: 1500, seconds: 12.5 } } })
  })

  it.each(['not json', '{"best":5}', '{"best":{"a:1":{"score":-1,"seconds":2}}}', '{"best":{"a:1":{"score":1.5,"seconds":2}}}', 'null'])('ignores a corrupt record: %s', raw => {
    localStorage.setItem(FIND_KEY, raw)
    expect(readFindRecord()).toEqual({ best: {} })
  })

  it('keeps the best: a higher score, or the same score in less time', () => {
    const key = bestKey('fixture', 1)
    expect(saveResult(key, { score: 800, seconds: 10 })).toEqual({ score: 800, seconds: 10 })
    expect(saveResult(key, { score: 700, seconds: 5 })).toEqual({ score: 800, seconds: 10 })
    expect(saveResult(key, { score: 800, seconds: 8 })).toEqual({ score: 800, seconds: 8 })
    expect(saveResult(key, { score: 900, seconds: 30 })).toEqual({ score: 900, seconds: 30 })
    expect(readFindRecord().best[key]).toEqual({ score: 900, seconds: 30 })
  })

  it('keeps each data set and level apart', () => {
    saveResult(bestKey('a', 1), { score: 100, seconds: 1 })
    saveResult(bestKey('a', 2), { score: 200, seconds: 2 })
    expect(Object.keys(readFindRecord().best).sort()).toEqual(['a:1', 'a:2'])
  })

  it('gives an empty record when storage is blocked, and still returns the result', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(readFindRecord()).toEqual({ best: {} })
    expect(saveResult('x:1', { score: 5, seconds: 1 })).toEqual({ score: 5, seconds: 1 })
  })
})
