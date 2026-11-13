// The named presets kept on this device (ticket IX12). At most 10. Storage can be blocked, so every access is guarded: a read that fails or finds a
// list that does not validate is "none", and a write that fails keeps the list for this visit only.

import { MAX_SAVED, type ArtPreset } from './presets'
import { artListSchema } from './schema'

export const ART_PRESETS_KEY = 'earth-jukebox:art-presets'

export function readPresets(): ArtPreset[] {
  try {
    const text = localStorage.getItem(ART_PRESETS_KEY)
    if (text === null) return []
    const result = artListSchema.safeParse(JSON.parse(text))
    return result.success ? result.data : []
  } catch {
    return []
  }
}

export function writePresets(list: readonly ArtPreset[]): void {
  try {
    localStorage.setItem(ART_PRESETS_KEY, JSON.stringify(list))
  } catch {
    // Not remembered, but the list still holds for this visit.
  }
}

export type Change = { ok: true; list: ArtPreset[] } | { ok: false; message: string }

/** Saves under a name; the same name replaces the earlier one. A new name beyond the tenth is refused. */
export function savePreset(list: readonly ArtPreset[], preset: ArtPreset): Change {
  const name = preset.name.trim()
  if (!name) return { ok: false, message: 'Give the preset a name first.' }
  const at = list.findIndex(item => item.name === name)
  if (at < 0 && list.length >= MAX_SAVED) return { ok: false, message: `You can keep ${MAX_SAVED} presets. Delete one to save another.` }
  const saved = { ...preset, name }
  return { ok: true, list: at < 0 ? [...list, saved] : list.map((item, i) => (i === at ? saved : item)) }
}

export function renamePreset(list: readonly ArtPreset[], from: string, to: string): Change {
  const name = to.trim()
  if (!name) return { ok: false, message: 'Give the preset a name first.' }
  if (name !== from && list.some(item => item.name === name)) return { ok: false, message: `There is already a preset called ${name}.` }
  return { ok: true, list: list.map(item => (item.name === from ? { ...item, name } : item)) }
}

export function deletePreset(list: readonly ArtPreset[], name: string): ArtPreset[] {
  return list.filter(item => item.name !== name)
}
