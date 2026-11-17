# SN19 Real instruments and a real room: sampled voices and a seeded reverb

| | |
|---|---|
| **Priority** | P1 |
| **Size** | L (more than a day) |
| **Who** | agent+👤 (an agent builds it, the team lead signs off by ear) |
| **Needs** | — |
| **Hotspots** | about |
| **Branch** | `feature/SN19-real-instruments` |

## Goal

The pitched voices play recorded instruments (for example marimba, strings, piano, harp, bells) in place of bare oscillators, and the mix sits in a warm room reverb. The same input still renders the same WAV bytes. Until the samples have loaded, or if they fail to load, the voices play today's oscillators, so the app never goes silent.

## Why

- On 18 Nov 2026 the team compared the app with another Space Apps entry that plays NASA data through a General MIDI SoundFont (flute, cello, harp, marimba, celesta) with a convolution reverb, and preferred its sound. Ours is synthetic because every voice is a `Tone.Synth` with a sine, triangle, saw or square oscillator: `synthFor` in `src/audio/ensemble/graph.ts:101-102`, and the kits in `src/sonify/presets.ts:27-50` only switch the waveform (`Kit` in `src/sonify/types.ts:13`).
- The only room is two short feedback delays (`SPACE`, `src/audio/ensemble/constants.ts:44`, delays of 29 ms and 43 ms). They sound metallic, like a comb filter, rather than like a room.
- A reverb was left out on purpose because `Tone.Reverb` and `Freeverb` don't render the same twice (`src/audio/ensemble/graph.ts:7-8`, `constants.ts:41-43`). A `ConvolverNode` whose impulse is built from a seeded generator renders the same every time, and so does sample playback (`AudioBufferSourceNode`).

## Design

