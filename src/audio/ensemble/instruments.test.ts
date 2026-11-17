import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PRESETS } from '../../sonify/presets'
import type { InstrumentName } from '../../sonify/types'
import { DEFAULT_KIT } from './graph'
import { createInstrumentLoader, INSTRUMENT_RANGES, instrumentNotes, instrumentUrl, kitInstruments, noteFileName, type InstrumentDeps } from './instruments'

const instrumentsDir = resolve(fileURLToPath(import.meta.url), '../../../../public/audio/instruments')
const NAMES = Object.keys(INSTRUMENT_RANGES) as InstrumentName[]
/** The ticket's budget for every sample together. */
const BUDGET_BYTES = 2_000_000

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the instrument files', () => {
  it('names notes as the SoundFont does: flats, and middle C is C4', () => {
    expect(noteFileName(60)).toBe('C4')
    expect(noteFileName(63)).toBe('Eb4')
    expect(noteFileName(54)).toBe('Gb3')
    expect(noteFileName(36)).toBe('C2')
    expect(instrumentUrl('marimba', 69)).toBe('/audio/instruments/marimba/A4.mp3')
  })

  it('has a note every minor third, covering each range to within a semitone', () => {
    for (const name of NAMES) {
      const [low, high] = INSTRUMENT_RANGES[name]
      const notes = instrumentNotes(name)
      expect(notes[0], name).toBe(low)
      for (let i = 1; i < notes.length; i++) expect(notes[i] - notes[i - 1], name).toBe(3)
      expect(notes[notes.length - 1], name).toBeGreaterThanOrEqual(high - 1)
    }
  })

  it('ships every note it will ask for, under 2 MB in all, with the credit', () => {
    let total = 0
    for (const name of NAMES) {
      for (const midi of instrumentNotes(name)) total += readFileSync(`${instrumentsDir}/${name}/${noteFileName(midi)}.mp3`).length
    }
    expect(total).toBeLessThan(BUDGET_BYTES)
    const credits = readFileSync(`${instrumentsDir}/CREDITS.md`, 'utf8')
    expect(credits).toMatch(/FluidR3_GM/)
    expect(credits).toMatch(/Frank Wen/)
    expect(credits).toMatch(/CC BY 3\.0/)
  })
})

describe('kitInstruments', () => {
  it('lists the kit\'s instruments once each, in voice order, and none for a kit without them', () => {
    expect(kitInstruments(DEFAULT_KIT)).toEqual(['marimba', 'string_ensemble_1', 'acoustic_bass', 'orchestral_harp', 'tubular_bells'])
    expect(kitInstruments(PRESETS.lofi.kit!)).toEqual(['acoustic_grand_piano', 'string_ensemble_1', 'acoustic_bass', 'vibraphone'])
    expect(kitInstruments(PRESETS.chiptune.kit!)).toEqual([])
    expect(kitInstruments(PRESETS.bass.kit!)).toEqual([])
  })
})

describe('createInstrumentLoader', () => {
  /** A fake fetch and decoder: each URL gives a small fake buffer, and a URL with `fail` in it a 404. */
  function fakeDeps(fail: InstrumentName[] = []) {
    const fetched: string[] = []
    const deps: InstrumentDeps = {
      fetch: async url => {
        fetched.push(url)
        return new Response(fail.some(name => url.includes(`/${name}/`)) ? null : new Uint8Array([1, 2, 3]), { status: fail.some(name => url.includes(`/${name}/`)) ? 404 : 200 })
      },
      decode: async data => ({ length: data.byteLength }) as unknown as AudioBuffer,
    }
    return { deps, fetched }
  }

  it('loads nothing before it is asked, then each note once however often it is asked', async () => {
    const { deps, fetched } = fakeDeps()
    const make = vi.fn(() => deps)
    const loader = createInstrumentLoader(make)
    expect(make).not.toHaveBeenCalled()
    expect(loader.ready(['marimba']).size).toBe(0)
    const [first, second] = await Promise.all([loader.request(['marimba']), loader.request(['marimba', 'flute'])])
    expect(first.get('marimba')).toBeDefined()
    expect(Object.keys(second.get('flute')!).map(Number)).toEqual(instrumentNotes('flute'))
    expect(fetched).toHaveLength(instrumentNotes('marimba').length + instrumentNotes('flute').length)
    await loader.request(['marimba'])
    expect(fetched).toHaveLength(instrumentNotes('marimba').length + instrumentNotes('flute').length)
    expect(loader.ready(['marimba', 'flute', 'cello'])).toEqual(new Map([['marimba', first.get('marimba')], ['flute', second.get('flute')]]))
  })

  it('leaves out an instrument that fails, logs once, and never rejects', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { deps } = fakeDeps(['cello'])
    const loader = createInstrumentLoader(() => deps)
    const loaded = await loader.request(['cello', 'marimba'])
    expect([...loaded.keys()]).toEqual(['marimba'])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toMatch(/cello/)
    await expect(loader.request(['cello'])).resolves.toEqual(new Map())
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('loads nothing and says nothing where there is no audio decoder', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const loader = createInstrumentLoader(() => null)
    await expect(loader.request(['marimba'])).resolves.toEqual(new Map())
    expect(warn).not.toHaveBeenCalled()
  })
})
