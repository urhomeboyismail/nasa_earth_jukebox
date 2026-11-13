// Dispatch (ticket IX01). Every source (keyboard, pointer, gamepad) builds an `Action` and calls `dispatch`; the tickets that act on it register a handler.
// Nothing is queued: `dispatch` runs the handlers on the same tick, in the order they registered, so a test sees the result at once.

import { useEffect, useRef } from 'react'
import type { Action, ActionOf, ActionType } from './actions'

type Handler = (action: Action) => void

const handlers = new Map<ActionType, Handler[]>()

/** Runs every handler registered for this kind of action and returns true if there was one. An action with no handler does nothing, so the key that made it can carry on. */
export function dispatch(action: Action): boolean {
  const list = [...(handlers.get(action.type) ?? [])]
  for (const handler of list) handler(action)
  return list.length > 0
}

/** Registers a handler outside React (a test, a gamepad bridge). Returns the way to remove it. A component uses `useActionHandler`. */
export function addActionHandler(type: ActionType, handler: Handler): () => void {
  const list = handlers.get(type) ?? []
  list.push(handler)
  handlers.set(type, list)
  return () => {
    const now = handlers.get(type)
    if (!now) return
    const at = now.indexOf(handler)
    if (at >= 0) now.splice(at, 1)
    if (now.length === 0) handlers.delete(type)
  }
}

/**
 * Registers `handler` for one kind of action while the component is mounted. The newest `handler` is always the one called, so it need not be stable,
 * and a new one does not change the order handlers run in. Registering is not state, so it belongs in an effect.
 */
export function useActionHandler<T extends ActionType>(type: T, handler: (action: ActionOf<T>) => void): void {
  const latest = useRef(handler)
  useEffect(() => {
    latest.current = handler
  })
  useEffect(() => addActionHandler(type, action => latest.current(action as ActionOf<T>)), [type])
}

/** For tests only. */
export function resetActionHandlers(): void {
  handlers.clear()
}
