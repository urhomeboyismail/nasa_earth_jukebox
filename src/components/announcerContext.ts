import { createContext } from 'react'

/** `busy` marks a message sent while a sequence or sweep is playing: the announcer then speaks at most one per 1.5 s, newest first (announceRate.ts). Without it the message is spoken at once, as before. */
export type AnnounceOptions = { busy?: boolean }
export type Announce = (text: string, options?: AnnounceOptions) => void

export const AnnouncerContext = createContext<Announce>(() => {})
