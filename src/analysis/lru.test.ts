import { describe, expect, it } from 'vitest'
import { createLru } from './lru'

describe('createLru', () => {
  it('evicts the least recently used entry when a set goes past the limit', () => {
    const lru = createLru<number>(2)
    lru.set('a', 1)
    lru.set('b', 2)
    lru.set('c', 3)
    expect(lru.get('a')).toBeUndefined()
    expect(lru.get('b')).toBe(2)
    expect(lru.get('c')).toBe(3)
  })

  it('refreshes an entry when it is read', () => {
    const lru = createLru<number>(2)
    lru.set('a', 1)
    lru.set('b', 2)
    lru.get('a')
    lru.set('c', 3)
    expect(lru.get('a')).toBe(1)
    expect(lru.get('b')).toBeUndefined()
  })

  it('never holds more than the limit, and setting a key again does not grow it', () => {
    const lru = createLru<number>(3)
    for (let i = 0; i < 20; i++) lru.set(`k${i}`, i)
    expect(lru.size).toBe(3)
    lru.set('k19', 99)
    expect(lru.size).toBe(3)
    expect(lru.get('k19')).toBe(99)
  })

  it('deletes an entry', () => {
    const lru = createLru<number>(2)
    lru.set('a', 1)
    lru.delete('a')
    expect(lru.size).toBe(0)
    expect(lru.get('a')).toBeUndefined()
  })
})
