// Music steps aside for the voice guide (ticket SN13). While the guide listens or speaks, the sound is ducked by DUCK_DB (src/audio/duck.ts);
// it is never paused, so the listener's place stays and the music comes back by itself a moment after the guide is done.

import { useEffect, useRef } from 'react'
import { DUCK_RELEASE_S, duck } from '../audio/duck'
import type { PlayerCommand } from '../features/player/controls'
import type { AssistantStatus } from '../hooks/useVoiceAssistant'

/**
 * Kept only so `App.tsx` still compiles: nothing needs to know whether the listener just asked for sound any more, because the guide ducks
 * the music instead of pausing it. Remove this and its call in `App.tsx` when that file is next edited.
 */
export function noteGuidePlaybackCommand(_command: PlayerCommand) {}

/** For tests: forget every duck. */
export function resetDucking() {
  duck.reset()
}

export function useDucking(status: AssistantStatus) {
  const active = status === 'listening' || status === 'speaking'
  const held = useRef(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (active) {
      window.clearTimeout(timer.current)
      timer.current = undefined
      if (!held.current) {
        held.current = true
        duck.begin('guide')
      }
    } else if (held.current && timer.current === undefined) {
      // The end of a sentence is not cut: the release waits for the music's own fade time.
      timer.current = window.setTimeout(() => {
        timer.current = undefined
        held.current = false
        duck.end('guide')
      }, DUCK_RELEASE_S * 1000)
    }
  }, [active])

  useEffect(() => () => {
    window.clearTimeout(timer.current)
    if (held.current) {
      held.current = false
      duck.end('guide')
    }
  }, [])
}
