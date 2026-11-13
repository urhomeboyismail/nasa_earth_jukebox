// Checks for data that comes from outside the page but is not a data file: the study server's answers, what the app keeps
// in local storage, and the summaries screens publish to the app's context. Data files are checked in schema.ts.

import { z } from 'zod'
import { PRESET_IDS, VOICE_IDS } from './sonification'

/** The study server's answer to "start a test session" (`POST /api/v1/tests`). */
export const studyCreated = z.object({ id: z.string().min(1) })

/** The player's context summary, read only for whether it is playing. The rest of the summary is kept as it is. */
export const playerUpdate = z.looseObject({ playing: z.boolean().optional() })

/** The welcome's stored choice. A wrong or missing field falls back to its default instead of discarding the whole choice. */
export const storedWelcome = z.object({
  done: z.boolean().catch(false),
  speech: z.boolean().catch(false),
  path: z.enum(['screen-reader', 'map', 'play']).optional().catch(undefined),
  volume: z.number().min(0).max(1).optional().catch(undefined),
})

/**
 * The listener's sound preferences (welcome and mixer). A wrong or missing field falls back to its default. `style` null means the data set's own
 * preset. The melody is the main value, so it can never be stored as muted.
 */
export const storedAudioPrefs = z.object({
  style: z.enum(PRESET_IDS).nullable().catch(null),
  bassDb: z.number().min(-6).max(6).catch(0),
  speed: z.enum(['slow', 'normal', 'fast']).catch('normal'),
  muted: z.array(z.enum(VOICE_IDS)).catch([]).transform(voices => [...new Set(voices)].filter(voice => voice !== 'melody')),
})

