// Runs the "Hey Echo" listener (src/assistant/wakeWord.ts) only when it may: the listener turned it on, the browser can, the page has
// had a click or key press (so Echo's answer may play, and the browser may open the microphone), the tab is visible, and the guide is
// not already in a conversation (they would fight over the microphone).

import { useEffect, useMemo, useRef, useState } from 'react'
import { listenForWake, recognitionCtor } from '../assistant/wakeWord'

export type WakeState = 'off' | 'unsupported' | 'blocked' | 'waiting' | 'paused' | 'listening'

type Options = {
  enabled: boolean
  /** The guide is busy (connecting or in a conversation). */
  paused: boolean
  lang: string
  onWake: (query: string) => void
}

const hasBeenActive = () => (typeof navigator === 'undefined' ? true : (navigator.userActivation?.hasBeenActive ?? true))
const isVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden'

export function useWakeWord({ enabled, paused, lang, onWake }: Options): { state: WakeState; blocked: string } {
  const ctor = useMemo(() => recognitionCtor(), [])
  const [activated, setActivated] = useState(hasBeenActive)
  const [visible, setVisible] = useState(isVisible)
  const [blocked, setBlocked] = useState('')
  // Turning it on again clears an old refusal, so the browser is asked again (adjusted while rendering, not in an effect).
  const [seenEnabled, setSeenEnabled] = useState(enabled)
  if (seenEnabled !== enabled) {
    setSeenEnabled(enabled)
    if (enabled) setBlocked('')
  }
  const onWakeRef = useRef(onWake)
  useEffect(() => { onWakeRef.current = onWake })

  useEffect(() => {
    if (activated) return
    const done = () => setActivated(true)
    window.addEventListener('pointerdown', done, { once: true })
    window.addEventListener('keydown', done, { once: true })
    return () => { window.removeEventListener('pointerdown', done); window.removeEventListener('keydown', done) }
  }, [activated])

  useEffect(() => {
    const update = () => setVisible(isVisible())
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])

  const run = enabled && !!ctor && !blocked && activated && visible && !paused
  useEffect(() => {
    if (!run || !ctor) return
    const listener = listenForWake(ctor, { lang, onWake: query => onWakeRef.current(query), onBlocked: setBlocked })
    return () => listener.stop()
  }, [run, ctor, lang])

  const state: WakeState = !enabled ? 'off' : !ctor ? 'unsupported' : blocked ? 'blocked' : !activated ? 'waiting' : run ? 'listening' : 'paused'
  return { state, blocked }
}
