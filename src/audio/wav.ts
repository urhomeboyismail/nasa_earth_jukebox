// A WAV file writer for the "Download this soundscape" button (T72): 16-bit PCM, written by hand so no package is needed.
// Pure: the same samples always give the same bytes.

const HEADER_BYTES = 44

function writeText(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
}

/** A float sample as a 16-bit integer: clamped to -1…1, then scaled so -1 is -32768 and 1 is 32767. */
function toInt16(sample: number): number {
  const clamped = Math.max(-1, Math.min(1, sample))
  return Math.round(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff)
}

/**
 * Encodes channels of samples (each -1 to 1) as a 16-bit PCM WAV file, channels interleaved.
 * Throws, with a message a person can read, for no channels, channels of different lengths or a bad sample rate.
 */
export function encodeWav(channels: Float32Array[], sampleRate: number): Blob {
  if (channels.length === 0) throw new Error('There is no audio to save: no channels were given.')
  const length = channels[0].length
  if (channels.some(channel => channel.length !== length)) throw new Error('The audio channels are not the same length, so they cannot be saved together.')
  if (!Number.isInteger(sampleRate) || sampleRate <= 0) throw new Error(`The sample rate must be a whole number above zero, not ${sampleRate}.`)

  const blockAlign = channels.length * 2
  const dataBytes = length * blockAlign
  const buffer = new ArrayBuffer(HEADER_BYTES + dataBytes)
  const view = new DataView(buffer)

  writeText(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true) // the rest of the file after these eight bytes
  writeText(view, 8, 'WAVE')
  writeText(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // size of the fmt chunk
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, channels.length, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true) // bytes per second
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true) // bits per sample
  writeText(view, 36, 'data')
  view.setUint32(40, dataBytes, true)

  let offset = HEADER_BYTES
  for (let i = 0; i < length; i++) {
    for (const channel of channels) {
      view.setInt16(offset, toInt16(channel[i]), true)
      offset += 2
    }
  }
  return new Blob([buffer], { type: 'audio/wav' })
}
