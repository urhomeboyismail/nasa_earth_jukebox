import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { duck, speechMs } from '../audio/duck'
import { dueMessage, offerMessage, START_RATE, type RateState } from './announceRate'
import { AnnouncerContext, type Announce } from './announcerContext'

/** One shared polite live region for the whole app. Put it once, near the root, and call `useAnnounce()` (useAnnounce.ts) anywhere below. */
export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState('')
  const flip = useRef(false)
  const rate = useRef<RateState>(START_RATE)
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback((next: string) => {
    // The screen reader speaks over the music, so the music steps aside for as long as the words take.
    duck.for('announcement', speechMs(next))
    // Screen readers speak a live region only when its text changes, so alternate a trailing space to repeat a message.
    flip.current = !flip.current
    setText(next + (flip.current ? '' : ' '))
  }, [])

  const announce = useCallback<Announce>((next, options) => {
    const step = offerMessage(rate.current, next, Date.now(), !!options?.busy)
    rate.current = step.state
    if (step.speak !== null) {
      window.clearTimeout(timer.current)
      timer.current = undefined
      show(step.speak)
    } else if (step.waitMs !== null && timer.current === undefined) {
      // One timer for the whole wait: a newer message only replaces the text, so the last one is spoken when the timer fires.
      timer.current = window.setTimeout(() => {
        timer.current = undefined
        const due = dueMessage(rate.current, Date.now())
        rate.current = due.state
        if (due.speak !== null) show(due.speak)
      }, step.waitMs)
    }
  }, [show])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const value = useMemo(() => announce, [announce])

  return (
    <AnnouncerContext.Provider value={value}>
      {children}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{text}</div>
    </AnnouncerContext.Provider>
  )
}
