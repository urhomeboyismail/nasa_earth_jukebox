import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnnouncerContext, type Announce } from './announcerContext'

/** One shared polite live region for the whole app. Put it once, near the root, and call `useAnnounce()` (useAnnounce.ts) anywhere below. */
export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState('')
  const flip = useRef(false)

  const announce = useCallback<Announce>(next => {
    // Screen readers speak a live region only when its text changes, so alternate a trailing space to repeat a message.
    flip.current = !flip.current
    setText(next + (flip.current ? '' : ' '))
  }, [])
  const value = useMemo(() => announce, [announce])

  return (
    <AnnouncerContext.Provider value={value}>
      {children}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{text}</div>
    </AnnouncerContext.Provider>
  )
}
