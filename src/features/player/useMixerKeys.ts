// The mixer from the keyboard (ticket IX06). The `voice` action (1 to 7 solo, Shift + 1 to 7 mute, as the shortcut list binds them) changes the one mixer that SN07
// already has (`useSymphony`'s toggleSolo and toggleMute, which call the ensemble's solo and mute). This file builds no second mixer. Each change plays one short melody
// note (a solo as it is, a mute a fifth lower) and is recorded, so Ctrl+Z puts the mix back as it was.
//
// A key for a voice that this data set or this level of detail does not have changes nothing and says so. The sound is only made when it is already on.

import { useMemo } from 'react'
import { useAnnounce } from '../../components'
import type { Visualization, VoiceId } from '../../data'
import { noteForPosition } from '../../interaction/notes'
import { recordUndo, undoLast } from '../../interaction/history'
import { useActionHandler } from '../../interaction/registry'
import { presetFor } from '../../sonify'
import { VOICE_WORDS, type Symphony } from './symphonyState'

/** The one note a change plays, and how loud: well under the music. */
export const MIXER_NOTE_SECONDS = 0.12
const MIXER_NOTE_LEVEL = 0.5
const FIFTH = 7

/** A voice's state in words, for the mixer list: "melody: solo". Another voice being solo silences it. */
export function voiceState(voice: VoiceId, muted: ReadonlySet<VoiceId>, solo: VoiceId | null): string {
  const state = solo === voice ? 'solo' : muted.has(voice) ? 'muted' : solo !== null ? 'silent while another voice is solo' : 'on'
  return `${VOICE_WORDS[voice]}: ${state}`
}

type Options = Pick<Symphony, 'voices' | 'muted' | 'solo' | 'toggleMute' | 'toggleSolo' | 'setMix' | 'ensemble'> & { visualization: Visualization }

export function useMixerKeys({ visualization, voices, muted, solo, toggleMute, toggleSolo, setMix, ensemble }: Options) {
  const announce = useAnnounce()
  const preset = useMemo(() => presetFor(visualization.sonification?.preset ?? 'major'), [visualization.sonification?.preset])

  useActionHandler('voice', ({ voice, how }) => {
    if (!voices.includes(voice)) {
      const word = VOICE_WORDS[voice]
      announce(`${word.charAt(0).toUpperCase()}${word.slice(1)} is not in this level of detail.`)
      return
    }
    const before = { muted, solo }
    if (how === 'solo') toggleSolo(voice)
    else toggleMute(voice)
    recordUndo('mix', () => setMix(before.muted, before.solo))
    if (ensemble.status() === 'on') {
      const note = noteForPosition(0.5, preset)
      ensemble.playNotes([{ midi: how === 'mute' ? note - FIFTH : note, level: MIXER_NOTE_LEVEL, seconds: MIXER_NOTE_SECONDS, pan: 0 }])
    }
  })

  // Ctrl+Z, Cmd+Z and the gamepad's View button put back the last change of the mix.
  useActionHandler('undo', () => {
    if (undoLast() === null) announce('Nothing to undo.')
  })
}
