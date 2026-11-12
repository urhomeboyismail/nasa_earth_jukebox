import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { publishContext } from '../assistant/context'
import { toAssistantAction, useVoiceAssistant, type AssistantAction } from './useVoiceAssistant'

const flush = vi.hoisted(() => vi.fn())
vi.mock('../assistant/audio', () => ({
  frameLevel: () => 0,
  startRecorder: async () => ({ stop: () => {}, setMuted: () => {} }),
  SpeechPlayer: class {
    busy = false
    onIdle: (() => void) | null = null
    resume = async () => {}
    play = () => {}
    flush = flush
    close = () => {}
  },
}))

class FakeSocket {
  static OPEN = 1
  static instances: FakeSocket[] = []
  readyState = 1
  binaryType = ''
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => Promise<void> | void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  sent: string[] = []
  constructor() { FakeSocket.instances.push(this) }
  send(data: string) { this.sent.push(data) }
  close() {}
}

describe('toAssistantAction', () => {
  it('accepts navigation to a known page', () => {
    expect(toAssistantAction({ action: 'navigate', page: 'listen' })).toEqual({ action: 'navigate', page: 'listen' })
  })

  it.each(['admin', '', 5, null, undefined])('rejects navigation to %s', page => {
    expect(toAssistantAction({ action: 'navigate', page })).toBeNull()
  })

  it.each(['play', 'pause', 'stop', 'replay', 'next', 'previous'])('accepts the player command "%s"', command => {
    expect(toAssistantAction({ action: 'player', command })).toEqual({ action: 'player', command })
  })

  it('accepts setting a real date', () => {
    expect(toAssistantAction({ action: 'player', command: { setDate: '2024-07-15' } })).toEqual({ action: 'player', command: { setDate: '2024-07-15' } })
    expect(toAssistantAction({ action: 'player', command: { setDate: '2024-02-29' } })).not.toBeNull() // a leap day
  })

  it.each([
    'rewind', 'PLAY', ' play', '', 'play;stop', 5, null, undefined, [], ['play'], true,
    { setDate: '15 July 2024' }, { setDate: '2024-7-15' }, { setDate: '2024-02-30' }, { setDate: '2023-02-29' }, { setDate: '2024-13-01' },
    { setDate: 20240715 }, { setDate: null }, {}, { setDate: '2024-07-15', extra: 1 }, { date: '2024-07-15' }, { SetDate: '2024-07-15' },
  ])('rejects the player command %j', command => {
    expect(toAssistantAction({ action: 'player', command })).toBeNull()
  })

  it('rejects an action it does not know, and a player action with no command', () => {
    expect(toAssistantAction({ action: 'delete_everything' })).toBeNull()
    expect(toAssistantAction({ action: 'player' })).toBeNull()
    expect(toAssistantAction({})).toBeNull()
  })
})

