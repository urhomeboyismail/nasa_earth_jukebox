// The ensemble's lifecycle (docs/PLAN.md §6.3, ticket SN04): the status a listener can trust, and the two events that change it without a click.
// The browser can suspend the audio context (a tab in the background, a phone call) and the page can be hidden. Neither is undone by the
// code: sound comes back only when the listener presses Play again (start()), never on a timer or on focus.

import type { EnsembleStatus } from './types'

export function createStatus() {
  let value: EnsembleStatus = 'off'
  const listeners = new Set<(status: EnsembleStatus) => void>()
  return {
    get: () => value,
    set(next: EnsembleStatus) {
      if (next === value) return
      value = next
      for (const listener of [...listeners]) listener(next)
    },
    subscribe(listener: (status: EnsembleStatus) => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    clear() { listeners.clear() },
  }
}

/** Calls `onHidden` when the page is hidden and `onVisible` when it is shown again. Returns the function that removes the listener. */
export function watchVisibility(onHidden: () => void, onVisible: () => void): () => void {
  if (typeof document === 'undefined') return () => {}
  const handler = () => (document.hidden ? onHidden() : onVisible())
  document.addEventListener('visibilitychange', handler)
  return () => document.removeEventListener('visibilitychange', handler)
}

/** Calls `onState` with the audio context's state each time the browser changes it. Returns the function that removes the listener. */
export function watchContext(raw: Pick<BaseAudioContext, 'state' | 'addEventListener' | 'removeEventListener'>, onState: (state: AudioContextState) => void): () => void {
  const handler = () => onState(raw.state)
  raw.addEventListener('statechange', handler)
  return () => raw.removeEventListener('statechange', handler)
}
