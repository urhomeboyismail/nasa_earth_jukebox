// "My mix" (ticket IX06): which voices the listener has muted, and which one is solo, kept on this device under one key and read through zod. It holds no solo or
// mute logic: the mixer (SN07, symphonyState.ts) applies a mix. A voice the ensemble does not have is dropped when the mix is read, never guessed at, and a store
// that is missing, blocked or broken gives the default mix (everything on). The ensemble has no level for a single voice, so a mix is the mutes and the solo.

import { z } from 'zod'
import { VOICE_IDS, type VoiceId } from '../../data'

export const MY_MIX_KEY = 'earth-jukebox:my-mix'

export type SoundMix = { muted: VoiceId[]; solo: VoiceId | null }

/** Everything on, nothing solo. */
export const DEFAULT_MIX: SoundMix = { muted: [], solo: null }

const stored = z.object({ muted: z.array(z.string()), solo: z.string().nullable() })

const isVoice = (name: string): name is VoiceId => (VOICE_IDS as readonly string[]).includes(name)

/** A mix with its voices in the mixer's order, each once, and only the ones that exist. */
export function cleanMix(mix: { muted: readonly string[]; solo: string | null }): SoundMix {
  return {
    muted: VOICE_IDS.filter(voice => mix.muted.includes(voice)),
    solo: mix.solo !== null && isVoice(mix.solo) ? mix.solo : null,
  }
}

/** The saved mix, or the default when there is none or it cannot be read. */
export function readMyMix(): SoundMix {
  try {
    const raw = localStorage.getItem(MY_MIX_KEY)
    if (raw === null) return DEFAULT_MIX
    const parsed = stored.safeParse(JSON.parse(raw))
    return parsed.success ? cleanMix(parsed.data) : DEFAULT_MIX
  } catch {
    return DEFAULT_MIX
  }
}

/** Whether a mix has been saved on this device (and can be read). */
export function hasMyMix(): boolean {
  try {
    const raw = localStorage.getItem(MY_MIX_KEY)
    return raw !== null && stored.safeParse(JSON.parse(raw)).success
  } catch {
    return false
  }
}

/** Keeps the mix. Returns false when the device would not keep it (storage blocked or full). */
export function saveMyMix(mix: SoundMix): boolean {
  try {
    localStorage.setItem(MY_MIX_KEY, JSON.stringify(cleanMix(mix)))
    return true
  } catch {
    return false
  }
}
