import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import type { Visualization } from '../../data'
import { isVibrationSupported, MAX_PULSE_MS, MIN_PULSE_MS, MISSING_PATTERN, patternFor, useVibrationSetting, vibrateForDate } from './vibration'

const mapping = (fixture as Visualization).mapping

let vibrate: ReturnType<typeof vi.fn>
function support(on: boolean) {
  if (on) {
    vibrate = vi.fn(() => true)
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
  } else {
    Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true })
  }
}

beforeEach(() => { window.localStorage.clear() })
afterEach(() => { support(false) })

describe('patternFor', () => {
  it('gives the coolest category the shortest pulse and the warmest the longest', () => {
    expect(patternFor('cold', mapping)).toEqual([MIN_PULSE_MS])
    expect(patternFor('hot', mapping)).toEqual([MAX_PULSE_MS])
  })

  it('makes each warmer category longer than the one before it', () => {
    const lengths = mapping.categories.map(c => patternFor(c.id, mapping)[0])
    expect(lengths).toEqual([...lengths].sort((a, b) => a - b))
    expect(new Set(lengths).size).toBe(lengths.length)
  })

  it('gives missing data two taps, unlike any category', () => {
    expect(patternFor('insufficient', mapping)).toEqual(MISSING_PATTERN)
    expect(MISSING_PATTERN.length).toBeGreaterThan(1)
  })

  it('gives nothing for a category it does not know, and copes with a single category', () => {
    expect(patternFor('lukewarm', mapping)).toEqual([])
    expect(patternFor('only', { ...mapping, categories: [mapping.categories[0]].map(c => ({ ...c, id: 'only' })) })).toEqual([MIN_PULSE_MS])
  })
})

describe('vibrateForDate', () => {
  it('asks the phone to vibrate with the category pattern', () => {
    support(true)
    expect(vibrateForDate('warm', mapping)).toBe(true)
    expect(vibrate).toHaveBeenCalledWith(patternFor('warm', mapping))
  })

  it('does nothing, without an error, where vibration is not supported', () => {
    support(false)
    expect(isVibrationSupported()).toBe(false)
    expect(vibrateForDate('warm', mapping)).toBe(false)
  })

  it('does nothing for no category or an unknown one', () => {
    support(true)
    expect(vibrateForDate(null, mapping)).toBe(false)
    expect(vibrateForDate('lukewarm', mapping)).toBe(false)
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('survives a phone that throws', () => {
    support(true)
    vibrate.mockImplementation(() => { throw new Error('blocked') })
    expect(vibrateForDate('cold', mapping)).toBe(false)
  })
})

describe('useVibrationSetting', () => {
  it('is off by default', () => {
    support(true)
    const { result } = renderHook(() => useVibrationSetting())
    expect(result.current).toMatchObject({ supported: true, enabled: false })
  })

  it('turns on, and is remembered on this device', () => {
    support(true)
    const first = renderHook(() => useVibrationSetting())
    act(() => first.result.current.setEnabled(true))
    expect(first.result.current.enabled).toBe(true)
    first.unmount()
    const second = renderHook(() => useVibrationSetting())
    expect(second.result.current.enabled).toBe(true)
  })

  it('stops a buzz that is still going when it is turned off', () => {
    support(true)
    const { result } = renderHook(() => useVibrationSetting())
    act(() => result.current.setEnabled(true))
    act(() => result.current.setEnabled(false))
    expect(vibrate).toHaveBeenLastCalledWith(0)
    expect(result.current.enabled).toBe(false)
  })

  it('reports unsupported, and stays off, even if it was saved as on', () => {
    window.localStorage.setItem('earth-jukebox:vibration', 'on')
    support(false)
    const { result } = renderHook(() => useVibrationSetting())
    expect(result.current).toMatchObject({ supported: false, enabled: false })
  })

  it('still works when storage is blocked', () => {
    support(true)
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const { result } = renderHook(() => useVibrationSetting())
    expect(result.current.enabled).toBe(false)
    act(() => result.current.setEnabled(true))
    expect(result.current.enabled).toBe(true)
    getItem.mockRestore()
    setItem.mockRestore()
  })
})
