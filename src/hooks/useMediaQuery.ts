import { useCallback, useSyncExternalStore } from 'react'

/**
 * Whether a media query matches now, kept up to date as the window changes. Where the browser has no `matchMedia`
 * (jsdom in tests), it answers `fallback`.
 */
export function useMediaQuery(query: string, fallback = true): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    if (typeof window === 'undefined' || !window.matchMedia) return () => {}
    const list = window.matchMedia(query)
    list.addEventListener?.('change', onChange)
    return () => list.removeEventListener?.('change', onChange)
  }, [query])
  const read = () => (typeof window === 'undefined' || !window.matchMedia ? fallback : window.matchMedia(query).matches)
  return useSyncExternalStore(subscribe, read, () => fallback)
}
