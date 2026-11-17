// Fetches the recorded instruments the music styles play (ticket SN19) and writes the few notes each one needs to public/audio/instruments/.
//
//   node scripts/fetch_instruments.mjs [download folder]
//
// Source: the FluidR3_GM SoundFont by Frank Wen (CC BY 3.0), rendered one MP3 a note by gleitz/midi-js-soundfonts, at one pinned commit. Each
// instrument is one script file that assigns `{"A0": "data:audio/mp3;base64,...", ...}`. The downloads are data: they are saved in a folder of
// their own (by default a new one in the system temp folder) and read with a regular expression, never run.
//
// Only a note every minor third over each instrument's range is kept; Tone.Sampler repitches the notes between (at most one semitone).
// The ranges below must match INSTRUMENT_RANGES in src/audio/ensemble/instruments.ts; a test there checks that the files are exactly these.

import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const COMMIT = '044fab8e1456bfafc5776e86dfd6bb8697149aef'
const SOURCE = `https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts@${COMMIT}/FluidR3_GM`
/** All the samples together must stay under this: the ticket's 2 MB, counted in decimal so it holds either way. */
const BUDGET_BYTES = 2_000_000
const MINOR_THIRD = 3

/**
 * The MIDI range each instrument must cover: the union, over the voices that play it in some style, of each voice's range before and after SN18
 * (melody C3–C6, harmony C3–E4, bass C2–C3, arpeggio C4–C6, hot spots C4–C7). The flute starts at F#3 to keep to the budget: no flute plays
 * lower, and the old melody's few notes below it are repitched from F#3.
 */
const RANGES = {
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

const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
/** The file name of a MIDI note, as midi-js-soundfonts writes it: flats, octave 4 starting at middle C (60 = C4). */
const noteName = midi => `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`

/** A note every minor third from the bottom of the range, until one is within a semitone of the top. As notesFor in instruments.ts. */
function notesFor([low, high]) {
  const notes = []
  for (let midi = low; ; midi += MINOR_THIRD) {
    notes.push(midi)
    if (midi >= high - 1) return notes
  }
}

/** Reads `"Eb4": "data:audio/mp3;base64,..."` pairs from the downloaded text. */
function parseSoundfont(text) {
  const notes = new Map()
  for (const [, name, base64] of text.matchAll(/"([A-G]b?-?\d)"\s*:\s*"data:audio\/mp(?:3|eg);base64,([A-Za-z0-9+/=]+)"/g)) notes.set(name, base64)
  return notes
}

async function download(name, folder) {
  const file = join(folder, `${name}-mp3.js`)
  if (existsSync(file)) return readFileSync(file, 'utf8')
  const response = await fetch(`${SOURCE}/${name}-mp3.js`)
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`)
  const text = await response.text()
  writeFileSync(file, text)
  return text
}

const root = fileURLToPath(new URL('../public/audio/instruments/', import.meta.url))
const folder = process.argv[2] ?? mkdtempSync(join(tmpdir(), 'fetch-instruments-'))
mkdirSync(folder, { recursive: true })
console.log(`Downloads in ${folder}`)

let total = 0
for (const [name, range] of Object.entries(RANGES)) {
  const notes = parseSoundfont(await download(name, folder))
  const out = join(root, name)
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  for (const midi of notesFor(range)) {
    const base64 = notes.get(noteName(midi))
    if (!base64) throw new Error(`${name}: no ${noteName(midi)} in the download`)
    writeFileSync(join(out, `${noteName(midi)}.mp3`), Buffer.from(base64, 'base64'))
  }
  const bytes = readdirSync(out).reduce((sum, file) => sum + statSync(join(out, file)).size, 0)
  total += bytes
  console.log(`${name}: ${notesFor(range).length} notes, ${(bytes / 1024).toFixed(1)} KB`)
}
console.log(`Total: ${total} bytes of ${BUDGET_BYTES}`)
if (total > BUDGET_BYTES) {
  console.error('Over the budget: take fewer notes or fewer instruments.')
  process.exit(1)
}
