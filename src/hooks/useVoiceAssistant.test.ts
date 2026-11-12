import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { publishContext } from '../assistant/context'
import { toAssistantAction, useVoiceAssistant, type AssistantAction } from './useVoiceAssistant'

const flush = vi.hoisted(() => vi.fn())
// The recorder fake keeps the frame callback, so a test can feed it frames. A frame's level is its first sample, 0 to 1.
const mic = vi.hoisted(() => ({
  onFrame: null as null | ((pcm: ArrayBuffer) => void),
  stop: vi.fn(),
  setMuted: vi.fn(),
}))
const startRecorder = vi.hoisted(() => vi.fn())
vi.mock('../assistant/audio', () => ({
  frameLevel: (pcm: ArrayBuffer) => new Float32Array(pcm)[0] ?? 0,
  startRecorder,
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
  sent: (string | ArrayBuffer)[] = []
  constructor() { FakeSocket.instances.push(this) }
  send(data: string | ArrayBuffer) { this.sent.push(data) }
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

function resetRig() {
  FakeSocket.instances = []
  flush.mockClear()
  mic.onFrame = null
  mic.stop.mockClear()
  mic.setMuted.mockClear()
  startRecorder.mockReset()
  startRecorder.mockImplementation(async (onFrame: (pcm: ArrayBuffer) => void) => {
    mic.onFrame = onFrame
    return { stop: mic.stop, setMuted: mic.setMuted }
  })
  vi.stubGlobal('WebSocket', FakeSocket)
}

function setup(page = 'home') {
  const onAction = vi.fn<(action: AssistantAction) => void>()
  const hook = renderHook(() => useVoiceAssistant({ language: 'en', page, onAction }))
  return { ...hook, onAction }
}
const socket = () => FakeSocket.instances[FakeSocket.instances.length - 1]
const server = (message: Record<string, unknown>) => act(async () => { await socket().onmessage?.({ data: JSON.stringify(message) }) })
/** Starts with the stored choice and lets the recorder (if any) and the server's `ready` settle. */
async function connect(page?: string, ready: Record<string, unknown> = { type: 'ready' }) {
  const rig = setup(page)
  await act(async () => { rig.result.current.start() })
  act(() => socket().onopen?.())
  await server(ready)
  return rig
}
/** One 50 ms frame at this level. */
const frame = (level: number) => new Float32Array([level]).buffer
const sentJson = () => socket().sent.filter(item => typeof item === 'string').map(item => JSON.parse(item) as Record<string, unknown>)
const sentFrames = () => socket().sent.filter(item => typeof item !== 'string')

describe('useVoiceAssistant (V01)', () => {
  beforeEach(() => {
    resetRig()
    // V01's cases run on the open mic, as the guide was before V02.
    localStorage.setItem('earth-jukebox:mic-consent', 'mic')
    localStorage.setItem('earth-jukebox:mic-talk', 'open')
  })
  afterEach(() => { vi.unstubAllGlobals(); localStorage.clear() })

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

describe('useVoiceAssistant: consent, text only, push-to-talk and the time limit (V02)', () => {
  beforeEach(resetRig)
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear() })

  it('connects nothing and opens no microphone on Start before a choice; it asks instead', async () => {
    const { result } = setup()
    expect(result.current.consent).toBeNull()
    await act(async () => { result.current.start() })
    expect(result.current.consentAsked).toBe(true)
    expect(FakeSocket.instances).toHaveLength(0)
    expect(startRecorder).not.toHaveBeenCalled()
    expect(result.current.status).toBe('idle')
  })

  it('"mic" stores the choice, then starts the recorder once', async () => {
    const { result } = setup()
    await act(async () => { result.current.chooseConsent('mic') })
    expect(localStorage.getItem('earth-jukebox:mic-consent')).toBe('mic')
    expect(startRecorder).toHaveBeenCalledTimes(1)
    expect(result.current.consentAsked).toBe(false)
    expect(FakeSocket.instances).toHaveLength(1)
  })

  it('"text" stores the choice and starts a conversation with no recorder, in which typing works', async () => {
    const { result } = setup()
    await act(async () => { result.current.chooseConsent('text') })
    expect(localStorage.getItem('earth-jukebox:mic-consent')).toBe('text')
    act(() => socket().onopen?.())
    await server({ type: 'ready' })
    expect(startRecorder).not.toHaveBeenCalled()
    expect(result.current.status).toBe('listening')
    expect(result.current.micReady).toBe(false)
    act(() => { result.current.sendText('What is this?') })
    expect(sentJson()).toContainEqual({ type: 'text', text: 'What is this?' })
  })

  it('keeps the conversation open when the microphone is refused, with a note, and typing works', async () => {
    localStorage.setItem('earth-jukebox:mic-consent', 'mic')
    startRecorder.mockRejectedValueOnce(new DOMException('Permission denied', 'NotAllowedError'))
    const { result } = await connect()
    expect(result.current.status).toBe('listening')
    expect(result.current.error).toBe('')
    expect(result.current.micNote).toBe('Echo cannot use the microphone. You can type your questions.')
    expect(result.current.micReady).toBe(false)
    act(() => { result.current.sendText('Hello') })
    expect(sentJson()).toContainEqual({ type: 'text', text: 'Hello' })
  })

  it('accepts ready while the recorder is still starting', async () => {
    localStorage.setItem('earth-jukebox:mic-consent', 'mic')
    let finish: (recorder: { stop: () => void; setMuted: () => void }) => void = () => {}
    startRecorder.mockImplementationOnce((onFrame: (pcm: ArrayBuffer) => void) => {
      mic.onFrame = onFrame
      return new Promise(resolve => { finish = resolve })
    })
    const { result } = await connect()
    expect(result.current.status).toBe('listening')
    expect(result.current.micReady).toBe(false)
    await act(async () => { finish({ stop: mic.stop, setMuted: mic.setMuted }) })
    expect(result.current.micReady).toBe(true)
  })

  it('sends no frames under push-to-talk until Talk is pressed, and mic_off when it is released', async () => {
    localStorage.setItem('earth-jukebox:mic-consent', 'mic')
    const { result } = await connect()
    expect(result.current.talkMode).toBe('push')
    act(() => mic.onFrame?.(frame(0.5)))
    expect(sentFrames()).toHaveLength(0)
    expect(result.current.levelRef.current).toBe(0) // a frame not sent is not counted for the meter

    act(() => result.current.toggleTalk())
    expect(result.current.talking).toBe(true)
    act(() => mic.onFrame?.(frame(0.5)))
    expect(sentFrames()).toHaveLength(1)
    expect(result.current.levelRef.current).toBe(0.5)

    act(() => result.current.toggleTalk())
    expect(result.current.talking).toBe(false)
    expect(sentJson().at(-1)).toEqual({ type: 'mic_off' })
    act(() => mic.onFrame?.(frame(0.5)))
    expect(sentFrames()).toHaveLength(1)
  })

  it('turns an open mic off after 60 s of quiet, and speech starts the 60 s again', async () => {
    vi.useFakeTimers()
    localStorage.setItem('earth-jukebox:mic-consent', 'mic')
    localStorage.setItem('earth-jukebox:mic-talk', 'open')
    const { result } = await connect()
    act(() => mic.onFrame?.(frame(0.5)))
    expect(sentFrames()).toHaveLength(1)

    act(() => { vi.advanceTimersByTime(59_000) })
    act(() => mic.onFrame?.(frame(0.5))) // speech at 59 s
    act(() => { vi.advanceTimersByTime(59_000) })
    expect(result.current.micMuted).toBe(false)
    act(() => mic.onFrame?.(frame(0.001))) // quiet frames do not reset it
    act(() => { vi.advanceTimersByTime(1_000) })
    expect(result.current.micMuted).toBe(true)
    expect(mic.setMuted).toHaveBeenLastCalledWith(true)
    expect(sentJson().at(-1)).toEqual({ type: 'mic_off' })
    expect(result.current.micNote).toBe('The microphone was turned off after 60 seconds with no speech. Press Mute microphone again to speak.')

    act(() => result.current.toggleMute())
    expect(result.current.micMuted).toBe(false)
    expect(result.current.micNote).toBe('')
  })

  it('sends the answer length in start as detail, and remembers it', async () => {
    localStorage.setItem('earth-jukebox:mic-consent', 'text')
    const first = setup()
    act(() => first.result.current.setAnswerLength('detailed'))
    await act(async () => { first.result.current.start() })
    act(() => socket().onopen?.())
    expect(sentJson()[0]).toEqual({ type: 'start', language: 'en', page: 'home', detail: 'detailed' })
    first.unmount()

    const reloaded = setup()
    expect(reloaded.result.current.answerLength).toBe('detailed')
  })

  it('sends "short" by default', async () => {
    localStorage.setItem('earth-jukebox:mic-consent', 'text')
    await connect()
    expect(sentJson()[0]).toMatchObject({ type: 'start', detail: 'short' })
  })

  it.each([
    ['600 s, from the server', { type: 'ready', limitSeconds: 600 }, 540_000],
    ['600 s when the server does not say', { type: 'ready' }, 540_000],
    ['a shorter server limit', { type: 'ready', limitSeconds: 300 }, 240_000],
  ])('warns a minute before the limit (%s); Continue opens a new socket and keeps the transcript', async (_name, ready, warnAt) => {
    vi.useFakeTimers()
    localStorage.setItem('earth-jukebox:mic-consent', 'text')
    const { result } = await connect('home', ready)
    await server({ type: 'transcript', role: 'assistant', text: 'Hello there.' })
    act(() => { vi.advanceTimersByTime(warnAt - 1) })
    expect(result.current.limitWarning).toBe(false)
    act(() => { vi.advanceTimersByTime(1) })
    expect(result.current.limitWarning).toBe(true)

    act(() => result.current.continueSession())
    expect(FakeSocket.instances).toHaveLength(2)
    expect(result.current.limitWarning).toBe(false)
    expect(result.current.status).toBe('connecting')
    expect(result.current.transcript.map(entry => entry.text)).toEqual(['Hello there.'])
  })

  it('says it is waking the server after 3 s of connecting, and not before', async () => {
    vi.useFakeTimers()
    localStorage.setItem('earth-jukebox:mic-consent', 'text')
    const { result } = setup()
    act(() => { result.current.start() })
    act(() => { vi.advanceTimersByTime(2_999) })
    expect(result.current.waking).toBe(false)
    act(() => { vi.advanceTimersByTime(1) })
    expect(result.current.waking).toBe(true)
    await server({ type: 'ready' })
    expect(result.current.waking).toBe(false)
  })

  it('returns no level in its state; the level is a ref', async () => {
    localStorage.setItem('earth-jukebox:mic-consent', 'mic')
    localStorage.setItem('earth-jukebox:mic-talk', 'open')
    const { result } = await connect()
    expect('level' in result.current).toBe(false)
    const before = result.current
    act(() => mic.onFrame?.(frame(0.25)))
    expect(result.current.levelRef.current).toBe(0.25)
    expect(result.current).toBe(before) // writing the level re-rendered nothing
  })

  it('"Change microphone choice" stops the microphone, forgets the choice and asks again; the conversation goes on', async () => {
    localStorage.setItem('earth-jukebox:mic-consent', 'mic')
    const { result } = await connect()
    act(() => result.current.clearConsent())
    expect(mic.stop).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('earth-jukebox:mic-consent')).toBeNull()
    expect(result.current.consent).toBeNull()
    expect(result.current.consentAsked).toBe(true)
    expect(result.current.micReady).toBe(false)
    expect(result.current.status).toBe('listening')
    act(() => { result.current.sendText('Still here?') })
    expect(sentJson()).toContainEqual({ type: 'text', text: 'Still here?' })
  })
})
