import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readSoundStyle, useSoundStyle } from './style'

const KEY = 'earth-jukebox:sound-style'

beforeEach(() => { localStorage.clear() })
afterEach(() => { vi.restoreAllMocks() })

describe('sound style', () => {
  it('is the full sound until someone chooses otherwise', () => {
    expect(readSoundStyle()).toBe('full')
    expect(renderHook(() => useSoundStyle()).result.current[0]).toBe('full')
  })

  it('remembers the simple sound for next time', () => {
    const { result } = renderHook(() => useSoundStyle())
    act(() => result.current[1]('simple'))
    expect(result.current[0]).toBe('simple')
    expect(localStorage.getItem(KEY)).toBe('simple')
    expect(renderHook(() => useSoundStyle()).result.current[0]).toBe('simple')
  })

  it('can go back to the full sound', () => {
    localStorage.setItem(KEY, 'simple')
    const { result } = renderHook(() => useSoundStyle())
    expect(result.current[0]).toBe('simple')
    act(() => result.current[1]('full'))
    expect(result.current[0]).toBe('full')
    expect(readSoundStyle()).toBe('full')
  })

  it('ignores anything stored that is not a style', () => {
    localStorage.setItem(KEY, 'loud')
    expect(readSoundStyle()).toBe('full')
  })

  it('still works when storage is blocked, as in a private window', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const { result } = renderHook(() => useSoundStyle())
    expect(result.current[0]).toBe('full')
    act(() => result.current[1]('simple'))
    expect(result.current[0]).toBe('simple')
  })
})
