// Echo's one call for live data (G11: POST /api/v1/mascot/query). The server fetches a series from Microsoft Planetary Computer and
// answers with a reply built from the numbers (never model text), a theme, and an AudioPayload. It never throws: every outcome is a value.
// The app's own catalog goes with the question, so the server can say an app data set already answers it.

import { z } from 'zod'
import { apiBase } from '../../config'
import type { CatalogEntry } from '../../data'
import type { JukeboxErrorKind } from './generate'
import { audioPayloadSchema, type AudioPayload } from './payload'

const PATH = '/api/v1/mascot/query'

/** The same limits as the server. */
export const MAX_PROMPT_CHARS = 300
const MAX_CATALOG = 40

export type AudioPreference = 'gentle' | 'normal' | 'bold'
export type DatasetTheme = 'ocean' | 'atmosphere' | 'forest' | 'default'

export type MascotAnswer = {
  reply: string
  theme: DatasetTheme
  /** Null when nothing was found, or the payload did not pass. */
  audio: AudioPayload | null
  /** One of the catalog ids that were sent, when an app data set answers the question. */
  localId: string | null
}

export type MascotResult =
  | { kind: 'answer'; answer: MascotAnswer }
  | { kind: 'error'; error: JukeboxErrorKind; retryAfter?: number }

const answerSchema = z.object({
  mascot_reply: z.string().min(1),
  dataset_theme: z.enum(['ocean', 'atmosphere', 'forest', 'default']).catch('default'),
  sonification_json: z.unknown(),
  local_dataset_id: z.string().nullish(),
})

function errorFor(status: number): JukeboxErrorKind {
  if (status === 429) return 'rate'
  if (status === 502 || status === 504) return 'model'
  if (status === 503) return 'off'
  return 'unreachable'
}

export async function queryMascot(
  input: { prompt: string; preference: AudioPreference; catalog: CatalogEntry[] },
  signal?: AbortSignal,
): Promise<MascotResult> {
  const catalog = input.catalog.slice(0, MAX_CATALOG)
  try {
    const response = await fetch(`${apiBase()}${PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_prompt: input.prompt, audio_preference: input.preference, catalog }),
      signal,
    })
    if (response.status !== 200) {
      const wait = Number(response.headers.get('Retry-After'))
      const retryAfter = response.status === 429 && Number.isInteger(wait) && wait > 0 ? wait : undefined
      return { kind: 'error', error: errorFor(response.status), ...(retryAfter && { retryAfter }) }
    }
    const parsed = answerSchema.safeParse(await response.json())
    if (!parsed.success) return { kind: 'error', error: 'model' }
    const { mascot_reply, dataset_theme, sonification_json, local_dataset_id } = parsed.data
    const audio = audioPayloadSchema.safeParse(sonification_json)
    const localId = catalog.some(entry => entry.id === local_dataset_id) ? (local_dataset_id ?? null) : null
    return { kind: 'answer', answer: { reply: mascot_reply, theme: dataset_theme, audio: audio.success ? audio.data : null, localId } }
  } catch {
    return { kind: 'error', error: 'unreachable' }
  }
}
