// The words for a failed call to the Jukebox or Echo's live data route, shared by Jukebox Studio and the Live page (G13).

import type { JukeboxErrorKind } from './generate'

const ERRORS: Record<JukeboxErrorKind, string> = {
  rate: 'Too many requests just now. Wait a moment, then try again.',
  model: 'The orchestrator could not finish this one. Try again, or ask in a different way.',
  off: 'The Jukebox is switched off on this server.',
  unreachable: 'The server could not be reached. Is it running?',
}

/** On the Live page a 503 means live data is off, not the Jukebox (the visitor has not heard of the Jukebox route). */
const LIVE_OFF = 'Live data is switched off on this server.'

/** The message for an error, with the server's wait when it gave one. `source` is 'live' for the Live page, 'jukebox' (the default) for Studio. */
export function errorText(error: JukeboxErrorKind, retryAfter?: number, source: 'jukebox' | 'live' = 'jukebox'): string {
  if (error === 'rate' && retryAfter) return `Too many requests just now. Try again in about ${retryAfter} second${retryAfter === 1 ? '' : 's'}.`
  if (error === 'off' && source === 'live') return LIVE_OFF
  return ERRORS[error]
}
