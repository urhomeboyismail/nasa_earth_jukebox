// For the playlist's tests only (nothing in the app imports it): the real data sets read from disk, and a stand-in renderer that makes
// deterministic samples from the schedule, so the pipeline (features, music, schedule, encoding) is tested without Tone.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodePng } from '../../analysis/png'
import type { Visualization } from '../../data'
import { visualizationSchema } from '../../data/schema'
import type { RenderDeps, RenderOffline } from './renderSequence'

const dataDir = resolve(fileURLToPath(import.meta.url), '../../../../public/data')

/** A manifest as committed (image paths relative to the data set's folder). */
export function manifestOf(id: string): Visualization {
  return visualizationSchema.parse(JSON.parse(readFileSync(`${dataDir}/${id}/manifest.json`, 'utf8')))
}

/** Reads a frame's PNG from public/data. `image` is the manifest's relative path, which is what `manifestOf` leaves in place. */
export const loadPixelsFrom = (id: string) => async (image: string) => decodePng(readFileSync(`${dataDir}/${id}/${image}`))

/** A sine per frame, from its melody's midi, for the length of the schedule plus the tail. */
export const sineRender: RenderOffline = async (schedule, options) => {
  const last = schedule[schedule.length - 1].atSeconds
  const length = Math.round((last + options.tailSeconds) * options.sampleRate)
  const left = new Float32Array(length)
  const right = new Float32Array(length)
  schedule.forEach(({ frame, atSeconds }, i) => {
    if (!frame.melody) return
    const hz = 440 * 2 ** ((frame.melody.midi - 69) / 12)
    const start = Math.round(atSeconds * options.sampleRate)
    const end = Math.min(length, Math.round((schedule[i + 1]?.atSeconds ?? atSeconds + 1) * options.sampleRate))
    for (let n = start; n < end; n++) {
      const sample = 0.5 * frame.melody.level * Math.sin((2 * Math.PI * hz * (n - start)) / options.sampleRate)
      left[n] = sample
      right[n] = -sample
    }
  })
  return [left, right]
}

export const depsFor = (id: string): RenderDeps => ({ loadPixels: loadPixelsFrom(id), renderOffline: sineRender })

/** jsdom's Blob has no arrayBuffer(), so it is read with a FileReader. */
export const bytesOf = (blob: Blob) =>
  new Promise<ArrayBuffer>((resolveBytes, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolveBytes(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })

/** The SHA-256 of a file as text. */
export async function sha256Hex(blob: Blob): Promise<string> {
  return createHash('sha256').update(new Uint8Array(await bytesOf(blob))).digest('hex')
}
