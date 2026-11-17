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

Filled in by the agent: the branch, the commits, and the real output of the checks, failures included.
