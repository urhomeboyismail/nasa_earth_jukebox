// Saving a data set on this device (docs/planning/UIUX-BLUEPRINT.md §3.1): its manifest, frames, normals and video go into Cache Storage, and
// public/sw.js serves them from there when the network is not available. The network always comes first, so a saved copy never hides an update.
// Without Cache Storage (old browsers, some private windows) nothing can be saved and the app works as before.

import { loadVisualization } from '.'
import type { Visualization } from './types'

export const SAVED_CACHE = 'earth-jukebox-saved'

const dataUrl = (path: string) => `${import.meta.env.BASE_URL}data/${path}`

export const canSaveOffline = () => typeof caches !== 'undefined'

/** Every file the app reads for a data set. Frame and normal URLs are already resolved by loadVisualization. */
export function filesOf(v: Visualization): string[] {
  const files = [dataUrl(`${v.id}/manifest.json`), ...v.frames.map(f => f.image), ...v.frames.flatMap(f => (f.baselineImage ? [f.baselineImage] : []))]
  if (v.video) files.push(dataUrl(`${v.id}/${v.video.src}`))
  return [...new Set(files)]
}

/** Downloads the data set's files into the saved cache. `onProgress` gets 0 to 1. Throws with a plain reason when it cannot. */
export async function saveOffline(id: string, onProgress: (share: number) => void = () => {}): Promise<void> {
  if (!canSaveOffline()) throw new Error('This browser cannot save data sets.')
  const files = filesOf(await loadVisualization(id))
  const cache = await caches.open(SAVED_CACHE)
  let done = 0
  try {
    for (const file of files) {
      await cache.add(file)
      onProgress(++done / files.length)
    }
  } catch (error) {
    // Half a data set is no use offline: take back what was saved.
    await Promise.all(files.map(file => cache.delete(file)))
    throw new Error(error instanceof DOMException && error.name === 'QuotaExceededError' ? 'There is not enough space on this device.' : 'The files could not be downloaded.')
  }
}

export async function removeOffline(id: string): Promise<void> {
  if (!canSaveOffline()) return
  const cache = await caches.open(SAVED_CACHE)
  const prefix = new URL(dataUrl(`${id}/`), location.href).href
  await Promise.all((await cache.keys()).filter(request => request.url.startsWith(prefix)).map(request => cache.delete(request)))
}

/** The ids of the data sets whose manifest is saved. */
export async function savedIds(): Promise<Set<string>> {
  if (!canSaveOffline()) return new Set()
  const cache = await caches.open(SAVED_CACHE)
  const ids = (await cache.keys()).map(request => /\/data\/([^/]+)\/manifest\.json$/.exec(new URL(request.url).pathname)?.[1]).filter((id): id is string => !!id)
  return new Set(ids)
}
