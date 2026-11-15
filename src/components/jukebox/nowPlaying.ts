import { useEffect, useSyncExternalStore } from 'react'

// Whether Listen is making sound right now, so the turntable's tonearm can follow it. Each Listen mode publishes; only the disc selector reads.
let playing = false
const listeners = new Set<() => void>()

function set(value: boolean) {
  if (playing === value) return
  playing = value
  listeners.forEach(listener => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export const useNowPlaying = () => useSyncExternalStore(subscribe, () => playing)

/** Say whether this Listen mode is playing. It goes quiet when the mode unmounts, so a new data set never starts with the arm down. */
export function usePublishPlaying(value: boolean) {
  useEffect(() => {
    set(value)
    return () => set(false)
  }, [value])
}
