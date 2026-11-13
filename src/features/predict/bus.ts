// How the scripted demo asks for a question and hears when it has been answered, without importing the player (the same idea as player/controls.ts).
// `requestPredict` asks the mounted player to ask one question; `reportPredictDone` is called when it is answered, stopped, or there is nothing to ask.

const requests = new Set<() => void>()
const done = new Set<() => void>()

/** Returns true when a player took the request (false: none is mounted yet, so the caller may ask again). */
export function requestPredict(): boolean {
  const heard = [...requests]
  heard.forEach(listener => listener())
  return heard.length > 0
}

/** Returns a function that unsubscribes. */
export function onPredictRequest(listener: () => void): () => void {
  requests.add(listener)
  return () => { requests.delete(listener) }
}

export function reportPredictDone(): void {
  done.forEach(listener => listener())
}

/** Returns a function that unsubscribes. */
export function onPredictDone(listener: () => void): () => void {
  done.add(listener)
  return () => { done.delete(listener) }
}
