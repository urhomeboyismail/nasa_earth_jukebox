// The sound recipe (docs/PLAN.md §6.3, ticket SN10): what each of the seven voices follows and what it sounds like, as a table for the About page.
// Pure text made from the detail table, so the levels can never disagree with src/sonify/. The preset is named by the caller (`preset.label`, `preset.note`).

import { DETAIL_LEVELS, VOICE_IDS, type DetailLevel, type VoiceId } from '../data/sonification'
import { DETAIL_VOICES } from '../sonify/detail'
import type { Preset } from '../sonify/types'

export type RecipeRow = {
  voice: VoiceId
  /** The voice's name as the page shows it. */
  name: string
  /** What in the picture drives it. */
  drivenBy: string
  /** What it sounds like. */
  sounds: string
  /** The first level of detail that plays it. */
  detailLevel: DetailLevel
}

const WORDS: Record<VoiceId, { name: string; drivenBy: string; sounds: string }> = {
  melody: { name: 'Melody', drivenBy: 'The middle value of the whole map, as a place on the colour legend.', sounds: 'A single line that rises and falls with the overall level.' },
  harmony: { name: 'Harmony', drivenBy: 'The mix of ranges across the map (the histogram).', sounds: 'A chord: thin when the map is of one kind, thicker when it is mixed. It changes only when the mix does.' },
  bass: { name: 'Bass', drivenBy: 'How far the map is from normal, or from where this run began when the data has no normal.', sounds: 'A low note that sits higher when the map is above normal and lower when it is below.' },
  hotspots: { name: 'Hot spots', drivenBy: 'The largest patches of the highest or lowest range: where they are and how big.', sounds: 'One short note a patch. Patches in the west sound in the left ear and patches in the east in the right; bigger patches are louder.' },
  rhythm: { name: 'Rhythm', drivenBy: 'The strongest edge in the picture and how much of the picture is edge.', sounds: 'An arpeggio that follows the edge from west to east: slow when the picture is smooth, busy when it is full of edges.' },
  motion: { name: 'Motion', drivenBy: 'How much of the picture moved since the last frame, and which way.', sounds: 'A soft pad that opens when there is more movement and leans towards the side the movement goes.' },
  time: { name: 'Time', drivenBy: 'The date.', sounds: 'A steady pulse, with a small accent at the start of a new month and a bigger one at the start of a new year.' },
}

/** The first detail level whose voices include `voice`. */
export function detailLevelOf(voice: VoiceId): DetailLevel {
  return DETAIL_LEVELS.find(level => DETAIL_VOICES[level].includes(voice)) ?? 'full'
}

/** Seven rows in the order of `VOICE_IDS`. The preset changes the key, never the rows. */
export function soundRecipe(preset: Preset): RecipeRow[] {
  void preset
  return VOICE_IDS.map(voice => ({ voice, ...WORDS[voice], detailLevel: detailLevelOf(voice) }))
}
