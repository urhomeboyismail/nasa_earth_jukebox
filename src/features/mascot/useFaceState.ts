// What Echo's face needs to know about the app that no prop carries (docs/tickets/JB01-mascot-dock.md): whether the player is playing, whether the
// tab is hidden, and how long it has been since the listener did anything. The idle check is the dock's only timer: once every IDLE_CHECK_MS.

import { useEffect, useRef, useState } from 'react'
import { currentContext, subscribeContext } from '../../assistant/context'

export const IDLE_CHECK_MS = 15_000

/** The player publishes `playing` on the context bus (src/features/player/index.tsx). Anything else counts as not playing. */
export function isPlaying(data: unknown): boolean {
  return typeof data === 'object' && data !== null && 'playing' in data && data.playing === true
}

export function useFaceState(): { playing: boolean; hidden: boolean; idleMs: number } {
  const [playing, setPlaying] = useState(() => isPlaying(currentContext().find(item => item.key === 'player')?.data))
  const [hidden, setHidden] = useState(() => document.visibilityState === 'hidden')
  const [idleMs, setIdleMs] = useState(0)
  /** Set when the page mounts, and by each input. */
  const lastInput = useRef(0)

  useEffect(() => subscribeContext(update => { if (update.key === 'player') setPlaying(isPlaying(update.data)) }), [])

  useEffect(() => {
    lastInput.current = Date.now()
    const onVisibility = () => setHidden(document.visibilityState === 'hidden')
    // Any input wakes Echo at once; setting the same 0 again does not render.
    const onInput = () => { lastInput.current = Date.now(); setIdleMs(0) }
    const events = ['pointerdown', 'keydown', 'scroll'] as const
    document.addEventListener('visibilitychange', onVisibility)
    for (const name of events) window.addEventListener(name, onInput, { passive: true })
    const timer = window.setInterval(() => setIdleMs(Date.now() - lastInput.current), IDLE_CHECK_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      for (const name of events) window.removeEventListener(name, onInput)
      window.clearInterval(timer)
    }
  }, [])

  return { playing, hidden, idleMs }
}
