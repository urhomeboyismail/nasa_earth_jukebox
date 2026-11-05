import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readDescriptionDetail, useDescriptionDetail } from './detail'

afterEach(() => { localStorage.clear(); vi.restoreAllMocks() })

describe('useDescriptionDetail', () => {
  it('is rich until the listener chooses', () => {
    expect(renderHook(() => useDescriptionDetail()).result.current[0]).toBe('rich')
  })

  it('remembers the choice on this device, under earth-jukebox:detail', () => {
    const { result } = renderHook(() => useDescriptionDetail())
    act(() => result.current[1]('concise'))
    expect(result.current[0]).toBe('concise')
    expect(localStorage.getItem('earth-jukebox:detail')).toBe('concise')
    expect(renderHook(() => useDescriptionDetail()).result.current[0]).toBe('concise')
  })

  it('ignores a stored value it does not know', () => {
    localStorage.setItem('earth-jukebox:detail', 'loud')
    expect(readDescriptionDetail()).toBe('rich')
  })

  it('changes every place that uses it at once', () => {
    const one = renderHook(() => useDescriptionDetail())
    const two = renderHook(() => useDescriptionDetail())
    act(() => one.result.current[1]('concise'))
    expect(two.result.current[0]).toBe('concise')
    act(() => two.result.current[1]('rich'))
    expect(one.result.current[0]).toBe('rich')
  })

  it('still holds for this visit when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const { result } = renderHook(() => useDescriptionDetail())
    expect(() => act(() => result.current[1]('concise'))).not.toThrow()
    expect(result.current[0]).toBe('concise')
  })
})
