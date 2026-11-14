import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeRecognition } from '../test/fakes'
import { useWakeWord } from './useWakeWord'

type Props = { enabled: boolean; paused: boolean }
const latest = () => FakeRecognition.instances.at(-1)

function setup(initial: Props, onWake = vi.fn()) {
  const view = renderHook((props: Props) => useWakeWord({ ...props, lang: 'en', onWake }), { initialProps: initial })
  return { ...view, onWake }
}

describe('useWakeWord', () => {
  beforeEach(() => { FakeRecognition.instances = []; vi.stubGlobal('webkitSpeechRecognition', FakeRecognition) })
  afterEach(() => vi.unstubAllGlobals())

  it('does nothing while it is off', () => {
    const { result } = setup({ enabled: false, paused: false })
    expect(result.current.state).toBe('off')
    expect(FakeRecognition.instances).toHaveLength(0)
  })

  it('says so where the browser cannot listen', () => {
    vi.unstubAllGlobals()
    const { result } = setup({ enabled: true, paused: false })
    expect(result.current.state).toBe('unsupported')
  })

  it('listens when on, wakes with the question, and stops while the guide is busy', () => {
    const { result, rerender, onWake } = setup({ enabled: true, paused: false })
    expect(result.current.state).toBe('listening')
    act(() => latest()!.say('hey echo which date was warmest'))
    expect(onWake).toHaveBeenCalledWith('which date was warmest')
    const first = latest()!
    rerender({ enabled: true, paused: true })
    expect(result.current.state).toBe('paused')
    expect(first.aborted).toBe(true)
    rerender({ enabled: true, paused: false })
    expect(FakeRecognition.instances).toHaveLength(2) // Listening again once the conversation is over.
  })

  it('stops on a refusal, and turning it on again asks again', () => {
    const { result, rerender } = setup({ enabled: true, paused: false })
    act(() => latest()!.fail('not-allowed'))
    expect(result.current).toEqual({ state: 'blocked', blocked: 'not-allowed' })
    rerender({ enabled: false, paused: false })
    rerender({ enabled: true, paused: false })
    expect(result.current.state).toBe('listening')
    expect(FakeRecognition.instances).toHaveLength(2)
  })

  it('waits for a first click or key before it opens the microphone', () => {
    vi.stubGlobal('navigator', { ...navigator, userActivation: { hasBeenActive: false, isActive: false } })
    const { result } = setup({ enabled: true, paused: false })
    expect(result.current.state).toBe('waiting')
    expect(FakeRecognition.instances).toHaveLength(0)
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' })) })
    expect(result.current.state).toBe('listening')
  })

  it('stops while the tab is hidden', () => {
    const { result } = setup({ enabled: true, paused: false })
    const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(result.current.state).toBe('paused')
    expect(latest()!.aborted).toBe(true)
    hidden.mockRestore()
  })
})
