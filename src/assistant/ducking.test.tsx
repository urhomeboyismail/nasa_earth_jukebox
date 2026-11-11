import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DUCK_ATTACK_S, DUCK_LINEAR, DUCK_RELEASE_S, duck } from '../audio/duck'
import { onPlayerCommand, type PlayerCommand } from '../features/player/controls'
import type { AssistantStatus } from '../hooks/useVoiceAssistant'
import { useDucking } from './ducking'

let sent: PlayerCommand[]
let heard: [number, number][]
let unsubscribe: () => void
let stopPlayerCommands: () => void

beforeEach(() => {
  vi.useFakeTimers()
  duck.reset()
  sent = []
  heard = []
  stopPlayerCommands = onPlayerCommand(command => sent.push(command))
  unsubscribe = duck.subscribe((gain, rampS) => heard.push([gain, rampS]))
  heard.length = 0
})
afterEach(() => {
  unsubscribe()
  stopPlayerCommands()
  duck.reset()
  vi.useRealTimers()
})

function setup(first: AssistantStatus) {
  return renderHook(({ status }) => useDucking(status), { initialProps: { status: first } })
}

describe('ducking the music for the voice guide', () => {
  it('does nothing while the guide is closed, connecting or has ended', () => {
    const { rerender } = setup('idle')
    for (const status of ['connecting', 'ended', 'error', 'idle'] as AssistantStatus[]) rerender({ status })
    expect(heard).toEqual([])
    expect(duck.target()).toBe(1)
  })

  it('ducks when the guide speaks, and sends no pause', () => {
    const { rerender } = setup('connecting')
    rerender({ status: 'speaking' })
    expect(heard).toEqual([[DUCK_LINEAR, DUCK_ATTACK_S]])
    expect(sent).toEqual([])
  })

  it('ducks when the guide listens too', () => {
    setup('listening')
    expect(duck.target()).toBe(DUCK_LINEAR)
    expect(sent).toEqual([])
  })

  it('stays ducked across a whole conversation, then waits DUCK_RELEASE_S before it lets go', () => {
    const { rerender } = setup('listening')
    rerender({ status: 'speaking' })
    rerender({ status: 'listening' })
    expect(heard).toHaveLength(1)
    rerender({ status: 'ended' })
    vi.advanceTimersByTime(DUCK_RELEASE_S * 1000 - 1)
    expect(duck.target()).toBe(DUCK_LINEAR)
    vi.advanceTimersByTime(1)
    expect(duck.target()).toBe(1)
    expect(heard.at(-1)).toEqual([1, DUCK_RELEASE_S])
    expect(sent).toEqual([])
  })

  it('does not release if the guide speaks again before the wait is over', () => {
    const { rerender } = setup('speaking')
    rerender({ status: 'idle' })
    vi.advanceTimersByTime(DUCK_RELEASE_S * 500)
    rerender({ status: 'speaking' })
    vi.advanceTimersByTime(DUCK_RELEASE_S * 1000)
    expect(duck.target()).toBe(DUCK_LINEAR)
  })

  it('lets go when the guide panel closes', () => {
    const { unmount } = setup('speaking')
    unmount()
    expect(duck.target()).toBe(1)
  })
})
