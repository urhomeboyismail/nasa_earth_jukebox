// A short phrase in a style, for the "Play sample" button: five notes up the style's scale, through the real ensemble and its kit.
// Called from a click only (the ensemble starts the audio there, WCAG 1.4.2). The ensemble is disposed when the phrase has ended.

import { createEnsemble } from '../../audio/ensemble'
import type { Ensemble } from '../../audio/ensemble/types'
import { SCALES } from '../../sonify/presets'
import type { Preset } from '../../sonify/types'

const NOTE_S = 0.35
const ROOT_MIDI = 60

/** The midi notes of the sample: the first five steps of the scale, from the style's key. */
export function sampleNotes(preset: Preset): number[] {
  const scale = SCALES[preset.scale]
  return Array.from({ length: 5 }, (_, i) => ROOT_MIDI + preset.tonic + scale[i % scale.length] + 12 * Math.floor(i / scale.length))
}

let playing: Ensemble | null = null

/** Plays the sample, stopping one that is still playing. Resolves when it has been scheduled. */
export async function playSample(preset: Preset, volume = 0.8): Promise<void> {
  playing?.dispose()
  const ensemble = createEnsemble(preset, { volume })
  playing = ensemble
  await ensemble.start()
  const start = ensemble.now()
  sampleNotes(preset).forEach((midi, i) => ensemble.playNotes([{ midi, level: 0.8, pan: 0, seconds: NOTE_S * 0.9 }], start + i * NOTE_S))
  window.setTimeout(() => {
    if (playing === ensemble) playing = null
    ensemble.dispose()
  }, (NOTE_S * 6 + 1) * 1000)
}
