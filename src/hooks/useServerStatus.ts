// Is the server up? (UI01). Asks GET /api/v1/health once, and again when asked. The server on Render's free tier sleeps when idle
// and takes up to a minute to wake, so a slow answer is "waking", not "offline". Never polls. The app works without the server.

import { useCallback, useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { apiBase } from '../config'
import { WAKING_AFTER_MS } from './useVoiceAssistant'

export type ServerState = 'checking' | 'waking' | 'ready' | 'offline'

/** Longer than Render's wake-up, so a sleeping server is waited for rather than given up on. */
export const HEALTH_LIMIT_MS = 75_000

/** A real health answer. A static host that answers every path with the home page (200, HTML) does not count. */
const health = z.object({ status: z.literal('ok') })

export function useServerStatus(): { state: ServerState; check: () => void } {
  const [state, setState] = useState<ServerState>('checking')
  const stopRun = useRef<() => void>(() => {})

  const run = useCallback(() => {
    stopRun.current()
    const abort = new AbortController()
    let live = true
    const slow = window.setTimeout(() => { if (live) setState('waking') }, WAKING_AFTER_MS)
    const limit = window.setTimeout(() => abort.abort(), HEALTH_LIMIT_MS)
    const finish = (ok: boolean) => {
      window.clearTimeout(slow)
      window.clearTimeout(limit)
      if (live) setState(ok ? 'ready' : 'offline')
    }
    fetch(`${apiBase()}/api/v1/health`, { signal: abort.signal })
      .then(response => (response.ok ? response.json() : null))
      .then(body => finish(health.safeParse(body).success), () => finish(false))
    stopRun.current = () => {
      live = false
      window.clearTimeout(slow)
      window.clearTimeout(limit)
      abort.abort()
    }
  }, [])

  useEffect(() => {
    run()
    return () => stopRun.current()
  }, [run])

  /** Check again now (the button after "offline"). */
  const check = useCallback(() => {
    setState('checking')
    run()
  }, [run])

  return { state, check }
}
