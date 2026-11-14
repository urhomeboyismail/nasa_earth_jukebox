// The browser's one call to the Jukebox orchestrator (G08: POST /api/v1/jukebox/generate). It never throws: every outcome is a value.
// A model wrote the answer, so the audio is checked before it can play, and a vision half that does not pass is dropped.

import { z } from 'zod'
import { apiBase } from '../../config'
import { audioPayloadSchema, parseVisionPayload, type AudioPayload, type VisionPayload } from './payload'

const PATH = '/api/v1/jukebox/generate'

/** The same limit as the server. */
export const MAX_QUERY_CHARS = 300

export type JukeboxRequest = { query: string; contrast: 'high' | 'low'; detailLevel: 'verbose' | 'brief' }

export type JukeboxAnswer = {
  /** False when the auditor did not approve the result. */
  approved: boolean
  /** The auditor's note. A model wrote it: show it only where it is marked as such. */
  feedback: string
  audio: AudioPayload
  vision: VisionPayload | null
}

/** `rate`: too many runs (429). `model`: the run failed or answered wrongly (502, 504, a bad answer). `off`: the route is off (503). */
export type JukeboxErrorKind = 'rate' | 'model' | 'off' | 'unreachable'

export type JukeboxResult =
  | { kind: 'answer'; answer: JukeboxAnswer }
  | { kind: 'nothing' }
  /** `retryAfter`: whole seconds to wait, from the server's Retry-After, on a 429 that sent one. */
  | { kind: 'error'; error: JukeboxErrorKind; retryAfter?: number }

const answerSchema = z.object({
  approved: z.boolean(),
  feedback: z.string().default(''),
  audio: z.unknown(),
  vision: z.unknown().optional(),
})

function errorFor(status: number): JukeboxErrorKind {
  if (status === 429) return 'rate'
  if (status === 502 || status === 504) return 'model'
  if (status === 503) return 'off'
  return 'unreachable'
}

export async function generateJukebox(request: JukeboxRequest, signal?: AbortSignal): Promise<JukeboxResult> {
  try {
    const response = await fetch(`${apiBase()}${PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: request.query, accessibilityProfile: { contrast: request.contrast, detailLevel: request.detailLevel } }),
      signal,
    })
    if (response.status !== 200) {
      const wait = Number(response.headers.get('Retry-After'))
      const retryAfter = response.status === 429 && Number.isInteger(wait) && wait > 0 ? wait : undefined
      return { kind: 'error', error: errorFor(response.status), ...(retryAfter && { retryAfter }) }
    }
    const parsed = answerSchema.safeParse(await response.json())
    if (!parsed.success) return { kind: 'error', error: 'model' }
    const { approved, feedback, audio, vision } = parsed.data
    if (audio === null || audio === undefined) return { kind: 'nothing' }
    const checked = audioPayloadSchema.safeParse(audio)
    if (!checked.success) return { kind: 'error', error: 'model' }
    return { kind: 'answer', answer: { approved, feedback, audio: checked.data, vision: parseVisionPayload(vision) } }
  } catch {
    return { kind: 'error', error: 'unreachable' }
  }
}
