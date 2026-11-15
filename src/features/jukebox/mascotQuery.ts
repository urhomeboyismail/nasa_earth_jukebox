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
  /** WX02: every value behind the sound, one per step. Null when none was sent, or it did not pass. */
  series: Series | null
  /** G12: the dated pictures of the area, or null when there are none or they did not pass. */
  pictures: LivePictures | null
}

/** More than the server ever sends (a week of hours, or a year of days). */
const MAX_SERIES = 400

const seriesSchema = z
  .object({
    metric: z.string().min(1).max(80),
    unit: z.string().max(12),
    times: z.array(z.string().max(40)).min(1).max(MAX_SERIES),
    values: z.array(z.number()).min(1).max(MAX_SERIES),
  })
  .refine(series => series.times.length === series.values.length)

/** The numbers Echo fetched. Labels come from the server, so nothing here is specific to one kind of data. */
export type Series = z.infer<typeof seriesSchema>

export type MascotResult =
  | { kind: 'answer'; answer: MascotAnswer }
  | { kind: 'error'; error: JukeboxErrorKind; retryAfter?: number }

/** Trust boundary (G12): the page loads pictures from this one place only. The server builds the URLs; the model never sees them. */
export const IMAGE_URL_PREFIX = 'https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/'
export const MAX_IMAGES = 6

const byte = z.number().int().min(0).max(255)
const stopsSchema = z
  .array(z.object({ value: z.number(), rgb: z.tuple([byte, byte, byte]) }))
  .min(2)
  .refine(stops => stops.every((stop, i) => i === 0 || stop.value > stops[i - 1].value), 'stops must rise')

const picturesSchema = z.object({
  images: z
    .array(z.object({ date: z.iso.date(), url: z.string().startsWith(IMAGE_URL_PREFIX) }))
    .min(1)
    .max(MAX_IMAGES),
  legend: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('data'), unit: z.string().min(1).max(20), stops: stopsSchema }),
    z.object({ kind: z.literal('picture') }),
  ]),
  area: z
    .tuple([z.number().min(-180).max(180), z.number().min(-90).max(90), z.number().min(-180).max(180), z.number().min(-90).max(90)])
    .refine(([west, south, east, north]) => west < east && south < north, 'west must be below east and south below north'),
})

export type LivePictures = z.infer<typeof picturesSchema>
export type ImageLegend = LivePictures['legend']
export type LiveImage = LivePictures['images'][number]

const answerSchema = z.object({
  mascot_reply: z.string().min(1),
  dataset_theme: z.enum(['ocean', 'atmosphere', 'forest', 'default']).catch('default'),
  sonification_json: z.unknown(),
  local_dataset_id: z.string().nullish(),
  series: z.unknown().optional(),
  // G12. Missing (an older server) or anything invalid: no pictures, and the rest of the answer still shows.
  images: z.unknown().optional(),
  image_legend: z.unknown().optional(),
  image_area: z.unknown().optional(),
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
    const { mascot_reply, dataset_theme, sonification_json, local_dataset_id, images, image_legend, image_area } = parsed.data
    const audio = audioPayloadSchema.safeParse(sonification_json)
    const series = seriesSchema.safeParse(parsed.data.series)
    const localId = catalog.some(entry => entry.id === local_dataset_id) ? (local_dataset_id ?? null) : null
    const pictures = picturesSchema.safeParse({ images, legend: image_legend, area: image_area })
    return {
      kind: 'answer',
      answer: {
        reply: mascot_reply,
        theme: dataset_theme,
        audio: audio.success ? audio.data : null,
        localId,
        series: series.success ? series.data : null,
        pictures: pictures.success ? pictures.data : null,
      },
    }
  } catch {
    return { kind: 'error', error: 'unreachable' }
  }
}