**Samples**
- Files go in `public/audio/instruments/<name>/<note>.mp3` (for example `A3.mp3`). Take a note every minor third over each voice's range only (see the ranges in `src/sonify/ranges.ts`); `Tone.Sampler` repitches the notes between.
- **Source:** the FluidR3_GM SoundFont by Frank Wen (CC BY 3.0), as rendered per note by `gleitz/midi-js-soundfonts`. A script `scripts/fetch_instruments.mjs` downloads the files from one pinned commit, decodes the base64 MP3s and writes the subset. The script and the files are committed, and the app never fetches from a CDN at run time. Credit it in the About page and in `public/audio/instruments/CREDITS.md`.
- **Budget:** under 2 MB in all. Loaded on demand the first time the ensemble starts (after the listener's gesture), never on first page load (`.claude/rules/frontend.md`).

**Instruments**
- `Kit` (`src/sonify/types.ts:13`) widens so each voice can name an instrument: `Waveform | InstrumentName`, with `InstrumentName` a closed list of the instruments shipped (start with `marimba`, `vibraphone`, `acoustic_grand_piano`, `string_ensemble_1`, `cello`, `pizzicato_strings`, `orchestral_harp`, `flute`, `acoustic_bass`, `tubular_bells`).
- Each style's kit picks instruments (starting values, tuned by ear):

| Kit | Melody | Harmony | Bass | Arpeggio | Hot spots |
|---|---|---|---|---|---|
| Default (major, dorian, pentatonic) | marimba | string_ensemble_1 | acoustic_bass | orchestral_harp | tubular_bells |
| Cinematic | flute | string_ensemble_1 | cello | pizzicato_strings | tubular_bells |
| Lo-fi | acoustic_grand_piano | string_ensemble_1 | acoustic_bass | vibraphone | vibraphone |
| Nature | flute | string_ensemble_1 | acoustic_bass | marimba | orchestral_harp |
| 8-bit, Heavy bass | oscillators, as today | | | | |

  Kits name harmony and hot spots, which they don't today; `Kit` gains those two keys, optional, defaulting as in the table.
- Data sets choose a style through their manifest as today (`sonification.preset`). No new manifest field, so no `schema` change.
- The time pulse, the dropout taps, the motion pad and the explore tone stay oscillators: they are cues, and must sound the same everywhere.
- **Melody glide:** a sampler can't slide. Where the plan says `glide`, the new note is struck with a short attack and the old one released at the same moment (legato). The caption is unchanged.
- **Brightness:** the per-voice low-pass filters stay after the sampler, so brightness still opens and closes the sound.

**Reverb**
- One `Tone.Convolver` send. The melody, harmony, arpeggio and hot spots feed it; the bass and the cues stay dry. Its impulse is stereo, 2.4 s long, decaying by 60 dB, built from `mulberry32` (move it from `src/audio/ensemble/dropout.ts` into a small shared file and import it in both places) with a fixed seed constant `REVERB_SEED`. Wet level about 0.2: a named constant.
- It replaces the two `SPACE` delay lines.
- The compressor, the limiter and the hard clip at `CEILING_LINEAR` stay as they are, so the peak still holds at −1 dBFS.

**Loading and fallback**
- `buildGraph` takes the decoded buffers (`Map<InstrumentName, ToneAudioBuffers>`) as an option. Without them, every voice is built as today (the goldens and the tests run this way).
- The ensemble starts at once with the oscillators. When the samples finish loading, the next `start()` (or the next data set) builds with them. Never swap instruments mid-note.
- `renderOffline` waits for the samples (with a timeout) so the exported WAV uses the instruments. `AudioBuffer`s are not tied to a context, so the same decoded buffers serve the live and offline graphs.

## Reuse

- `buildGraph` and `synthFor` (`src/audio/ensemble/graph.ts`), and `createPlayer` (`src/audio/ensemble/voices.ts`): change how a voice is built and struck, not what it plays.
- `cutoff`, `resolveTimbre` (`src/audio/ensemble/timbre.ts`): the brightness filter stays.
- `mulberry32` (`src/audio/ensemble/dropout.ts:10`).
- `src/audio/ensemble/toneMock.ts`: add `Sampler` and `Convolver` to the mock.
- The determinism and peak tests in `src/audio/ensemble/ensemble.test.ts`.

## Touches

- `src/audio/ensemble/graph.ts`, `voices.ts`, `constants.ts`, `dropout.ts`, `index.ts`, `toneMock.ts`, `types.ts`, a new `src/audio/ensemble/instruments.ts` (names, file lists, loader) and a new `src/audio/ensemble/seeded.ts`, with their tests
- `src/sonify/types.ts` (`Kit`), `src/sonify/presets.ts` (the kits)
- `public/audio/instruments/**`, `scripts/fetch_instruments.mjs`
- `src/features/about/index.tsx` (one credit line; the `about` hotspot) and `about.test.tsx`
- `docs/data-sources.md` is **not** touched (no manifest field)

## Steps

1. Write `scripts/fetch_instruments.mjs` and fetch the subset; check the size budget and the licence; write `CREDITS.md`.
2. Add `instruments.ts` (names, notes per instrument, `loadInstruments(context)`), and move `mulberry32` to `seeded.ts`.
3. Widen `Kit`; set the kits in `presets.ts`.
4. `buildGraph`: a Sampler per pitched voice when buffers are given; the seeded convolver send in place of `SPACE`.
5. `voices.ts`: strike samplers (`triggerAttack` / `triggerRelease` per note), with legato for glides.
6. `index.ts`: load the samples on first start, rebuild on the next start, and wait for them in `renderOffline`.
7. The About page credit.
8. Listen on the fixture and two NASA data sets in each style; ask the team lead to sign off. Put what was heard under **Result**.

## Tests

- Two offline renders of the same schedule with the samples give identical bytes (use small fake buffers in the test).
- The reverb impulse is the same for the same seed and differs for another seed.
- With no buffers, the graph is built exactly as today (the existing golden and render tests pass unchanged).
- The peak of a loud render stays at or below −1 dBFS with the reverb on.
- A failed sample load leaves the oscillators playing and logs once, with no unhandled rejection.
- About page: the credit is present (`getByText`), and `expectNoA11yViolations` passes.

## Guardrails

- The same input always gives the same output (features, music frames, WAV bytes). The reverb is seeded; nothing calls `Math.random`.
- The peak stays at or below −1 dBFS. No sound plays before a click or key press (WCAG 1.4.2). No sample is fetched before the first gesture.
- Nothing flashes more than 3 times a second (WCAG 2.3.1). Under `prefers-reduced-motion` everything is still.
- Every voice and cue keeps its text equivalent.
- Nothing specific to one data set goes in `src/` (`.claude/rules/phases.md`). The instruments belong to styles, not data sets.
- The licence (CC BY 3.0) is credited in the app.

## Done when

- The default and the cinematic, lo-fi and nature styles play recorded instruments through a seeded reverb; 8-bit and heavy bass sound as before.
- Renders are byte-identical run to run; the peak holds.
- The app plays at once with oscillators and switches to instruments once loaded; it never goes silent on a failed load.
- The samples are under 2 MB, self-hosted and credited.
- The team lead has listened and signed off.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- The chords, arpeggio and registers (SN18).
- A manifest field to pick instruments for one data set (a later ticket, with the `schema` hotspot, if styles are not enough).
- The old engine (`src/audio/engine.ts`).

## Result

Built by agent C on `feature/SN19-real-instruments` (from `main` at 556745e). Not yet signed off by ear: see "To listen for" below.

**Commits**
- 5a4e92c SN19: fetch the recorded instruments (FluidR3_GM, CC BY 3.0)
- e054538 SN19: sampled voices and a seeded convolver room
- e2d41fe SN19: credit the FluidR3_GM SoundFont (CC BY 3.0) on the About page
- (this Result)

**Samples:** 101 MP3s, 1,962,945 bytes in all (under 2,000,000), from gleitz/midi-js-soundfonts @ `044fab8e1456bfafc5776e86dfd6bb8697149aef`, written by `node scripts/fetch_instruments.mjs`. Every file is about 1.6 s long (128 kbps mono).

| Instrument | Range (MIDI) | Notes | Size |
|---|---|---|---|
| marimba | 48–84 | 13 | 185.1 KB |
| vibraphone | 60–96 | 13 | 220.5 KB |
| acoustic_grand_piano | 48–84 | 13 | 310.4 KB |
| string_ensemble_1 | 48–64 | 6 | 149.9 KB |
| cello | 36–48 | 5 | 124.9 KB |
| pizzicato_strings | 60–84 | 9 | 155.7 KB |
| orchestral_harp | 60–96 | 13 | 204.4 KB |
| flute | 54–84 | 11 | 274.8 KB |
| acoustic_bass | 36–48 | 5 | 73.4 KB |
| tubular_bells | 60–96 | 13 | 217.9 KB |

Ranges are the union of each voice's range before and after SN18. The flute starts at F#3, not C3, to stay under 2 MB; notes below it are repitched from F#3.

**Choices made while building**
- `Kit` keeps its three waveforms and gains `instruments?: Partial<Record<InstrumentVoice, InstrumentName>>`, not `Waveform | InstrumentName` per voice. Cinematic, lo-fi and nature replace different waveforms with the same instrument (flute replaces sawtooth in one and triangle in another), so the waveform has to stay in the kit for "until loaded, today's oscillators" to be exact. Major, dorian and pentatonic use `DEFAULT_KIT` (graph.ts), which now names the default row's instruments. 8-bit and heavy bass name none.
- The scan bank (`playNotes`: scan, find, follow, the style's "Play sample", explore's one-note sounds) plays the melody instrument, as it already played the melody waveform. The explore tone (`hold`), motion pad, time pulse and dropout taps stay oscillators.
- Each recorded note lasts about 1.5 s, so a note held longer would go silent. A held melody, chord, bass or hot-spot note is struck again after `SAMPLE_RENEW_S` (1.2 s), on the next frame. This is deterministic.
- Each chord note and hot-spot slot has its own `Tone.Sampler`, so releasing one note never cuts the same pitch struck by another.
- The notes are decoded in an `OfflineAudioContext` at 44.1 kHz whatever the device's rate, so a render does not depend on the machine's sample rate. Loading happens once a page (`instrumentLoader`). A failure logs one `console.warn` and that instrument's voices stay oscillators until reload.
- The room's dry path is now at full level (the old delay lines passed about 72 % dry), so the melody and harmony are about 2.8 dB louder against the bass than before.
- graph.test's two room tests asserted the two `FeedbackDelay`s. They now assert the convolver send.

**Checks** (Windows, this worktree)

```
npm run lint      → oxlint: no findings
npm run build     → tsc -b && vite build: ✓ built in 2.83s (ensemble chunk loads on demand; check-bundle: 89211 bytes gzip, within 93753)
npm test          → Test Files  2 failed | 219 passed (221)
                    Tests       2 failed | 3056 passed (3058)
 FAIL  src/boundary.test.ts > the boundary: … > finds nothing wrong in any of them
       + "audio/ensemble/instruments.ts calls fetch()"
 FAIL  src/App.test.tsx > App shell > loads the first visualization and shows it on each page
```

- `boundary.test.ts` is caused by this ticket. Only `analysis/pixels.ts` may call `fetch()` in `src/audio`, and the loader fetches the self-hosted samples. The fix is one line outside this ticket's Touches: add `'audio/ensemble/instruments.ts'` to `MAY_FETCH` in `src/boundary.test.ts`. It fetches only same-origin files from `public/audio/instruments/` after a gesture, and the sound works without them. Left for the team lead to approve.
- `App.test.tsx` already fails on `main` at 556745e (2 tests fail there in a clean checkout). It is timing-sensitive and not caused by this ticket.
- An earlier full run under load also timed out 6 tests (ask, Landing, a scoring test and others). They pass on a rerun.
- `sound-regression.test.ts` passed.

**To listen for** (fixture and two NASA data sets, each style). Sign-off by ear is still to do.
- Press Play: the first time, the oscillators play as before. Stop and Play again (or open another data set) and the instruments are there. Check that nothing changes mid-note.
- Default (major, dorian, pentatonic): marimba melody, string chords, acoustic bass, harp arpeggio, tubular bells on hot spots. Cinematic: flute, strings, cello, pizzicato, bells. Lo-fi: piano, strings, acoustic bass, vibraphone. Nature: flute, strings, acoustic bass, marimba, harp. 8-bit and heavy bass should sound exactly as before.
- Levels: samples use the synths' `VOICE_GAIN_DB`, and recorded notes may be louder or softer than the oscillators. The bells and the harp may stand out.
- Held notes: a held chord or melody note is struck again every 1.2 s. Listen for a pulse on the strings and decide whether `SAMPLE_RENEW_S` should change.
- Glides: the melody now steps legato instead of sliding.
- The room (all styles, including 8-bit and heavy bass): a 2.4 s warm tail at `REVERB.wet` 0.2 in place of the metallic short delays. Listen for mud on fast arpeggios.
- The export: a WAV from Listen should have the instruments, and two exports of the same thing should be identical.
- Peak: nothing should clip on a loud data set. The limiter and the −1 dBFS hard clip are unchanged.
