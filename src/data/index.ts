// Loads content data from public/data/ and checks it against the schemas in schema.ts.

import { catalogSchema, describeIssues, visualizationSchema } from './schema'
import type { CatalogEntry, Visualization } from './types'

export type * from './types'

/** Content data could not be loaded or is not valid. The message names the file. */
export class DataError extends Error {
  readonly file: string

  constructor(file: string, message: string) {
    super(`${file}: ${message}`)
    this.name = 'DataError'
    this.file = file
  }
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
  const catalog = await fetchJson('index.json')
  if (!Array.isArray(catalog)) throw new DataError('index.json', 'must be a list of visualizations.')
  const parsed = catalogSchema.safeParse(catalog)
  if (!parsed.success) throw new DataError('index.json', describeIssues(parsed.error))
  return parsed.data
}

export async function loadVisualization(id: string): Promise<Visualization> {
  const path = `${id}/manifest.json`
  const parsed = visualizationSchema.safeParse(await fetchJson(path))
  if (!parsed.success) throw new DataError(path, describeIssues(parsed.error))
  const visualization = parsed.data
  return {
    ...visualization,
    frames: visualization.frames.map(frame => ({ ...frame, image: dataUrl(`${id}/${frame.image}`) })),
  }
}
