// Whether the mascot shows (F37 T2): the welcome on Home and its face beside the demo caption. On by default; the help button
// stays either way, because it is the way back. Remembered on this device; storage can be blocked, so the choice is also kept
// in memory for this visit.

import { readStored, useStoredValue, writeStoredText } from '../../hooks/useStoredValue'

const KEY = 'earth-jukebox:mascot'

const parseMascotOn = (stored: string) => stored !== 'off'
/** On is the default, so it is stored as nothing. */
const serializeMascotOn = (on: boolean) => (on ? null : 'off')

/** True unless the listener turned the mascot off. */
export function readMascotOn(): boolean {
  return readStored(KEY, parseMascotOn, true)
}

export function setMascotOn(on: boolean) {
  writeStoredText(KEY, serializeMascotOn(on))
}

export function useMascotOn(): boolean {
  return useStoredValue(KEY, parseMascotOn, true, serializeMascotOn)[0]
}
