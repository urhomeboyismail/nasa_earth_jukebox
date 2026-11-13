// Says what changed between one frame of the music and the next (docs/PLAN.md §6.3, ticket SN10). The sentences come from src/describe/events.ts; the
// rate limit from src/describe/announce.ts, so a screen reader is not flooded. Lives with the player because it needs the player's frames; the rules
// stay in src/describe/, which is pure.

import { useEffect, useRef } from 'react'
import type { FrameFeatures } from '../../analysis/features/types'
import { useAnnounce } from '../../components'
import { AnnounceLimiter } from '../../describe/announce'
import { describeEvent, eventsBetween, type EventWords } from '../../describe/events'
import { publishDataEvents } from '../mascot/dataEvents'

/**
 * Announces the events from the last frame to this one, through `useAnnounce`, at most as often as the limiter allows. `features` null (before the first
 * frame, and after Stop) forgets the last frame, so the first frame of the next run announces nothing. Events are sent as `busy`, so the live region's
 * own 1.5 s throttle applies as well.
 */
export function useEventAnnouncer(features: FrameFeatures | null, words: EventWords) {
  const announce = useAnnounce()
  const limiter = useRef(new AnnounceLimiter())
  const last = useRef<FrameFeatures | null>(null)

  useEffect(() => {
    const before = last.current
    last.current = features
    if (!features) { publishDataEvents([]); return }
    if (features === before) return
    const events = eventsBetween(before, features)
    // JB06: Echo's visor shows the same events, one list a frame. Not rate limited here: the hook that listens keeps its own gap.
    publishDataEvents(events.map(event => ({ kind: event.kind, sentence: describeEvent(event, words) })))
    for (const event of events) {
      const text = describeEvent(event, words)
      if (limiter.current.offer(text, 'event')) announce(text, { busy: true })
    }
  }, [features, words, announce])
}
