import { useContext } from 'react'
import { AnnouncerContext, type Announce } from './announcerContext'

/** Returns `announce(text)`. Does nothing outside an AnnouncerProvider, so components still work in isolation. */
export function useAnnounce(): Announce {
  return useContext(AnnouncerContext)
}
