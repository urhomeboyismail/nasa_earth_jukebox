// Checks for data that comes from outside the page but is not a data file: the study server's answers, what the app keeps
// in local storage, and the summaries screens publish to the app's context. Data files are checked in schema.ts.

import { z } from 'zod'

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
