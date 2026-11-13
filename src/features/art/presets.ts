// Art mode's rules (docs/PLAN.md §6.3, ticket IX12), pure. The listener may change four fields of SN03's `Preset`: the key, the scale, the tempo and the
// brightness. Nothing else is editable, and nothing here touches the ruleset, so the mapping from a picture to the music does not change.

import type { Preset, ScaleName } from '../../sonify/types'

/** The panel's heading and first line, and so its accessible description. */
export const ART_LABEL = "Art mode: the sound choices are yours; the data mapping doesn't change."

/** The only fields of a `Preset` that art mode reads or writes. */
export const ART_FIELDS = ['tonic', 'scale', 'bpm', 'brightness'] as const
export type ArtField = (typeof ART_FIELDS)[number]
export type ArtChoice = Pick<Preset, ArtField>

/** Every scale SN03 knows, in the order the buttons show them. */
export const SCALE_NAMES = ['major', 'dorian', 'minorPentatonic'] as const satisfies readonly ScaleName[]

export const SCALE_LABELS: Record<ScaleName, string> = { major: 'Major', dorian: 'Dorian', minorPentatonic: 'Minor pentatonic' }

/** Pitch-class names, C = 0. Sharps are spelled out so a screen reader says them. */
export const KEY_NAMES = ['C', 'C sharp', 'D', 'D sharp', 'E', 'F', 'F sharp', 'G', 'G sharp', 'A', 'A sharp', 'B'] as const

export const TONIC_RANGE = { min: 0, max: 11 } as const
export const BPM_RANGE = { min: 60, max: 120 } as const
export const BRIGHTNESS_RANGE = { min: 0, max: 1 } as const

/** At most this many named presets are kept. */
export const MAX_SAVED = 10
/** The longest name a preset may have. */
export const MAX_NAME_LENGTH = 40

/** A named choice, as it is stored and as it is exported. */
export type ArtPreset = { name: string } & ArtChoice

const isScale = (value: unknown): value is ScaleName => SCALE_NAMES.some(name => name === value)
const inRange = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max

/** The four editable fields of a preset. */
export function choiceOf(preset: Preset): ArtChoice {
  return { tonic: preset.tonic, scale: preset.scale, bpm: preset.bpm, brightness: preset.brightness }
}

/**
 * A new preset: `base` with the listener's choice applied. Only the four editable fields may be given; any other field, or a value out of range, is
 * refused with an error that says which. The base's own id, label and note stay, and `base` is not changed.
 */
export function applyChoice(base: Preset, patch: Readonly<Record<string, unknown>>): Preset {
  const next: Preset = { ...base }
  for (const [field, value] of Object.entries(patch)) {
    if (value === undefined) continue
    if (field === 'tonic' && inRange(value, TONIC_RANGE.min, TONIC_RANGE.max) && Number.isInteger(value)) next.tonic = value
    else if (field === 'scale' && isScale(value)) next.scale = value
    else if (field === 'bpm' && inRange(value, BPM_RANGE.min, BPM_RANGE.max)) next.bpm = value
    else if (field === 'brightness' && inRange(value, BRIGHTNESS_RANGE.min, BRIGHTNESS_RANGE.max)) next.brightness = value
    else throw new Error(ART_FIELDS.some(name => name === field) ? `The value for ${field} is not allowed.` : `${field} cannot be changed in art mode.`)
  }
  return next
}

/** The preset the ensemble plays: the base with the choice applied, labelled with the listener's name for it. */
export function presetFromArt(base: Preset, art: ArtPreset): Preset {
  const { name, ...choice } = art
  return { ...applyChoice(base, choice), label: name }
}

/** "C major, 84 beats a minute, brightness 50 percent": the choice in words. */
export function describeChoice(choice: ArtChoice): string {
  return `${KEY_NAMES[choice.tonic]} ${SCALE_LABELS[choice.scale].toLowerCase()}, ${choice.bpm} beats a minute, brightness ${Math.round(choice.brightness * 100)} percent`
}

/** A file-name-safe form of a name: lower case letters, digits and hyphens. */
export function slug(name: string): string {
  const text = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return text || 'preset'
}
