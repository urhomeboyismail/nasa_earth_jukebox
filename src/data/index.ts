// Loads content data from public/data/ and checks it against the schemas in schema.ts.

import { catalogSchema, describeIssues, visualizationSchema } from './schema'
import type { CatalogEntry, Visualization } from './types'

export type * from './types'
export { DEFAULT_WORDS, higherPhrase, variableWords } from './words'
export { DETAIL_LEVELS, PRESET_IDS, VOICE_IDS, legendOf } from './sonification'
export type { DetailLevel, LegendKind, PresetId, VoiceId } from './sonification'
export { dateOfVideoFrame, videoFrameOf } from './video'
export { primaryRegion, regionFor } from './regions'
export { playerUpdate, storedWelcome, studyCreated } from './boundaries'

/** Content data could not be loaded or is not valid. The message names the file. */
export class DataError extends Error {
  readonly file: string

  constructor(file: string, message: string) {
    super(`${file}: ${message}`)
    this.name = 'DataError'
    this.file = file
  }
}

const CATALOG_FILE = 'index.json'

/**
 * The sentence a listener reads when data cannot be loaded. It never names a file, a status code or a validation
 * message: those stay in `DataError` for the console and the check script.
 */
export function friendlyDataMessage(error: unknown): string {
  if (error instanceof DataError && error.file === CATALOG_FILE) return 'The list of data sets could not be loaded. Reload the page.'
  return 'This data set could not be loaded. Choose another from the list, or reload the page.'
}

const dataUrl = (path: string) => `${import.meta.env.BASE_URL}data/${path}`

async function fetchJson(path: string): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(dataUrl(path))
  } catch {
    throw new DataError(path, 'could not be downloaded. Check your connection.')
  }
  if (!response.ok) throw new DataError(path, `could not be found (HTTP ${response.status}).`)
  try {
    return await response.json()
  } catch {
    throw new DataError(path, 'is not valid JSON.')
  }
}

export async function loadCatalog(): Promise<CatalogEntry[]> {
  const catalog = await fetchJson(CATALOG_FILE)
  if (!Array.isArray(catalog)) throw new DataError(CATALOG_FILE, 'must be a list of visualizations.')
  const parsed = catalogSchema.safeParse(catalog)
  if (!parsed.success) throw new DataError(CATALOG_FILE, describeIssues(parsed.error))
  return parsed.data
}

export async function loadVisualization(id: string): Promise<Visualization> {
  const path = `${id}/manifest.json`
  const parsed = visualizationSchema.safeParse(await fetchJson(path))
  if (!parsed.success) throw new DataError(path, describeIssues(parsed.error))
  const visualization = parsed.data
  return {
    ...visualization,
    // `baselineImage` is resolved the same way as `image`. The analysis reads it as a URL, so a relative path would be read against the page, not the data set.
    frames: visualization.frames.map(frame => ({
      ...frame,
      image: dataUrl(`${id}/${frame.image}`),
      ...(frame.baselineImage && { baselineImage: dataUrl(`${id}/${frame.baselineImage}`) }),
    })),
  }
}
