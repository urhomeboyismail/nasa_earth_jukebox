// A PNG reader for tests only (nothing in the app imports it). jsdom cannot decode images, and the check that matters is
// that the real files in public/data give the categories their expected.json says. It reads 8-bit RGB and RGBA PNGs that
// are not interlaced, which is all our own scripts write, and rejects everything else with a clear message.
// Node's own types are not loaded for the app (they change the type of setTimeout), so node.d.ts declares the few calls used.

import { inflateSync } from 'node:zlib'
import type { Pixels } from './analyze'

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** Undoes PNG filter types 0 to 4 on one row, in place. `previous` is the row above, already unfiltered. */
function unfilter(type: number, row: Uint8Array, previous: Uint8Array, bytesPerPixel: number) {
  for (let i = 0; i < row.length; i++) {
    const left = i >= bytesPerPixel ? row[i - bytesPerPixel] : 0
    const up = previous[i]
    const upLeft = i >= bytesPerPixel ? previous[i - bytesPerPixel] : 0
    let add: number
    switch (type) {
      case 0: add = 0; break
      case 1: add = left; break
      case 2: add = up; break
      case 3: add = (left + up) >> 1; break
      case 4: {
        const p = left + up - upLeft
        const pa = Math.abs(p - left)
        const pb = Math.abs(p - up)
        const pc = Math.abs(p - upLeft)
        add = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft
        break
      }
      default: throw new Error(`Unknown PNG filter type ${type}.`)
    }
    row[i] = (row[i] + add) & 0xff
  }
}

/** Decodes a PNG file's bytes into RGBA pixels, in the shape of `ImageData`. */
export function decodePng(bytes: Uint8Array): Pixels {
  if (!SIGNATURE.every((b, i) => bytes[i] === b)) throw new Error('Not a PNG file.')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let width = 0
  let height = 0
  let channels = 0
  const parts: Uint8Array[] = []

  for (let offset = 8; offset < bytes.length;) {
    const length = view.getUint32(offset)
    const name = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
    const body = bytes.subarray(offset + 8, offset + 8 + length)
    if (name === 'IHDR') {
      width = view.getUint32(offset + 8)
      height = view.getUint32(offset + 12)
      const [depth, colorType, , , interlace] = body.subarray(8, 13)
      if (depth !== 8) throw new Error(`Only 8-bit PNGs are supported, not ${depth}-bit.`)
      if (colorType !== 2 && colorType !== 6) throw new Error(`Only RGB and RGBA PNGs are supported, not color type ${colorType}.`)
      if (interlace !== 0) throw new Error('Interlaced PNGs are not supported.')
      channels = colorType === 2 ? 3 : 4
    } else if (name === 'IDAT') {
      parts.push(body)
    } else if (name === 'IEND') {
      break
    }
    offset += 12 + length // length, name, body, checksum
  }
  if (!width || !height || !parts.length) throw new Error('The PNG has no image data.')

  const joined = new Uint8Array(parts.reduce((n, part) => n + part.length, 0))
  let at = 0
  for (const part of parts) {
    joined.set(part, at)
    at += part.length
  }
  const raw = inflateSync(joined)
  const stride = width * channels
  if (raw.length !== (stride + 1) * height) throw new Error('The PNG data is the wrong size.')

  const data = new Uint8ClampedArray(width * height * 4)
  let previous: Uint8Array = new Uint8Array(stride)
  for (let y = 0; y < height; y++) {
    const start = y * (stride + 1)
    const row = Uint8Array.from(raw.subarray(start + 1, start + 1 + stride))
    unfilter(raw[start], row, previous, channels)
    for (let x = 0; x < width; x++) {
      const out = (y * width + x) * 4
      data[out] = row[x * channels]
      data[out + 1] = row[x * channels + 1]
      data[out + 2] = row[x * channels + 2]
      data[out + 3] = channels === 4 ? row[x * channels + 3] : 255
    }
    previous = row
  }
  return { data, width, height }
}
