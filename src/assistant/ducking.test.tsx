import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { onPlayerCommand, type PlayerCommand } from '../features/player/controls'
import type { AssistantStatus } from '../hooks/useVoiceAssistant'
import { noteGuidePlaybackCommand, resetDucking, useDucking } from './ducking'

let sent: PlayerCommand[]
let unsubscribe: () => void

beforeEach(() => {
  resetDucking()
  sent = []
  unsubscribe = onPlayerCommand(command => sent.push(command))
})
afterEach(() => unsubscribe())

/** Runs the hook through a list of statuses, as the guide moves through a conversation. */
function through(...statuses: AssistantStatus[]) {
  const { rerender } = renderHook(({ status }) => useDucking(status), { initialProps: { status: statuses[0] } })
  statuses.slice(1).forEach(status => rerender({ status }))
}

describe('ducking the music for the voice guide', () => {
  it('does nothing while the guide is closed, connecting or has ended', () => {
    through('idle', 'connecting', 'ended', 'error', 'idle')
    expect(sent).toEqual([])
  })

  it('pauses the music when the guide starts listening', () => {
    through('idle', 'connecting', 'listening')
    expect(sent).toEqual(['pause'])
  })

  it('pauses again each time the guide starts to speak', () => {
    through('listening', 'speaking', 'listening', 'speaking')
    expect(sent).toEqual(['pause', 'pause', 'pause'])
  })

  it('does not pause when the guide goes back to listening after speaking', () => {
    through('speaking', 'listening')
    expect(sent).toEqual(['pause'])
  })

  it('never resumes the music by itself', () => {
    through('connecting', 'listening', 'speaking', 'listening', 'ended', 'idle')
    expect(sent.every(command => command === 'pause')).toBe(true)
  })

  it('lets music the listener just asked for play while the guide confirms, then ducks it on the next turn', () => {
    const { rerender } = renderHook(({ status }) => useDucking(status), { initialProps: { status: 'listening' as AssistantStatus } })
    sent.length = 0
    noteGuidePlaybackCommand('play')
    rerender({ status: 'speaking' }) // "Playing now."
    expect(sent).toEqual([])
    rerender({ status: 'listening' }) // the turn is over
    rerender({ status: 'speaking' }) // the next answer
    expect(sent).toEqual(['pause'])
  })

  it('treats pause and stop as no wish for sound', () => {
    const { rerender } = renderHook(({ status }) => useDucking(status), { initialProps: { status: 'listening' as AssistantStatus } })
    sent.length = 0
    noteGuidePlaybackCommand('next')
    noteGuidePlaybackCommand('pause')
    rerender({ status: 'speaking' })
    expect(sent).toEqual(['pause'])
  })

  it('counts replay, next, previous and set-date as asking for sound', () => {
    for (const command of ['replay', 'next', 'previous', { setDate: '2024-07-15' }] as PlayerCommand[]) {
      resetDucking()
      sent.length = 0
      const { rerender, unmount } = renderHook(({ status }) => useDucking(status), { initialProps: { status: 'listening' as AssistantStatus } })
      sent.length = 0
      noteGuidePlaybackCommand(command)
      rerender({ status: 'speaking' })
      expect(sent, JSON.stringify(command)).toEqual([])
      unmount()
    }
  })
})
