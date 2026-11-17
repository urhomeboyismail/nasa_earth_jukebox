# SN18 Real chords, chord-tone arpeggios and separate registers, so the ensemble sounds like music

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent+👤 (an agent builds it, the team lead signs off by ear) |
| **Needs** | — |
| **Hotspots** | — |
| **Branch** | `feature/SN18-real-chords` |

## Goal

The harmony plays real chords (triads or sevenths built from the preset's scale) that move smoothly from one to the next, the arpeggio plays the notes of that chord, and each voice has its own octave. The data still decides everything it decides today: which chord, how full it is, where the melody sits, how busy the arpeggio is. The result is consonant and pleasant to hear.

## Why

Listening on 18 Nov 2026, the team compared the app with another Space Apps entry that plays NASA data as composed music, and ours sounded harsh and synthetic next to it. Reading the rules shows three causes:

- **The chord is a cluster, not a chord.** `harmonyFor` (`src/sonify/music.ts:36-50`) turns each histogram band that holds 10% or more into a scale degree by spreading the bands over the scale (`music.ts:45`). Three neighbouring bands give degrees 0, 1, 2, which is C, D and E together: a cluster of seconds. Up to four such notes sound at once (`MAX_HARMONY_NOTES`, `src/sonify/ranges.ts:12`), all inside one octave (`HARMONY_LOW_MIDI` to `HARMONY_HIGH_MIDI`, `ranges.ts:8-9`).
- **The chord jumps.** `degreeMidi` (`music.ts:29-32`) puts every note at its lowest place above C3, so a new chord is a new block of notes rather than a small move from the last one.
- **The voices sit on top of each other.** The melody spans C3 to F#5 (`ranges.ts:4-6`), the harmony C3 to C4, the arpeggio C4 to C5 (`ranges.ts:22-24`) and the hot spots C4 to C6 (`ranges.ts:17-19`). Four voices share C4 to C5, so they rub against each other. The arpeggio picks any scale note from the edge line's x (`music.ts:76-77`), not the notes of the chord under it, so it often clashes with the harmony.

## Design

All pure, in `src/sonify/`, so the live sound, the offline render, the captions and the goldens keep using the same rules.

**1. Chords built in thirds.** A chord on scale degree `r` is degrees `r`, `r+2`, `r+4` of the preset's scale (and `r+6` for a seventh), counted round the scale. On a 7-note scale these are the ordinary triads; on the 5-note pentatonic they are open, consonant stacks. No new scale tables are needed.

**2. Which chord: from the data, as today.** The histogram still decides.
- **Root:** the weighted mean band of the histogram (shares as weights), mapped from 0..1 onto a short list of chord roots `CHORD_ROOT_DEGREES` (a new constant in `src/sonify/ranges.ts`). Use `[0, 5, 3, 4]` (I, vi, IV, V) for 7-note scales and `[0, 1, 2, 3]` for 5-note scales. This is a starting value; tune it by ear.
- **Fullness:** a seventh when the heard bands are spread wide (the share-weighted spread of the bands at or above `HARMONY_MIN_SHARE` is 0.35 of the band range or more: a new named constant), otherwise a triad. A single heard band gives a triad.
- **Hold:** the chord holds while the root and fullness stay the same (today it holds while the note set stays the same, `music.ts:48`). Keep the `chordKey` state.

**3. Voice leading.** Of the chord's inversions inside `HARMONY_LOW_MIDI`..`HARMONY_HIGH_MIDI` (widen the high end to E4, `64`, so a seventh fits), choose the one whose notes move the least in total from the previous frame's chord (sum of distances, notes paired in sorted order). A tie goes to the lower inversion. The first chord uses root position. This needs only `prev.harmony`.

**4. Separate registers.** New values in `src/sonify/ranges.ts`:

| Voice | Today | New |
|---|---|---|
| Bass | C2–C3 | C2–C3 (unchanged) |
| Harmony | C3–C4 | C3–E4 |
| Melody | C3–F#5 | C4–C6 (`MELODY_LOW_MIDI` 60, `MELODY_SPAN` 24) |
| Arpeggio (rhythm) | C4–C5 | C5–C6 (`RHYTHM_LOW_MIDI` 72) |
| Hot spots | C4–C6 | C6–C7 (`HOTSPOT_LOW_MIDI` 84, `HOTSPOT_SPAN` 12) |

The melody keeps two octaves of range, so its resolution in scale steps stays about the same (14 notes on a 7-note scale).

**5. The arpeggio plays the chord.** `rhythmFor` keeps reading the strongest edge line's points, but each point's x picks a chord tone (snapped to the current harmony's pitch classes inside the arpeggio range) instead of any scale note. Busyness (`perBeat`) and pan are unchanged. When there is no harmony (a dropout), the rhythm is already quiet.

**6. The bass plays the chord's root.** The bass's rest note becomes the chord root in the bass range. The data shift is still added on top (`BASS_SHIFT_SEMITONES`) and the result is snapped to the scale, as now (`music.ts:59`). With no harmony it uses the tonic, as today.

**Captions:** `CaptionParts.harmony` keeps `notes` (3 or 4 now). If `captions.ts` says "N notes", it stays true; no wording change is needed.

## Reuse

- `snapToScale`, `pitchClasses` and `SCALES` in `src/sonify/presets.ts`.
- The `state.chordKey` hold and the `prev` frame in `toMusicFrame` (`src/sonify/music.ts:113`).
- The plan goldens: `src/audio/ensemble/plan.golden.test.ts` and `src/audio/ensemble/__golden__/plan.json`. They are meant to change here; regenerate with `npx vitest run -u src/audio/ensemble/plan.golden.test.ts` and read the diff.

## Touches

- `src/sonify/music.ts`, `src/sonify/ranges.ts`, `src/sonify/presets.ts` (only to export a chord helper, if it fits there)
- `src/sonify/*.test.ts` next to them
- `src/audio/ensemble/__golden__/plan.json` (regenerated)
- `src/audio/ensemble/plan.ts`, only if a range it reads moved (for example `MOTION_PAD_MIDI`); no change to the voices or the graph

## Steps

1. Add the chord helper: `chordOn(rootDegree, size, preset)` returning pitch classes, and `voiceChord(pitchClasses, low, high, prev)` returning sorted MIDI notes with the smallest move.
2. Rewrite `harmonyFor` to choose the root and fullness from the histogram, then voice it.
3. Move the ranges in `ranges.ts`.
4. `rhythmFor` snaps to the chord's pitch classes; `bassFor` takes the chord's root.
5. Regenerate the plan golden, read the diff, and render the fixture and two NASA data sets in the browser to listen.
6. Ask the team lead to listen and sign off. Put the data sets you listened to and what you heard under **Result**.

## Tests

- No chord ever has two notes a semitone or a whole tone apart in the same octave (no clusters), over every preset and a sweep of histograms.
- The same histogram gives the same chord; a histogram that only changes in level holds the chord.
- Voice leading: from C–E–G to F major, the result is C–F–A (the smallest move), not F–A–C.
- Every arpeggio note is a pitch class of the frame's chord.
- The voices' ranges don't overlap (bass < harmony < melody < arpeggio < hot spots, except harmony's top third overlapping the melody's floor, if you keep E4).
- Same input, same output: two runs of `toMusicFrame` over the fixture give equal frames.

## Guardrails

- The same input always gives the same output (features, music frames, WAV bytes). Nothing random.
- The peak stays at or below −1 dBFS. No sound plays before a click or key press (WCAG 1.4.2).
- Nothing flashes more than 3 times a second (WCAG 2.3.1). Under `prefers-reduced-motion` everything is still.
- Every voice and cue keeps its text equivalent; captions stay true.
- Nothing specific to one data set goes in `src/` (`.claude/rules/phases.md`). The chord roots and ranges are taste, the same for every data set.

## Done when

- The harmony plays chords built in thirds, voice-led, chosen by the histogram.
- The arpeggio plays chord tones; the bass plays the chord root plus the data shift.
- The voices have separate registers as in the table.
- The plan golden is regenerated and its diff explained in the commit.
- The team lead has listened and signed off.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- The instruments and the reverb (SN19).
- Phrasing over time (repeating motifs, cadences every N bars): a later ticket if this is not enough.
- The old engine (`src/audio/engine.ts`).

## Result

**Branch:** `feature/SN18-real-chords` (agent B). **Commits:** `b45b912` (rules, tests, `music.json` and `plan.json`), `7be15b5` (three goldens outside **Touches** that record the music, see below), and the commit that adds this Result.

**What changed**

- `src/sonify/presets.ts`: `chordOn(rootDegree, size, preset)` (pitch classes stacked in thirds) and `snapToClasses` (`snapToScale` now calls it).
- `src/sonify/music.ts`: `voiceChord` and `isSpaced`. The harmony picks the root from the weighted mean band and the size from the spread, then voice-leads the chord. The arpeggio snaps to the chord's tones, and the bass sits on the chord root plus the data shift.
- `src/sonify/ranges.ts`: the new registers, plus `CHORD_ROOT_DEGREES`, `TRIAD_NOTES`, `SEVENTH_SPREAD` and `MIN_CHORD_GAP`.
- Tests: `music.test.ts`, `presets.test.ts` and `golden.test.ts` (on real data, the arpeggio uses only chord tones and no chord has a second).

**Decided by the agent (to check by ear)**

- **Harmony top is G4 (67), not E4.** Below G4, the tonic chord of the pentatonic presets (A–D–G, stacked fourths) has no voicing without a whole tone, and most sevenths have none without a second. The chord can reach a fifth into the melody's floor (C4). A seventh that cannot be spaced in range plays as its triad (for example the lo-fi IV7).
- **Dorian roots are i, VII, IV, v** (`[0, 6, 3, 4]`), not `[0, 5, 3, 4]`, because dorian's vi is a diminished triad. Major is `[0, 5, 3, 4]` and pentatonic `[0, 1, 2, 3]`, as specified.
- **Melody C4–C6 and arpeggio C5–C6 overlap**, as the table says. The register test therefore checks that each voice starts above the one before and ends no lower. It does not check that they are disjoint.
- **Chords of different sizes:** the move is measured from each note to the nearest note of the other chord (sorted pairing only works for equal sizes).
- **`SEVENTH_SPREAD` stays at 0.35**, but no committed NASA data set reaches it: the spread is 0.08 to 0.26 (Mauritius ≤ 0.12, SST anomaly 0.12, hurricanes ≤ 0.17, global temperature 0.12 to 0.26). So in practice every chord is a triad. A value of 0.2 would give sevenths on some global-temperature frames, but it breaks `src/audio/ensemble/voices.test.ts:109-121` (outside Touches), which needs `[0.3, 0.7, 0]` to give a smaller chord than `[0.2, 0.4, 0.4]`.

**Outside Touches (follow-ups for the owners)**

- Commit `7be15b5` regenerates `src/sonify/__golden__/render.json`, `src/features/player/__golden__/symphony.json` and `src/features/learn/__golden__/voice-cards.json`. They record the music, so `npm test` fails without them. Nothing else in them changed.
- The wording no longer fits. Every chord now reads "Harmony: thick chord, 3 notes" (`src/sonify/captions.ts`). `src/features/learn/voiceCards.ts` ("One note means one kind of value; more notes mean a mix"), `src/describe/recipe.ts` ("thin when the map is of one kind") and the `MusicFrame.harmony` comment in `src/sonify/types.ts` still describe the old one-note-per-band chord.

**Checks** (in `C:/Users/ismai/Desktop/nasa-b`)

```
npm run lint   -> oxlint, no findings
npm test       -> Test Files  219 passed (219)
                  Tests  3044 passed (3044)
                  Duration  144.33s
npm run build  -> tsc -b && vite build: ✓ built (only the usual >500 kB chunk warning)
```

`src/data/sound-regression.test.ts` passed here. Earlier full runs that overlapped another agent's full suite in `nasa-c` had timeouts in `App.test.tsx`, `Explorer.test.tsx` and `player.test.tsx`. When run alone, `App.test.tsx > loads the first visualization and shows it on each page` also failed the same way ("Timed out in waitFor") on an untouched checkout of `556745e`. So those failures come from load, not from this change, and the clean full run above passed them.

**What to listen for** (the agent can't listen; these are the frames the rules produce)

- **Fixture, Major:** C3–E3–G3 over a C2 bass, then C3–F3–A3 (F major, voice-led: C stays, E→F, G→A) over A2 (F plus the data shift), then D3–G3–B3 (G major) over C3, then the dropout. Melody C4 → F4 → D5, hot spots now at C6–C7.
- **Mauritius SST, Major:** F major (F3–A3–C4), then a dropout, then G major (G3–B3–D4), F major, and G major again as D3–G3–B3 (the lower voicing wins the tie), held for most of March to May. It moves to Am (C3–E3–A3) in June and C major (C3–E3–G3) in July and August, as the water cools. The arpeggio is two or three tones of the chord around C5–C6, and the melody holds A5. Listen for the bass leaving the root when the shift is large: A2 under G major, C3 under G, G2 under F. That is the data shift the ticket keeps.
- **SST anomaly, Dorian:** G major (G3–B3–D4, the dorian IV) for all 24 frames, because the histogram barely moves. The arpeggio is busy (four notes a beat) on G and B or D, with the melody on D5. The chord is static, so check whether that is acceptable.
- **Hurricanes 2023, Heavy bass (pentatonic):** E3–A3–D4 (stacked fourths) over E2 for all 31 frames. The arpeggio is sparse on E5 and A5.
- **Global temperature, Cinematic (dorian):** mostly C major (VII), which moves to D3–G3–B3 (G) and E3–G3–C4 (C, first inversion) from the 1940s. It settles on G major from 1980 and ends on Am (E3–A3–C4) in 2025. This is the clearest example of voice leading.
- **Overall:** listen for no clusters, chords that move by small steps, the arpeggio sitting inside the chord, and the voices sounding in separate octaves.

**Sign-off:** waiting for the team lead to listen.
