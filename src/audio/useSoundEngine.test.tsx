import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../public/data/fixture/manifest.json'
import type { Visualization } from '../data'
import { useSoundEngine } from './useSoundEngine'

const mapping = (fixture as Visualization).mapping
const createSoundEngine = vi.hoisted(() => vi.fn())
vi.mock('.', () => ({ createSoundEngine }))

beforeEach(() => { createSoundEngine.mockReset() })

describe('useSoundEngine', () => {
  it('returns the engine when it can be made', () => {
    const made = { stop: vi.fn() }
    createSoundEngine.mockReturnValue(made)
    const { result } = renderHook(() => useSoundEngine(mapping))
    expect(result.current).toEqual({ engine: made, engineError: '' })
    expect(createSoundEngine).toHaveBeenCalledWith(mapping)
  })

  it('returns the message, and no engine, when making it throws', () => {
    createSoundEngine.mockImplementation(() => { throw new Error('No audio here') })
    const { result } = renderHook(() => useSoundEngine(mapping))
    expect(result.current).toEqual({ engine: null, engineError: 'No audio here' })
  })

  it('turns a thrown non-error into text', () => {
    createSoundEngine.mockImplementation(() => { throw 'nope' }) // eslint-disable-line no-throw-literal
    expect(renderHook(() => useSoundEngine(mapping)).result.current.engineError).toBe('nope')
  })

  it('makes the engine once across re-renders', () => {
    createSoundEngine.mockReturnValue({})
    const { result, rerender } = renderHook(() => useSoundEngine(mapping))
    const first = result.current.engine
    rerender()
    rerender()
    expect(result.current.engine).toBe(first)
    expect(createSoundEngine).toHaveBeenCalledTimes(1)
  })

  it('makes none while there is no mapping yet, and no error', () => {
    const { result } = renderHook(() => useSoundEngine(undefined))
    expect(result.current).toEqual({ engine: null, engineError: '' })
    expect(createSoundEngine).not.toHaveBeenCalled()
  })
})
