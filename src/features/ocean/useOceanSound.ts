import { useCallback, useEffect, useRef, useState } from 'react'
import { loadOceanSound, type OceanSound } from './sound'
import type { OceanTrack } from './schema'

/**
 * The ocean track's sound, built the first time `ensure()` is called (from a click or key press, never before), and taken
 * down when the track changes or the page closes. `failed` is true when the browser would not start the sound.
 */
export function useOceanSound(track: OceanTrack) {
  const sound = useRef<OceanSound | null>(null)
  const pending = useRef<Promise<OceanSound | null> | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => () => {
    sound.current?.dispose()
    sound.current = null
    pending.current = null
  }, [track])

  const ensure = useCallback(() => {
    if (sound.current) return Promise.resolve(sound.current)
    if (pending.current) return pending.current
    const mine: Promise<OceanSound | null> = loadOceanSound(track).then(
      made => {
        // The track changed (or the page closed) while Tone was loading.
        if (pending.current !== mine) { made.dispose(); return null }
        sound.current = made
        setFailed(false)
        return made
      },
      (reason: unknown) => {
        console.error(reason)
        if (pending.current === mine) pending.current = null
        setFailed(true)
        return null
      },
    )
    pending.current = mine
    return mine
  }, [track])

  return { sound, ensure, failed }
}
