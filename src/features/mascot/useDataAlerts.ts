// Echo's visor goes to its alert symbol when the data does something notable (docs/tickets/JB06-alert-visor.md). The event's sentence is offered as a tip
// with mood 'alert' and waits in the bubble until the listener opens it. No speech and no sound: SN10 already announces the event.

import { useEffect } from 'react'
import { isNotable, subscribeDataEvents } from './dataEvents'
import { useMascotGuide } from './useMascotGuide'

/** How long the alert shows. */
export const ALERT_MS = 3000
/** At least this long between two alerts, so a noisy data set does not keep Echo in alert. */
export const ALERT_GAP_MS = 5000

export function useDataAlerts(enabled = true) {
  const { offerTip, clearTip } = useMascotGuide()

  useEffect(() => {
    if (!enabled) return
    let lastAlert = -Infinity
    let timer = 0
    let active = false

    const clear = () => {
      window.clearTimeout(timer)
      if (active) { active = false; clearTip() }
    }
    const unsubscribe = subscribeDataEvents(events => {
      const notable = events.find(isNotable)
      if (!notable) { clear(); return }
      const now = Date.now()
      if (now - lastAlert < ALERT_GAP_MS) return
      lastAlert = now
      window.clearTimeout(timer)
      active = true
      offerTip({ text: notable.sentence, mood: 'alert' })
      timer = window.setTimeout(clear, ALERT_MS)
    })
    return () => { unsubscribe(); clear() }
  }, [enabled, offerTip, clearTip])
}
