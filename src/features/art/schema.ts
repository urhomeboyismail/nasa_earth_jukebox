// What may be read from outside in art mode (ticket IX12): a preset file the listener imports and the list kept in the browser. Strict, so a
// file with a field art mode does not have is refused rather than half used. SN03 has no runtime schema for `Preset`, so this one is built here.

import { z } from 'zod'
import { BPM_RANGE, BRIGHTNESS_RANGE, MAX_NAME_LENGTH, MAX_SAVED, SCALE_NAMES, TONIC_RANGE, type ArtPreset } from './presets'

export const artPresetSchema = z.strictObject({
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  tonic: z.number().int().min(TONIC_RANGE.min).max(TONIC_RANGE.max),
  scale: z.enum(SCALE_NAMES),
  bpm: z.number().min(BPM_RANGE.min).max(BPM_RANGE.max),
  brightness: z.number().min(BRIGHTNESS_RANGE.min).max(BRIGHTNESS_RANGE.max),
})

export const artListSchema = z.array(artPresetSchema).max(MAX_SAVED)

export type ParsedPreset = { ok: true; preset: ArtPreset } | { ok: false; message: string }

/** Reads the text of an imported file. A refusal carries a sentence the listener can read. */
export function parsePresetFile(text: string): ParsedPreset {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, message: 'That file is not a preset: it is not JSON.' }
  }
  const result = artPresetSchema.safeParse(json)
  if (result.success) return { ok: true, preset: result.data }
  const issue = result.error.issues[0]
  const where = issue.path.length ? ` (${issue.path.join('.')})` : ''
  return { ok: false, message: `That file is not a preset${where}: ${issue.message}.` }
}

/** The file the Export button makes. */
export function presetFileText(preset: ArtPreset): string {
  return `${JSON.stringify(artPresetSchema.parse(preset), null, 2)}\n`
}
