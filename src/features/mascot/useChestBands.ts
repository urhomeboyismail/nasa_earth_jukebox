// Echo's chest equaliser (UI08): while the player plays, reads the level of the real sound and hands it to the robot's chest screen.
// It reads at most 30 times a second, and not at all while the tab is hidden, nothing plays, or the listener asked for reduced motion
// (the bars then rest flat). The bars are a picture of a sound that has its own text (the captions), so they carry no text of their own.

import { useEffect, type RefObject } from 'react'
import { currentContext, subscribeContext } from '../../assistant/context'
import { readBands } from '../../audio/level'
import type { RobotCompanionElement } from '../../types/robot-companion'
import { isPlaying } from './useFaceState'

/** Bars on the screen. */
export const CHEST_BARS = 6
/** One read about every 33 ms: 30 a second. */
export const CHEST_READ_MS = 34

const reducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** `ready` is true once the robot's script has defined the element. */
export function useChestBands(host: RefObject<RobotCompanionElement | null>, ready: boolean): void {
  useEffect(() => {
    const robot = host.current
    if (!ready || !robot) return
    let playing = isPlaying(currentContext().find(item => item.key === 'player')?.data)
    let timer = 0
    const calm = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null

    const stop = () => {
      window.clearInterval(timer)
      timer = 0
    }
    /** Starts or stops the reading to match what is true now; a stopped screen rests flat. */
    const sync = () => {
      const run = playing && document.visibilityState !== 'hidden' && !reducedMotion()
      if (run && !timer) timer = window.setInterval(() => robot.setChestBands(readBands(CHEST_BARS)), CHEST_READ_MS)
      if (!run) {
        stop()
        robot.setChestBands(null)
      }
    }

    const unsubscribe = subscribeContext(update => {
      if (update.key !== 'player') return
      playing = isPlaying(update.data)
      sync()
    })
    document.addEventListener('visibilitychange', sync)
    calm?.addEventListener('change', sync)
    sync()
    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', sync)
      calm?.removeEventListener('change', sync)
      stop()
      robot.setChestBands(null)
    }
  }, [host, ready])
}
