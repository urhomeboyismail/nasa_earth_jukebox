import { act, renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnnouncerContext } from '../../components/announcerContext'
import { publishDataEvents, type DataEvent } from './dataEvents'
import { MascotGuideProvider } from './MascotGuideProvider'
import { ALERT_MS, useDataAlerts } from './useDataAlerts'
import { useMascotGuideState } from './useMascotGuide'

const announce = vi.fn()
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(AnnouncerContext.Provider, { value: announce }, createElement(MascotGuideProvider, null, children))

const appeared: DataEvent = { kind: 'appeared', sentence: 'A new warm area appeared in the north-east.' }
const moved: DataEvent = { kind: 'moved', sentence: 'The warm area moved north.' }

function setup(enabled = true) {
  return renderHook(() => { useDataAlerts(enabled); return useMascotGuideState().tip }, { wrapper })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
  announce.mockClear()
})
afterEach(() => vi.useRealTimers())

describe('useDataAlerts', () => {
  it('offers an alert tip with the sentence of a notable event', () => {
    const { result } = setup()
    act(() => publishDataEvents([appeared]))
    expect(result.current).toEqual({ text: appeared.sentence, mood: 'alert' })
  })

  it('offers nothing for an event that is not notable, or for a frame with no events', () => {
    const { result } = setup()
    act(() => publishDataEvents([moved]))
    expect(result.current).toBeNull()
    act(() => publishDataEvents([]))
    expect(result.current).toBeNull()
  })

  it('gives one alert for two notable events 2 s apart, and two for events 6 s apart', () => {
    const { result } = setup()
    act(() => publishDataEvents([appeared]))
    // 2 s after the first: still inside the 5 s gap, so the first alert stands
    vi.setSystemTime(2000)
    act(() => publishDataEvents([{ kind: 'grew', sentence: 'The warm area in the north grew.' }]))
    expect(result.current?.text).toBe(appeared.sentence)
    vi.setSystemTime(6000)
    act(() => publishDataEvents([{ kind: 'shrank', sentence: 'The warm area in the south shrank.' }]))
    expect(result.current).toEqual({ text: 'The warm area in the south shrank.', mood: 'alert' })
  })

  it('clears the alert after 3 s', () => {
    const { result } = setup()
    act(() => publishDataEvents([appeared]))
    act(() => { vi.advanceTimersByTime(ALERT_MS - 1) })
    expect(result.current).not.toBeNull()
    act(() => { vi.advanceTimersByTime(1) })
    expect(result.current).toBeNull()
  })

  it('clears the alert when the next frame has no notable event', () => {
    const { result } = setup()
    act(() => publishDataEvents([appeared]))
    act(() => publishDataEvents([moved]))
    expect(result.current).toBeNull()
  })

  it('does nothing while disabled, and never announces', () => {
    const { result } = setup(false)
    act(() => publishDataEvents([appeared]))
    expect(result.current).toBeNull()
    const on = setup()
    act(() => publishDataEvents([appeared]))
    expect(on.result.current).not.toBeNull()
    expect(announce).not.toHaveBeenCalled()
  })
})