describe('useVoiceAssistant (V01)', () => {
  beforeEach(() => {
    FakeSocket.instances = []
    flush.mockClear()
    vi.stubGlobal('WebSocket', FakeSocket)
  })
  afterEach(() => vi.unstubAllGlobals())

  function setup(page = 'home') {
    const onAction = vi.fn<(action: AssistantAction) => void>()
    const hook = renderHook(() => useVoiceAssistant({ language: 'en', page, onAction }))
    return { ...hook, onAction }
  }
  const socket = () => FakeSocket.instances[FakeSocket.instances.length - 1]
  const server = (message: Record<string, unknown>) => act(async () => { await socket().onmessage?.({ data: JSON.stringify(message) }) })
  async function connect(page?: string) {
    const rig = setup(page)
    act(() => { void rig.result.current.start() })
    act(() => socket().onopen?.())
    await server({ type: 'ready' })
    return rig
  }

  it('records "Opened Listen" with an inverse back to the page that was showing, and undoes it once', async () => {
    const { result, onAction } = await connect('home')
    await server({ type: 'action', action: 'navigate', page: 'listen' })
    expect(result.current.actions.map(item => item.label)).toEqual(['Opened Listen'])
    expect(onAction).toHaveBeenLastCalledWith({ action: 'navigate', page: 'listen' })

    act(() => result.current.undo())
    expect(onAction).toHaveBeenLastCalledWith({ action: 'navigate', page: 'home' })
    const labels = result.current.actions.map(item => item.label)
    expect(labels).toEqual(['Opened Listen', 'Undid: Opened Listen'])
    expect(result.current.actions[1].inverse).toBeNull()

    onAction.mockClear()
    act(() => result.current.undo()) // the newest entry cannot be undone
    expect(onAction).not.toHaveBeenCalled()
  })

  it('pairs play with pause, and gives stop, replay, next and previous no inverse', async () => {
    const { result, onAction } = await connect()
    await server({ type: 'action', action: 'player', command: 'pause' })
    expect(result.current.actions[0]).toMatchObject({ label: 'Paused', inverse: { action: 'player', command: 'play' } })
    act(() => result.current.undo())
    expect(onAction).toHaveBeenLastCalledWith({ action: 'player', command: 'play' })

    for (const command of ['stop', 'replay', 'next', 'previous']) {
      await server({ type: 'action', action: 'player', command })
      expect(result.current.actions[result.current.actions.length - 1].inverse).toBeNull()
    }
  })

  it('undoes a date change with the previous date from the player context', async () => {
    publishContext('player', { date: '2024-03-01' })
    const { result, onAction } = await connect()
    await server({ type: 'action', action: 'player', command: { setDate: '2024-07-15' } })
    expect(result.current.actions[0].label).toBe('Went to 15 July 2024')
    act(() => result.current.undo())
    expect(onAction).toHaveBeenLastCalledWith({ action: 'player', command: { setDate: '2024-03-01' } })
  })

  it('keeps the last 10 entries, newest last', async () => {
    const { result } = await connect()
    for (let i = 0; i < 12; i++) await server({ type: 'action', action: 'player', command: i % 2 ? 'play' : 'stop' })
    expect(result.current.actions).toHaveLength(10)
    expect(result.current.actions[9].label).toBe('Played')
  })

  it('stops the speech without closing the conversation', async () => {
    const { result } = await connect()
    await act(async () => { await socket().onmessage?.({ data: new ArrayBuffer(8) }) })
    expect(result.current.status).toBe('speaking')
    act(() => result.current.stopSpeaking())
    expect(flush).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('listening')
  })

  it('uses the plain words for a socket error, upstream and busy', async () => {
    const rig = setup()
    act(() => { void rig.result.current.start() })
    act(() => socket().onerror?.())
    expect(rig.result.current.error).toBe('Echo could not connect. The rest of the app still works.')

    const upstream = await connect()
    await server({ type: 'error', code: 'upstream', message: 'raw developer text' })
    expect(upstream.result.current.error).toBe('Echo stopped unexpectedly. The rest of the app still works.')
    expect(upstream.result.current.errorCode).toBe('upstream')

    const busy = await connect()
    await server({ type: 'error', code: 'busy', message: 'raw developer text' })
    expect(busy.result.current.error).toBe('Echo is busy with other conversations. Try again in a minute.')
  })

  it('keeps the error code, so a not_configured error can hide "Try again"', async () => {
    const { result } = await connect()
    await server({ type: 'error', code: 'not_configured', message: 'The voice guide is not set up.' })
    expect(result.current.errorCode).toBe('not_configured')
    expect(result.current.error).toBe('The voice guide is not set up.')
  })

  it.each([
    ['time_limit', 'This conversation reached its time limit. Start again to keep talking.'],
    ['service_ended', 'Echo finished the conversation.'],
    ['closed', 'The conversation has ended.'],
  ])('says why the conversation ended: %s', async (reason, text) => {
    const { result } = await connect()
    await server({ type: 'ended', reason })
    expect(result.current.status).toBe('ended')
    expect(result.current.endedMessage).toBe(text)
  })
})
