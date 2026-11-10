// The ruleset's public API (docs/PLAN.md §6.3, ticket SN03): `FrameFeatures` in, `MusicFrame` out. Pure: no DOM, no Tone, no network.

export { toMusicFrame } from './music'
export { PRESETS, SCALES, presetFor, snapToScale } from './presets'
export { DETAIL_VOICES, voicesFor } from './detail'
export { captionsFor, levelWord, sectorOf, trendOf } from './captions'
export * from './ranges'
export type { DetailLevel, MusicFrame, Preset, PresetId, ScaleName, VoiceId } from './types'
