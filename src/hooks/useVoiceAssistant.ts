// Live voice conversation with the app guide, over /api/v1/assistant/live.
// Ported from the FinAssist voice assistant.
//
// The server holds the Gemini session and runs every tool. The only things it can ask this
// page to do are navigate to a page, send a playback command to the player, point at a
// place on the sound map (IX09), and show live data in the panel (G13). Every action is
// re-validated here, because it arrives from a model over a WebSocket.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Recorder, SpeechPlayer } from '../assistant/audio'
import {
  readAnswerLength, readMicConsent, readMicTalk, saveAnswerLength, saveMicConsent, saveMicTalk,
  type AnswerLength, type MicConsent, type MicTalk,
} from '../assistant/consent'
import { currentContext, subscribeContext, type ContextUpdate } from '../assistant/context'
import { z } from 'zod'
import { socketUrl } from '../config'
import { parseMascotAnswer, type MascotAnswer } from '../features/jukebox/mascotQuery'
import type { PlayerCommand } from '../features/player/controls'
import { COMPASS_PLACES } from '../features/point/places'
import { isPage, pages, type Page } from '../pages'
import { isIsoDate, parseServerMessage, playerCommandSchema } from './voiceMessages'

export type AssistantStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'ended' | 'error'
export type TranscriptEntry = { id: number; role: 'user' | 'assistant'; text: string }
export type AssistantAction = { action: 'navigate'; page: Page } | { action: 'player'; command: PlayerCommand } | { action: 'point'; target: string }

const PLAYER_WORDS = ['play', 'pause', 'stop', 'replay', 'next', 'previous'] as const

