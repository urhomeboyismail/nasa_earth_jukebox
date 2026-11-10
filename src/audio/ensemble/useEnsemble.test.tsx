import { act, renderHook } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PRESETS } from '../../sonify/presets'
import type { DetailLevel, Preset } from '../../sonify/types'
import { resetTone, start } from './toneMock'
import { useEnsemble } from './useEnsemble'

vi.mock('tone', async () => (await import('./toneMock')).toneModule)

beforeEach(resetTone)

/** Lets the hook's deferred disposal run. */
const flush = () => act(async () => { await Promise.resolve() })

function mount(preset: Preset = PRESETS.major, detail: DetailLevel = 'full', strict = false) {
  return renderHook(({ preset: p, detail: d }) => useEnsemble(p, d), { initialProps: { preset, detail }, ...(strict && { wrapper: StrictMode }) })
}

describe('useEnsemble', () => {
  it('makes one ensemble, off, that does not touch the audio until start()', () => {
    const { result } = mount()
    expect(result.current.status).toBe('off')
    expect(start).not.toHaveBeenCalled()
    expect(typeof result.current.ensemble.apply).toBe('function')
  })

  it('keeps the same ensemble across renders', () => {
    const { result, rerender } = mount()
    const first = result.current.ensemble
    rerender({ preset: PRESETS.major, detail: 'full' })
    rerender({ preset: PRESETS.major, detail: 'calm' })
    expect(result.current.ensemble).toBe(first)
  })

  it('follows the status as the sound starts, pauses and stops, without a state update in an effect', async () => {
    const { result } = mount()
    await act(async () => { await result.current.start() })
    expect(result.current.status).toBe('on')
    act(() => result.current.ensemble.pause())
    expect(result.current.status).toBe('paused')
    act(() => result.current.ensemble.resume())
    expect(result.current.status).toBe('on')
    act(() => result.current.ensemble.stop())
    expect(result.current.status).toBe('off')
  })

  it('passes the detail level on, and again when it changes', () => {
    const { result, rerender } = mount(PRESETS.major, 'standard')
    const setDetail = vi.spyOn(result.current.ensemble, 'setDetail')
    rerender({ preset: PRESETS.major, detail: 'calm' })
    expect(setDetail).toHaveBeenCalledWith('calm')
  })

  it('disposes the ensemble when the component goes away', async () => {
    const { result, unmount } = mount()
    const dispose = vi.spyOn(result.current.ensemble, 'dispose')
    unmount()
    expect(dispose).not.toHaveBeenCalled()
    await flush()
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('makes a new ensemble for a new preset and disposes the old one', async () => {
    const { result, rerender } = mount(PRESETS.major)
    const old = result.current.ensemble
    const dispose = vi.spyOn(old, 'dispose')
    rerender({ preset: PRESETS.dorian, detail: 'full' })
    await flush()
    expect(result.current.ensemble).not.toBe(old)
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('survives StrictMode mounting, unmounting and mounting again: the ensemble still works', async () => {
    const { result, unmount } = mount(PRESETS.major, 'full', true)
    await flush()
    await act(async () => { await result.current.start() })
    expect(result.current.status).toBe('on')
    unmount()
    await flush()
    expect(result.current.ensemble.status()).toBe('off')
  })
})
