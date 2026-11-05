import { describe, expect, it } from 'vitest'
import { encodeWav } from './wav'

/** jsdom's Blob has no arrayBuffer(), so it is read the way a page would: with a FileReader. */
const bytesOf = (blob: Blob) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
const view = async (blob: Blob) => new DataView(await bytesOf(blob))
const text = (v: DataView, offset: number, length: number) =>
  String.fromCharCode(...Array.from({ length }, (_, i) => v.getUint8(offset + i)))

describe('encodeWav', () => {
  it('writes the header: RIFF, WAVE, a PCM fmt chunk, and a data chunk of the right size', async () => {
    const blob = encodeWav([new Float32Array(100), new Float32Array(100)], 44100)
    const v = await view(blob)
    expect(blob.type).toBe('audio/wav')
    expect(blob.size).toBe(44 + 100 * 2 * 2)
    expect(text(v, 0, 4)).toBe('RIFF')
    expect(v.getUint32(4, true)).toBe(blob.size - 8)
    expect(text(v, 8, 4)).toBe('WAVE')
    expect(text(v, 12, 4)).toBe('fmt ')
    expect(v.getUint32(16, true)).toBe(16)
    expect(v.getUint16(20, true)).toBe(1) // PCM
    expect(v.getUint16(22, true)).toBe(2) // channels
    expect(v.getUint32(24, true)).toBe(44100) // sample rate
    expect(v.getUint32(28, true)).toBe(44100 * 2 * 2) // byte rate
    expect(v.getUint16(32, true)).toBe(4) // block align
    expect(v.getUint16(34, true)).toBe(16) // bits per sample
    expect(text(v, 36, 4)).toBe('data')
    expect(v.getUint32(40, true)).toBe(400)
  })

  it('describes one channel as mono, with the byte rate and block align to match', async () => {
    const v = await view(encodeWav([new Float32Array(10)], 22050))
    expect(v.getUint16(22, true)).toBe(1)
    expect(v.getUint32(24, true)).toBe(22050)
    expect(v.getUint32(28, true)).toBe(22050 * 2)
    expect(v.getUint16(32, true)).toBe(2)
    expect(v.getUint32(40, true)).toBe(20)
  })

  it('interleaves two channels: left, right, left, right', async () => {
    const left = Float32Array.of(0.5, -0.5, 0)
    const right = Float32Array.of(1, -1, 0.25)
    const v = await view(encodeWav([left, right], 44100))
    const samples = Array.from({ length: 6 }, (_, i) => v.getInt16(44 + i * 2, true))
    expect(samples).toEqual([
      Math.round(0.5 * 32767), Math.round(1 * 32767),
      Math.round(-0.5 * 32768), -32768,
      0, Math.round(0.25 * 32767),
    ])
  })

  it('clamps samples beyond -1 and 1 to the largest and smallest values', async () => {
    const v = await view(encodeWav([Float32Array.of(1.5, -1.5, 1, -1)], 8000))
    expect([0, 1, 2, 3].map(i => v.getInt16(44 + i * 2, true))).toEqual([32767, -32768, 32767, -32768])
  })

  it('writes an empty recording as a header with no samples', async () => {
    const blob = encodeWav([new Float32Array(0)], 44100)
    const v = await view(blob)
    expect(blob.size).toBe(44)
    expect(v.getUint32(40, true)).toBe(0)
    expect(v.getUint32(4, true)).toBe(36)
  })

  it('gives the same bytes for the same samples', async () => {
    const samples = () => [Float32Array.of(0.1, -0.2, 0.3), Float32Array.of(-0.4, 0.5, -0.6)]
    expect(new Uint8Array(await bytesOf(encodeWav(samples(), 44100)))).toEqual(new Uint8Array(await bytesOf(encodeWav(samples(), 44100))))
  })

  it('throws a readable message for no channels', () => {
    expect(() => encodeWav([], 44100)).toThrow('There is no audio to save')
  })

  it('throws a readable message for channels of different lengths', () => {
    expect(() => encodeWav([new Float32Array(3), new Float32Array(4)], 44100)).toThrow('not the same length')
  })

  it('throws a readable message for a sample rate that is not a whole number above zero', () => {
    for (const rate of [0, -44100, 44100.5, Number.NaN]) expect(() => encodeWav([new Float32Array(1)], rate)).toThrow('sample rate')
  })
})
