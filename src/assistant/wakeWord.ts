// "Hey Echo": the wake phrase that opens the voice guide hands-free, like "Hey Google". Opt-in and off by default.
//
// It uses the browser's own speech recognition (Web Speech API). In Chrome and Edge that sends the microphone's sound to the browser
// maker's speech service while it listens; nothing goes to Echo's server until the phrase is heard. The panel says so before it can
// be turned on. Where the browser has no speech recognition (Firefox), the option is not offered.

import { useStoredValue } from '../hooks/useStoredValue'

export const WAKE_KEY = 'earth-jukebox:wake-word'

/** "Hey Echo", with the spellings recognisers often write for it, then whatever was said after it. */
const WAKE = /\b(?:hey+|hay|hei|okay|ok)[\s,.!-]*(?:echo|echoe?s|eco|ecko|ekko|ekho)\b[\s,.!?-]*(.*)$/i

/** The question after the wake phrase ('' when there is none), or null when the phrase was not said. */
export function wakeQuery(text: string): string | null {
  const match = WAKE.exec(text)
  return match ? match[1].trim() : null
}

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } }
type RecognitionEvent = { resultIndex: number; results: { length: number; [index: number]: RecognitionResult } }
type RecognitionError = { error: string }

/** The part of the Web Speech API's SpeechRecognition this uses. TypeScript's DOM types do not include it. */
export type Recognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: RecognitionError) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
export type RecognitionCtor = new () => Recognition

const isCtor = (value: unknown): value is RecognitionCtor => typeof value === 'function'

/** The browser's SpeechRecognition, or null where there is none. */
export function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const ctor: unknown = Reflect.get(window, 'SpeechRecognition') ?? Reflect.get(window, 'webkitSpeechRecognition')
  return isCtor(ctor) ? ctor : null
}

/** Errors that mean the listener cannot work until the person changes something; anything else is tried again. */
const BLOCKING = new Set(['not-allowed', 'service-not-allowed', 'audio-capture'])
/** Waits before starting again after an end or a passing error. Recognisers stop by themselves after a silence. */
export const RESTART_MS = 300
export const RETRY_MS = [1000, 3000, 10000]

export type WakeListener = { stop(): void }

/**
 * Listens until stopped. `onWake` gets the question said after the phrase; the listener has stopped by then, so the guide can
 * have the microphone. `onBlocked` gets the reason when the browser refuses, and the listener stays stopped.
 */
export function listenForWake(
  ctor: RecognitionCtor,
  { lang, onWake, onBlocked }: { lang: string; onWake: (query: string) => void; onBlocked: (reason: string) => void },
): WakeListener {
  let running = true
  let failures = 0
  let timer: number | undefined
  let recognition: Recognition | null = null

  const finish = () => {
    running = false
    window.clearTimeout(timer)
    const current = recognition
    recognition = null
    if (current) { current.onend = null; current.onresult = null; current.onerror = null; current.abort() }
  }

  const retryWait = () => RETRY_MS[Math.min(failures, RETRY_MS.length) - 1]

  const begin = () => {
    if (!running) return
    const next = new ctor()
    recognition = next
    next.continuous = true
    next.interimResults = false
    next.lang = lang
    next.onresult = event => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (!result.isFinal) continue
        failures = 0
        const query = wakeQuery(result[0].transcript)
        if (query !== null) {
          finish()
          onWake(query)
          return
        }
      }
    }
    next.onerror = event => {
      if (BLOCKING.has(event.error)) {
        finish()
        onBlocked(event.error)
      } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
        failures++
      }
    }
    next.onend = () => {
      if (!running) return
      timer = window.setTimeout(begin, failures ? retryWait() : RESTART_MS)
    }
    try {
      next.start()
    } catch {
      // Refused before any event: try again shortly, as after an end.
      failures++
      timer = window.setTimeout(begin, retryWait())
    }
  }

  begin()
  return { stop: finish }
}

const parseOn = (text: string) => text === 'on'
const serializeOn = (on: boolean) => (on ? 'on' : null)

/** The listener's choice: off unless they turned it on. Kept on this device. */
export function useWakeSetting(): [boolean, (on: boolean) => void] {
  return useStoredValue(WAKE_KEY, parseOn, false, serializeOn)
}
