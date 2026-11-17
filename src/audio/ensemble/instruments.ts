// The recorded instruments the music styles play (ticket SN19): which notes each one has, where they are, and a loader that fetches and decodes
// them once a page. The files are self-hosted in public/audio/instruments/ (scripts/fetch_instruments.mjs wrote them; FluidR3_GM, CC BY 3.0).
//
// Nothing is fetched until the ensemble starts, which only a click or key press does. Until the notes have loaded, or if they cannot load, every
// voice plays its kit's oscillator, so the app never goes silent. AudioBuffers belong to no context, so the same decoded notes serve the live graph
// and every offline render.

import type { InstrumentName, InstrumentVoice, Kit } from '../../sonify/types'

/**
 * The MIDI range each instrument covers: the union, over the voices that play it in some style, of each voice's range before and after SN18. Must
 * match RANGES in scripts/fetch_instruments.mjs (a test checks the files). The flute starts at F#3 to keep the samples under 2 MB.
 */
export const INSTRUMENT_RANGES: Record<InstrumentName, readonly [low: number, high: number]> = {
  marimba: [48, 84],
  vibraphone: [60, 96],
  acoustic_grand_piano: [48, 84],
  string_ensemble_1: [48, 64],
  cello: [36, 48],
  pizzicato_strings: [60, 84],
  orchestral_harp: [60, 96],
  flute: [54, 84],
  acoustic_bass: [36, 48],
  tubular_bells: [60, 96],
}

/** A sample every minor third: Tone.Sampler repitches the notes between by at most a semitone. */
const MINOR_THIRD = 3
/** The notes are decoded at this rate whatever the device's own, so a render is the same on every machine. */
export const INSTRUMENT_SAMPLE_RATE = 44100
/** The order the voices are listed in, so the same kit always asks for its instruments in the same order. */
const VOICES: readonly InstrumentVoice[] = ['melody', 'harmony', 'bass', 'rhythm', 'hotspots']
const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const

/** The MIDI notes an instrument has: one every minor third from the bottom of its range, until one is within a semitone of the top. */
export function instrumentNotes(name: InstrumentName): number[] {
  const [low, high] = INSTRUMENT_RANGES[name]
  const notes: number[] = []
  for (let midi = low; ; midi += MINOR_THIRD) {
    notes.push(midi)
    if (midi >= high - 1) return notes
  }
}

/** A MIDI note's file name, as the SoundFont names it: flats, and middle C (60) is C4. */
export function noteFileName(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`
}

export const instrumentUrl = (name: InstrumentName, midi: number) => `${import.meta.env.BASE_URL}audio/instruments/${name}/${noteFileName(midi)}.mp3`

/** Each instrument's decoded notes, by MIDI note. */
export type InstrumentBuffers = ReadonlyMap<InstrumentName, Readonly<Record<number, AudioBuffer>>>

/** The instruments a kit plays, each once, in voice order. */
export function kitInstruments(kit: Kit): InstrumentName[] {
  const names: InstrumentName[] = []
  for (const voice of VOICES) {
    const name = kit.instruments?.[voice]
    if (name && !names.includes(name)) names.push(name)
  }
  return names
}

export type InstrumentDeps = {
  fetch: (url: string) => Promise<Response>
  decode: (data: ArrayBuffer) => Promise<AudioBuffer>
}

export type InstrumentLoader = {
  /**
   * Starts loading the instruments not yet asked for, and resolves with every one of `names` that has loaded. Never rejects: an instrument that
   * fails is logged once and left out, so its voices keep their oscillators. Call only after a click or key press.
   */
  request(names: readonly InstrumentName[]): Promise<InstrumentBuffers>
  /** Those of `names` already decoded, at once. */
  ready(names: readonly InstrumentName[]): InstrumentBuffers
}

async function loadInstrument(name: InstrumentName, deps: InstrumentDeps): Promise<Record<number, AudioBuffer>> {
  const notes = instrumentNotes(name)
  const buffers = await Promise.all(notes.map(async midi => {
    const response = await deps.fetch(instrumentUrl(name, midi))
    if (!response.ok) throw new Error(`${instrumentUrl(name, midi)}: HTTP ${response.status}`)
    return deps.decode(await response.arrayBuffer())
  }))
  return Object.fromEntries(notes.map((midi, i) => [midi, buffers[i]]))
}

/** `deps` is asked for on the first request; null (no audio decoder, as in jsdom) loads nothing and logs nothing. */
export function createInstrumentLoader(deps: () => InstrumentDeps | null): InstrumentLoader {
  const loading = new Map<InstrumentName, Promise<void>>()
  const loaded = new Map<InstrumentName, Readonly<Record<number, AudioBuffer>>>()
  let resolved: InstrumentDeps | null | undefined

  function ready(names: readonly InstrumentName[]): InstrumentBuffers {
    const buffers = new Map<InstrumentName, Readonly<Record<number, AudioBuffer>>>()
    for (const name of names) {
      const notes = loaded.get(name)
      if (notes) buffers.set(name, notes)
    }
    return buffers
  }

  async function request(names: readonly InstrumentName[]): Promise<InstrumentBuffers> {
    if (resolved === undefined) resolved = deps()
    const using = resolved
    if (using) {
      const failed: InstrumentName[] = []
      const fresh = names.filter(name => !loading.has(name))
      for (const name of fresh) {
        loading.set(name, loadInstrument(name, using).then(notes => { loaded.set(name, notes) }, () => { failed.push(name) }))
      }
      await Promise.all(names.map(name => loading.get(name)))
      // One line for the whole request; a failed instrument is not tried again until the page reloads.
      if (failed.length) console.warn(`The recorded instruments could not be loaded (${failed.join(', ')}), so those voices play synthesised sound.`)
    }
    return ready(names)
  }

  return { request, ready }
}

function browserDeps(): InstrumentDeps | null {
  if (typeof OfflineAudioContext === 'undefined' || typeof fetch === 'undefined') return null
  const decoder = new OfflineAudioContext(1, 1, INSTRUMENT_SAMPLE_RATE)
  return { fetch: url => fetch(url), decode: data => decoder.decodeAudioData(data) }
}

/** The page's one loader: a note is fetched once, however many ensembles (data sets) ask for it. */
export const instrumentLoader = createInstrumentLoader(browserDeps)
