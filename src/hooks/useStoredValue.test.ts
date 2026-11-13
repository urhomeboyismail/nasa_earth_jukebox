import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { forgetKeptValues, readStored, useStoredValue } from './useStoredValue'

const KEY = 'earth-jukebox:test-setting'
type Mode = 'a' | 'b'
const parseMode = (text: string): Mode => {
  if (text === 'a' || text === 'b') return text
  throw new Error('not a mode')
}

beforeEach(() => { localStorage.clear(); forgetKeptValues() })
afterEach(() => { vi.restoreAllMocks() })

describe('useStoredValue', () => {
  it('reads a stored value through parse', () => {
    localStorage.setItem(KEY, 'b')
    expect(renderHook(() => useStoredValue<Mode>(KEY, parseMode, 'a')).result.current[0]).toBe('b')
    expect(readStored<Mode>(KEY, parseMode, 'a')).toBe('b')
  })

  it('falls back when the value is missing', () => {
    expect(renderHook(() => useStoredValue<Mode>(KEY, parseMode, 'a')).result.current[0]).toBe('a')
  })

  it('falls back when parse throws', () => {
    localStorage.setItem(KEY, 'junk')
    expect(renderHook(() => useStoredValue<Mode>(KEY, parseMode, 'a')).result.current[0]).toBe('a')
    expect(readStored<Mode>(KEY, parseMode, 'a')).toBe('a')
  })

  it('writes a string as plain text and reads it back, here and in a second hook', () => {
    const one = renderHook(() => useStoredValue<Mode>(KEY, parseMode, 'a'))
    const two = renderHook(() => useStoredValue<Mode>(KEY, parseMode, 'a'))
    act(() => one.result.current[1]('b'))
    expect(localStorage.getItem(KEY)).toBe('b')
    expect(one.result.current[0]).toBe('b')
    expect(two.result.current[0]).toBe('b')
  })

  it('writes anything else as JSON', () => {
    const parseList = (text: string): number[] => JSON.parse(text) as number[]
    const { result } = renderHook(() => useStoredValue<number[]>(KEY, parseList, []))
    act(() => result.current[1]([1, 2]))
    expect(localStorage.getItem(KEY)).toBe('[1,2]')
    expect(result.current[0]).toEqual([1, 2])
  })

  it('forgets the key when serialize gives null', () => {
    localStorage.setItem(KEY, 'off')
    const parseOn = (text: string) => text !== 'off'
    const serializeOn = (on: boolean) => (on ? null : 'off')
    const { result } = renderHook(() => useStoredValue(KEY, parseOn, true, serializeOn))
    expect(result.current[0]).toBe(false)
    act(() => result.current[1](true))
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(result.current[0]).toBe(true)
  })

  it('still holds for this visit, on every page, when storage refuses to write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const { result } = renderHook(() => useStoredValue<Mode>(KEY, parseMode, 'a'))
    expect(() => act(() => result.current[1]('b'))).not.toThrow()
    expect(result.current[0]).toBe('b')
    expect(renderHook(() => useStoredValue<Mode>(KEY, parseMode, 'a')).result.current[0]).toBe('b')
  })

  it('gives the fallback when storage refuses to read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(renderHook(() => useStoredValue<Mode>(KEY, parseMode, 'a')).result.current[0]).toBe('a')
  })
})
