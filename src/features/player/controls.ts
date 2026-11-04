// Playback commands (docs/PLAN.md §5.4), so the voice guide can control the player without importing it.

export type PlayerCommand = 'play' | 'pause' | 'stop' | 'replay' | 'next' | 'previous' | { setDate: string }

const listeners = new Set<(command: PlayerCommand) => void>()

export function sendPlayerCommand(command: PlayerCommand) {
  listeners.forEach(listener => listener(command))
}

/** Returns a function that unsubscribes. */
export function onPlayerCommand(listener: (command: PlayerCommand) => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
