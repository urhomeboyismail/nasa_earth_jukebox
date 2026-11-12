// The numbers behind Echo's chest (docs/tickets/JB03-audio-chest.md): band levels and loudness of the sound that is playing.
// While `active` it reads the analyser (src/audio/levels.ts) up to 30 times a second, or once a second under reduced motion. When not active
// there is no loop, no Tone import and no analyser. It only listens: it never starts or loads a sound, so nothing plays before a click.

import { useEffect, useState } from 'react'
import { attachLevels, detachLevels, getLevels, getLoudness, LEVEL_BANDS } from '../../audio/levels'

export type Levels = { levels: Uint8Array | null; loudness: number }

const RESTING: Levels = { levels: null, loudness: 0 }
const FRAME_MS = 1000 / 30
const REDUCED_MS = 1000

const prefersReducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function useLevels(active: boolean): Levels {
  const [reading, setReading] = useState<Levels>(RESTING)

  useEffect(() => {
    if (!active) return
    let stopped = false
    let frame = 0
    let timer: ReturnType<typeof setInterval> | undefined
    let lastAt = -Infinity
    const buffer = new Uint8Array(LEVEL_BANDS)

    const read = () => {
      if (getLevels(buffer)) setReading({ levels: Uint8Array.from(buffer), loudness: getLoudness() })
    }
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop)
      if (now - lastAt < FRAME_MS) return
      lastAt = now
      read()
    }

    // The player is playing, so Tone is already loaded and this import is a cache hit.
    void import('tone').then(tone => {
      if (stopped) return
      attachLevels<AnalyserNode>(tone)
      if (prefersReducedMotion()) {
        read()
        timer = setInterval(read, REDUCED_MS)
      } else {
        frame = requestAnimationFrame(loop)
      }
    })

    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      clearInterval(timer)
      detachLevels()
    }
  }, [active])

  return active ? reading : RESTING
}
