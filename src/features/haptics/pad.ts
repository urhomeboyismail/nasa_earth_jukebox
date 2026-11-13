// Gamepad rumble (ticket IX10): the same pattern as the phone's pulse, on every connected pad that has a vibration actuator.

/** The connected pads that can rumble. */
function rumblers(): Gamepad[] {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return []
  return Array.from(navigator.getGamepads()).filter((pad): pad is Gamepad => pad !== null && typeof pad.vibrationActuator?.playEffect === 'function')
}

/**
 * Rumbles each pad: a buzz for every even entry of the pattern, a pause for every odd one, with the strong motor at `magnitude` and the weak
 * motor at half of it. Returns how many pads were asked. A pad with no actuator is left alone.
 */
export function rumble(pattern: readonly number[], magnitude: number): number {
  const pads = rumblers()
  const level = Math.min(1, Math.max(0, magnitude))
  for (const pad of pads) {
    let at = 0
    pattern.forEach((ms, i) => {
      if (i % 2 === 0 && ms > 0) {
        try {
          void Promise.resolve(pad.vibrationActuator?.playEffect('dual-rumble', { startDelay: at, duration: ms, strongMagnitude: level, weakMagnitude: level / 2 })).catch(() => {})
        } catch {
          // A pad that refuses is skipped; the sound is the same.
        }
      }
      at += ms
    })
  }
  return pads.length
}
