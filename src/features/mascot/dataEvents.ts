// What the player noticed in the music, for Echo (docs/tickets/JB06-alert-visor.md). The player publishes the events of each frame (the same events SN10
// announces, src/describe/events.ts); the dock's useDataAlerts listens. This is not the voice guide's context bus (src/assistant/context.ts): that is sent
// to the server, whose player schema rejects extra fields, and Echo's alert needs nothing from the voice model.

import type { SoundEvent } from '../../describe/events'

export type DataEvent = { kind: SoundEvent['kind']; sentence: string }
type Listener = (events: DataEvent[]) => void

/** SN10's kinds worth an alert: a new hot spot, and one that grew or shrank. Moving, going, and dropouts of readable data are announced, but not alerts. */
const NOTABLE: ReadonlySet<SoundEvent['kind']> = new Set(['appeared', 'grew', 'shrank'])

export const isNotable = (event: DataEvent) => NOTABLE.has(event.kind)

const listeners = new Set<Listener>()

/** The events of one frame (an empty list when nothing happened, or when the run stopped). */
export function publishDataEvents(events: DataEvent[]) {
  listeners.forEach(listener => listener(events))
}

export function subscribeDataEvents(listener: Listener) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
