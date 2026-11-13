import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import type { Visualization } from '../../data'
import { readListenMode, useListenMode } from './listenMode'

const KEY = 'earth-jukebox:listen-mode'
const plain = fixture as Visualization

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('readListenMode', () => {
  it('opens a data set with a sonification block in Symphony, and any other in Simple', () => {
    expect(readListenMode(true)).toBe('symphony')
    expect(readListenMode(false)).toBe('simple')
  })

  it('lets a remembered choice win, either way', () => {
    localStorage.setItem(KEY, 'simple')
    expect(readListenMode(true)).toBe('simple')
    localStorage.setItem(KEY, 'symphony')
    expect(readListenMode(false)).toBe('symphony')
  })

  it('ignores a remembered value it does not know', () => {
    localStorage.setItem(KEY, 'karaoke')
    expect(readListenMode(true)).toBe('symphony')
    expect(readListenMode(false)).toBe('simple')
  })

  it('falls back to the default when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(readListenMode(true)).toBe('symphony')
  })
})

describe('useListenMode', () => {
  it('starts from the data set, changes, and remembers the change', () => {
    const { result } = renderHook(() => useListenMode(plain))
    expect(result.current[0]).toBe('simple')
    act(() => result.current[1]('symphony'))
    expect(result.current[0]).toBe('symphony')
    expect(localStorage.getItem(KEY)).toBe('symphony')
  })

  it('still changes for this visit when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const { result } = renderHook(() => useListenMode({ ...plain, sonification: { preset: 'major' } }))
    expect(result.current[0]).toBe('symphony')
    act(() => result.current[1]('simple'))
    expect(result.current[0]).toBe('simple')
  })
})