/** The player command in a message, or null. Only the known words, and an object with nothing but a real date. */
function toPlayerCommand(value: unknown): PlayerCommand | null {
  const parsed = playerCommandSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/** The hot spots the sound map last reported to the guide, when its context carries them (board R-20261113-IX09-1). */
const reportedSpots = z.object({ hotspots: z.array(z.object({ id: z.string() })) })

/** What the guide may point at now (IX09): the reported hot-spot ids, and the nine compass places. */
function pointTargets(): string[] {
  const parsed = reportedSpots.safeParse(currentContext().find(item => item.key === 'explore')?.data)
  return [...(parsed.success ? parsed.data.hotspots.map(spot => spot.id) : []), ...COMPASS_PLACES]
}

/** The action in a server message, or null when it is unknown or unusable. Never guesses. */
export function toAssistantAction(message: Record<string, unknown>): AssistantAction | null {
  if (message.action === 'navigate' && typeof message.page === 'string' && isPage(message.page)) return { action: 'navigate', page: message.page }
  if (message.action === 'player') {
    const command = toPlayerCommand(message.command)
    if (command) return { action: 'player', command }
  }
  const { target } = message
  if (message.action === 'point' && typeof target === 'string' && pointTargets().includes(target)) return { action: 'point', target }
  return null
}

/** One thing the guide did, in plain words, and the action that takes it back (null when nothing can). */
export type ActionRecord = { id: number; label: string; inverse: AssistantAction | null }

const PLAYER_LABELS: Record<(typeof PLAYER_WORDS)[number], string> = {
  play: 'Played', pause: 'Paused', stop: 'Stopped', replay: 'Replayed from the start', next: 'Moved to the next frame', previous: 'Moved to the previous frame',
}

/** "15 July 2024" from YYYY-MM-DD. */
function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** The words and the undo for an action. `before` is the page that was showing. */
function describeAction(action: AssistantAction, before: string): { label: string; inverse: AssistantAction | null } {
  if (action.action === 'navigate') {
    const title = pages.find(item => item.id === action.page)?.title ?? action.page
    return { label: `Opened ${title}`, inverse: before !== action.page && isPage(before) ? { action: 'navigate', page: before } : null }
  }
  // A beacon changes nothing, so there is nothing to undo.
  if (action.action === 'point') return { label: `Pointed at ${action.target}`, inverse: null }
  const { command } = action
  if (typeof command === 'object') {
    const previous = currentContext().find(item => item.key === 'player')?.data
    const date = previous && typeof previous === 'object' ? (previous as { date?: unknown }).date : undefined
    return { label: `Went to ${longDate(command.setDate)}`, inverse: isIsoDate(date) ? { action: 'player', command: { setDate: date } } : null }
  }
  const inverse = command === 'play' ? 'pause' : command === 'pause' ? 'play' : null
  return { label: PLAYER_LABELS[command], inverse: inverse ? { action: 'player', command: inverse } : null }
}

const MAX_ACTION_RECORDS = 10

const MESSAGES = {
  connect: 'Echo could not connect. The rest of the app still works.',
  upstream: 'Echo stopped unexpectedly. The rest of the app still works.',
  busy: 'Echo is busy with other conversations. Try again in a minute.',
  time_limit: 'This conversation reached its time limit. Start again to keep talking.',
  service_ended: 'The conversation ended after a pause. Press Start to talk again.',
  closed: 'The conversation has ended.',
} as const

/** The words for a server error code. Codes with no entry (not_configured, bad_start) keep the server's own sentence. */
function errorMessage(code: string, serverText: string): string {
  if (code === 'busy' || code === 'upstream') return MESSAGES[code]
  return serverText || MESSAGES.upstream
}

/** A retry cannot help when the server is not set up or refused the start. */
export const NO_RETRY_CODES = ['not_configured', 'bad_start']

type Options = {
  language: string
  page: string
  onAction: (action: AssistantAction) => void
}

const MAX_ENTRIES = 40
const MIC_HEARD_LEVEL = 0.02
/** 5 seconds of 50 ms frames. */
const SILENT_WARNING_FRAMES = 100
/** Screens republish on every keystroke; forward at most this often per screen. */
const CONTEXT_DEBOUNCE_MS = 400

const SOCKET_PATH = '/api/v1/assistant/live'

/** Used when the server's `ready` does not say (`server/app/config.py`, `assistant_max_session_seconds`). */
export const DEFAULT_LIMIT_SECONDS = 600
/** The warning comes this long before the limit. */
const WARNING_SECONDS = 60
/** An open mic with no speech for this long turns itself off. */
const OPEN_MIC_QUIET_MS = 60_000
/** A server that is still connecting after this long is probably waking up (Render's free tier sleeps). */
export const WAKING_AFTER_MS = 3_000

export const MIC_NOTES = {
  refused: 'Echo cannot use the microphone. You can type your questions.',
  quiet: 'The microphone was turned off after 60 seconds with no speech. Press Mute microphone again to speak.',
} as const

type AudioModule = typeof import('../assistant/audio')
/** The guide's speech player, recorder and meter. Not part of the first page: it loads the first time the guide is used. */
let audioModule: AudioModule | null = null
let audioLoad: Promise<AudioModule> | null = null

/**
 * Loads the guide's audio code once (a failed load is tried again next time). The App starts it when the panel opens,
 * so it has normally arrived before Start is pressed, and the speech player can still be made inside that click.
 */
export function loadAssistantAudio(): Promise<AudioModule> {
  audioLoad ??= import('../assistant/audio').then(
    loaded => { audioModule = loaded; return loaded },
    (error: unknown) => { audioLoad = null; throw error },
  )
  return audioLoad
}

export function useVoiceAssistant({ language, page, onAction }: Options) {
  const [status, setStatus] = useState<AssistantStatus>('idle')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [endedMessage, setEndedMessage] = useState('')
  const [actions, setActions] = useState<ActionRecord[]>([])
  /** G13: the newest live data answer the guide fetched, shown in the panel. */
  const [liveAnswer, setLiveAnswer] = useState<MascotAnswer | null>(null)
  const [micMuted, setMicMuted] = useState(false)
  const [micSilent, setMicSilent] = useState(false)
  const [micNote, setMicNote] = useState('')
  /** A recorder is running for this conversation. */
  const [micReady, setMicReady] = useState(false)
  const [consent, setConsent] = useState<MicConsent | null>(readMicConsent)
  /** Start was pressed (or the choice was cleared) while nothing was decided, so the panel asks. */
  const [consentAsked, setConsentAsked] = useState(false)
  const [talkMode, setTalkModeState] = useState<MicTalk>(readMicTalk)
  const [talking, setTalking] = useState(false)
  const [answerLength, setAnswerLengthState] = useState<AnswerLength>(readAnswerLength)
  const [limitWarning, setLimitWarning] = useState(false)
  const [waking, setWaking] = useState(false)
  /** The microphone's peak level, 0 to 1. A ref, so 20 updates a second re-render nothing; the meter reads it. */
  const levelRef = useRef(0)
  const socket = useRef<WebSocket | null>(null)
  const recorder = useRef<Recorder | null>(null)
  const player = useRef<SpeechPlayer | null>(null)
  const openEntry = useRef<{ role: TranscriptEntry['role']; id: number } | null>(null)
  const nextId = useRef(0)
  const actionRef = useRef(onAction)
  const pageRef = useRef(page)
  // Read by the recorder's frame callback and the timers, which outlive a render.
  const live = useRef(false)
  const mutedRef = useRef(false)
  const talkingRef = useRef(false)
  const talkModeRef = useRef(talkMode)
  const answerLengthRef = useRef(answerLength)
  const lastSound = useRef(0)
  const quietTimer = useRef<number | undefined>(undefined)
  const limitTimer = useRef<number | undefined>(undefined)
  const wakeTimer = useRef<number | undefined>(undefined)
  /** Moves on with every teardown, so a start still waiting for the audio code is dropped by Stop, a new start or unmount. */
  const openAttempt = useRef(0)
  useEffect(() => {
    actionRef.current = onAction
    pageRef.current = page
  })

  const entries = useRef<TranscriptEntry[]>([])
  const records = useRef<ActionRecord[]>([])
  const nextRecordId = useRef(0)

  // Built outside the state updater, which StrictMode runs twice.
  const record = useCallback((label: string, inverse: AssistantAction | null) => {
    records.current = [...records.current, { id: nextRecordId.current++, label, inverse }].slice(-MAX_ACTION_RECORDS)
    setActions(records.current)
  }, [])

  // Built outside the state updater, which StrictMode runs twice.
  const addTranscript = useCallback((role: TranscriptEntry['role'], text: string) => {
    const open = openEntry.current
    if (open && open.role === role) {
      entries.current = entries.current.map(entry => entry.id === open.id ? { ...entry, text: entry.text + text } : entry)
    } else {
      const id = nextId.current++
      openEntry.current = { role, id }
      entries.current = [...entries.current, { id, role, text: text.trimStart() }].slice(-MAX_ENTRIES)
    }
    setTranscript(entries.current)
  }, [])

  const stopContext = useRef<(() => void) | null>(null)

  const forwardContext = useCallback((ws: WebSocket) => {
    const send = (update: ContextUpdate) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'context', ...update })) }
    currentContext().forEach(send)
    const pending = new Map<string, { update: ContextUpdate; timer: number }>()
    const unsubscribe = subscribeContext(update => {
      const waiting = pending.get(update.key)
      if (waiting) window.clearTimeout(waiting.timer)
      const merged = { ...update, announce: update.announce ?? waiting?.update.announce }
      pending.set(update.key, { update: merged, timer: window.setTimeout(() => { pending.delete(update.key); send(merged) }, CONTEXT_DEBOUNCE_MS) })
    })
    stopContext.current = () => { unsubscribe(); pending.forEach(item => window.clearTimeout(item.timer)) }
  }, [])

  const clearTimer = (timer: { current: number | undefined }) => {
    window.clearTimeout(timer.current)
    timer.current = undefined
  }

  /** Frames go to the server only while the listener means to talk: Talk pressed, or an open mic that is not muted. */
  const transmitting = useCallback(() => !!recorder.current && live.current
    && (talkModeRef.current === 'open' ? !mutedRef.current : talkingRef.current), [])

  const sendMicOff = () => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify({ type: 'mic_off' }))
  }

  const muteNow = () => {
    mutedRef.current = true
    setMicMuted(true)
    recorder.current?.setMuted(true)
    clearTimer(quietTimer)
    levelRef.current = 0
    sendMicOff()
  }

  /** Starts the 60 seconds of an open mic. Speech moves `lastSound` on, so the timer checks again instead of firing. */
  const armQuiet = useCallback(() => {
    clearTimer(quietTimer)
    if (talkModeRef.current !== 'open' || mutedRef.current || !recorder.current || !live.current) return
    lastSound.current = Date.now()
    const check = () => {
      const left = lastSound.current + OPEN_MIC_QUIET_MS - Date.now()
      if (left > 0) { quietTimer.current = window.setTimeout(check, left); return }
      quietTimer.current = undefined
      muteNow()
      setMicNote(MIC_NOTES.quiet)
    }
    quietTimer.current = window.setTimeout(check, OPEN_MIC_QUIET_MS)
  }, [])

  /** Stops the recorder and keeps the conversation going without it. */
  const stopMic = useCallback(() => {
    const wasSending = transmitting()
    recorder.current?.stop()
    recorder.current = null
    setMicReady(false)
    clearTimer(quietTimer)
    talkingRef.current = false
    setTalking(false)
    levelRef.current = 0
    if (wasSending) sendMicOff()
  }, [transmitting])

  const teardown = useCallback(() => {
    openAttempt.current++
    stopContext.current?.()
    stopContext.current = null
    live.current = false
    clearTimer(quietTimer)
    clearTimer(limitTimer)
    clearTimer(wakeTimer)
    setLimitWarning(false)
    setWaking(false)
    setMicReady(false)
    talkingRef.current = false
    setTalking(false)
    levelRef.current = 0
    recorder.current?.stop()
    recorder.current = null
    player.current?.close()
    player.current = null
    const ws = socket.current
    socket.current = null
    if (ws) {
      ws.onmessage = ws.onclose = ws.onerror = null
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'stop' }))
      ws.close()
    }
    openEntry.current = null
  }, [])

  const fail = useCallback((message: string, code = '') => {
    teardown()
    setError(message)
    setErrorCode(code)
    setStatus('error')
  }, [teardown])

  /**
   * Opens the microphone for the conversation on `ws`. Call from a click: the recorder's AudioContext is made inside the
   * gesture. A refused or missing microphone leaves the conversation open for typing.
   */
  const startMic = useCallback((ws: WebSocket, audio: AudioModule) => {
    setMicNote('')
    setMicSilent(false)
    let quietFrames = 0
    let heard = false
    audio.startRecorder(frame => {
      if (socket.current !== ws || !live.current) return
      // Frames that are not sent are not counted for the meter or the silence warning either.
      if (!transmitting()) { levelRef.current = 0; return }
      // Browser echo cancellation misses Web Audio playback, so the guide would hear itself and cut itself off.
      // While the guide is audible the listener is not "quiet", so the open mic's 60 seconds wait.
      if (player.current?.busy) { levelRef.current = 0; lastSound.current = Date.now(); return }
      if (ws.readyState === WebSocket.OPEN) ws.send(frame)
      const peak = audio.frameLevel(frame)
      levelRef.current = peak
      if (peak > MIC_HEARD_LEVEL) {
        lastSound.current = Date.now()
        if (!heard) { heard = true; setMicSilent(false) }
      } else if (!heard && ++quietFrames === SILENT_WARNING_FRAMES) setMicSilent(true)
    }).then(
      created => {
        if (socket.current !== ws) { created.stop(); return }
        recorder.current = created
        created.setMuted(mutedRef.current)
        setMicReady(true)
        armQuiet()
      },
      () => { if (socket.current === ws) setMicNote(MIC_NOTES.refused) },
    )
  }, [transmitting, armQuiet])

  // Must be called from a click: browsers only allow audio and microphone after a user gesture.
  const connect = useCallback((audio: AudioModule, withMic: boolean) => {
    teardown()
    setError('')
    setErrorCode('')
    setEndedMessage('')
    records.current = []
    setActions([])
    setLiveAnswer(null)
    mutedRef.current = false
    setMicMuted(false)
    setMicNote('')
    setMicSilent(false)
    setStatus('connecting')
    // Everything that needs the click's user activation happens before the first await.
    const speech = new audio.SpeechPlayer()
    player.current = speech
    speech.onIdle = () => setStatus(current => current === 'speaking' ? 'listening' : current)
    void speech.resume()

    const ws = new WebSocket(socketUrl(SOCKET_PATH))
    ws.binaryType = 'arraybuffer'
    socket.current = ws
    wakeTimer.current = window.setTimeout(() => { wakeTimer.current = undefined; setWaking(true) }, WAKING_AFTER_MS)
    if (withMic) startMic(ws, audio)
    ws.onopen = () => ws.send(JSON.stringify({ type: 'start', language, page: pageRef.current, detail: answerLengthRef.current }))
    ws.onerror = () => fail(MESSAGES.connect, 'connect')
    ws.onclose = () => {
      if (socket.current !== ws) return
      teardown()
      setEndedMessage(MESSAGES.closed)
      setStatus(current => current === 'error' ? current : 'ended')
    }
    ws.onmessage = event => {
      if (event.data instanceof ArrayBuffer) {
        player.current?.play(event.data)
        setStatus(current => current === 'listening' ? 'speaking' : current)
        return
      }
      if (typeof event.data !== 'string') return
      const message = parseServerMessage(event.data)
      if (!message) return
      switch (message.type) {
        case 'ready':
          // Accepted at once: the recorder's result only sets the mic state, so text works while it starts or after it fails.
          if (socket.current === ws) {
            live.current = true
            clearTimer(wakeTimer)
            setWaking(false)
            forwardContext(ws)
            setStatus('listening')
            const limit = message.limitSeconds ?? DEFAULT_LIMIT_SECONDS
            limitTimer.current = window.setTimeout(() => { limitTimer.current = undefined; setLimitWarning(true) },
              Math.max(0, limit - WARNING_SECONDS) * 1000)
            armQuiet()
          }
          break
        case 'transcript':
          addTranscript(message.role, message.text)
          break
        case 'interrupted':
          player.current?.flush()
          openEntry.current = null
          break
        case 'turn_complete':
          openEntry.current = null
          break
        case 'action':
          if (message.action === 'live_data') {
            // The server's answer, checked by the same reader as the Live page's. One that does not pass is dropped.
            const answer = parseMascotAnswer(message, [])
            if (answer) setLiveAnswer(answer)
          } else {
            const action = toAssistantAction(message)
            if (action) {
              const { label, inverse } = describeAction(action, pageRef.current)
              record(label, inverse)
              actionRef.current(action)
            }
          }
          break
        case 'error':
          {
            fail(errorMessage(message.code, message.message), message.code)
          }
          break
        case 'ended':
          teardown()
          setEndedMessage(message.reason === 'time_limit' || message.reason === 'service_ended' ? MESSAGES[message.reason] : MESSAGES.closed)
          setStatus('ended')
          break
      }
    }
  }, [language, teardown, fail, addTranscript, forwardContext, record, startMic, armQuiet])

  /**
   * Starts a conversation, from a click. With the audio code loaded (the usual case) everything happens inside the click.
   * A click that comes before the code has arrived shows "connecting" and goes on once it is here.
   */
  const open = useCallback((withMic: boolean) => {
    if (audioModule) { connect(audioModule, withMic); return }
    teardown()
    const attempt = openAttempt.current
    setError('')
    setErrorCode('')
    setEndedMessage('')
    setStatus('connecting')
    loadAssistantAudio().then(
      audio => { if (openAttempt.current === attempt) connect(audio, withMic) },
      () => { if (openAttempt.current === attempt) fail(MESSAGES.connect, 'connect') },
    )
  }, [connect, teardown, fail])

  /** Starts a conversation with the stored choice. With nothing decided, nothing connects: the panel asks first. */
  const start = useCallback(() => {
    if (consent === null) { setConsentAsked(true); return }
    open(consent === 'mic')
  }, [consent, open])

  /**
   * Stores the listener's choice. Call from the consent card's buttons (a click, for the microphone). With no
   * conversation open it starts one; during a text conversation "mic" opens the microphone in it.
   */
  const chooseConsent = useCallback((choice: MicConsent) => {
    saveMicConsent(choice)
    setConsent(choice)
    setConsentAsked(false)
    const ws = socket.current
    if (!ws) { open(choice === 'mic'); return }
    // A conversation is open, so the audio code has loaded.
    if (choice === 'mic' && !recorder.current && audioModule) startMic(ws, audioModule)
  }, [open, startMic])

  /** Forgets the choice and asks again. Any running microphone stops; a conversation keeps going by text. */
  const clearConsent = useCallback(() => {
    stopMic()
    saveMicConsent(null)
    setConsent(null)
    setConsentAsked(true)
  }, [stopMic])

  /** Ends this conversation and starts the next at once, from the warning's Continue (a click). The transcript stays. */
  const continueSession = useCallback(() => { open(consent === 'mic') }, [consent, open])

  const stop = useCallback(() => { teardown(); setLiveAnswer(null); setStatus('idle') }, [teardown])

  /**
   * Cuts the guide's sound here and keeps the conversation open. The server may still finish its turn
   * only what is playing in this page stops.
   */
  const stopSpeaking = useCallback(() => {
    player.current?.flush()
    setStatus(current => current === 'speaking' ? 'listening' : current)
  }, [])

  /** Takes back the newest action by sending its inverse the way a server action is sent. Undoing is not itself undoable. */
  const undo = useCallback(() => {
    const latest = records.current[records.current.length - 1]
    if (!latest?.inverse) return
    record(`Undid: ${latest.label}`, null)
    actionRef.current(latest.inverse)
  }, [record])

  /** The open mic's Mute microphone. Unmuting starts its 60 seconds again. */
  const toggleMute = useCallback(() => {
    if (mutedRef.current) {
      mutedRef.current = false
      setMicMuted(false)
      recorder.current?.setMuted(false)
      setMicNote('')
      armQuiet()
    } else muteNow()
  }, [armQuiet])

  /** Push-to-talk's Talk: frames are sent while it is pressed. Releasing it ends the audio stream. */
  const toggleTalk = useCallback(() => {
    const next = !talkingRef.current
    talkingRef.current = next
    setTalking(next)
    if (!next) { levelRef.current = 0; sendMicOff() }
  }, [])

  /** Push-to-talk or open mic. A switch mid-conversation starts the new mode with the mic not sending. */
  const setTalkMode = useCallback((mode: MicTalk) => {
    const wasSending = transmitting()
    saveMicTalk(mode)
    talkModeRef.current = mode
    setTalkModeState(mode)
    talkingRef.current = false
    setTalking(false)
    if (mode === 'open') { mutedRef.current = false; setMicMuted(false); recorder.current?.setMuted(false) }
    clearTimer(quietTimer)
    levelRef.current = 0
    if (wasSending) sendMicOff()
    armQuiet()
  }, [transmitting, armQuiet])

  /** Short or detailed answers, sent in the next conversation's `start`. */
  const setAnswerLength = useCallback((length: AnswerLength) => {
    saveAnswerLength(length)
    answerLengthRef.current = length
    setAnswerLengthState(length)
  }, [])

  const sendText = useCallback((text: string) => {
    const ws = socket.current
    if (!text.trim() || ws?.readyState !== WebSocket.OPEN) return false
    openEntry.current = null
    addTranscript('user', text.trim())
    openEntry.current = null
    ws.send(JSON.stringify({ type: 'text', text: text.trim() }))
    return true
  }, [addTranscript])

  useEffect(() => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify({ type: 'page', page }))
  }, [page])

  useEffect(() => teardown, [teardown])

  return {
    status, transcript, error, errorCode, endedMessage, actions, liveAnswer, micMuted, micSilent, micNote, micReady, levelRef,
    consent, consentAsked, talkMode, talking, answerLength, limitWarning, waking,
    start, stop, stopSpeaking, undo, toggleMute, toggleTalk, sendText, chooseConsent, clearConsent, continueSession, setTalkMode, setAnswerLength,
  }
}
