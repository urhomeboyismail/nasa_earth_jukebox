// The lists the v3 sonification uses (docs/PLAN.md §6.3), in one place. A manifest's `sonification` names values from these lists;
// src/sonify/presets.ts and src/sonify/detail.ts (SN03) define a preset for each id and a value for each detail level.

/** The artistic presets: key, scale and instruments. A preset never carries data. */
export const PRESET_IDS = ['major', 'dorian', 'pentatonic', 'cinematic', 'chiptune', 'lofi', 'bass', 'nature'] as const
export type PresetId = (typeof PRESET_IDS)[number]

/** The presets a listener picks as a music style (welcome and mixer). Each has its own instrument kit. */
export const STYLE_IDS = ['cinematic', 'chiptune', 'lofi', 'bass', 'nature'] as const satisfies readonly PresetId[]
export type StyleId = (typeof STYLE_IDS)[number]

/** How many voices play: Calm (melody, harmony, time), Standard, or Full (all seven). */
export const DETAIL_LEVELS = ['calm', 'standard', 'full'] as const
export type DetailLevel = (typeof DETAIL_LEVELS)[number]

/** The seven voices of the ensemble, in the order the captions list them. */
export const VOICE_IDS = ['melody', 'harmony', 'bass', 'hotspots', 'rhythm', 'motion', 'time'] as const
export type VoiceId = (typeof VOICE_IDS)[number]

/** The kinds of colour bar: 'data' decodes values through `colorScale`, 'picture' is true-colour imagery with no measured values. */
export type LegendKind = 'data' | 'picture'

/** A data set with no `legend` field is data; read it with this, never with `v.legend` directly. */
export function legendOf(v: { legend?: LegendKind }): LegendKind {
  return v.legend ?? 'data'
}
