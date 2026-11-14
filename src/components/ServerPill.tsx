import { useEffect, useRef } from 'react'
import { useServerStatus, type ServerState } from '../hooks/useServerStatus'
import { Button } from './Button'
import { useAnnounce } from './useAnnounce'

const TEXT: Record<ServerState, string> = {
  checking: 'Checking server…',
  ready: 'Server ready',
  waking: 'Server waking, this can take a minute',
  offline: 'Server offline: the app still works',
}

/** The dot's accent. Colour is never the only cue: the words say the same. */
const ACCENT: Record<ServerState, string> = { checking: '', ready: 'ui-pill--forest', waking: 'ui-pill--fire', offline: 'ui-pill--error' }

/**
 * Whether the voice guide and the other server features can be reached (UI01), in the header. It checks once and says so politely
 * when the server is waking or offline, and when it comes back. "Server ready" on a normal load is not announced: that is noise.
 */
export function ServerPill() {
  const { state, check } = useServerStatus()
  const announce = useAnnounce()
  const trouble = useRef(false)

  useEffect(() => {
    if (state === 'waking' || state === 'offline') {
      trouble.current = true
      announce(TEXT[state])
    } else if (state === 'ready' && trouble.current) {
      trouble.current = false
      announce(TEXT.ready)
    }
  }, [state, announce])

  return (
    <div className="app-server">
      <span className={`ui-pill ${ACCENT[state]}`.trim()} data-state={state}>
        <span className="ui-pill__dot" aria-hidden="true" />
        {TEXT[state]}
      </span>
      {state === 'offline' && <Button variant="text" onClick={check}>Check again</Button>}
    </div>
  )
}
