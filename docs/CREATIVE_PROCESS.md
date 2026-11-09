# Creative process: how a NASA map becomes sound

A draft (T87 step 2, written 9 Nov 2026) for the final write-up. Everything here is checked against the code and the docs it points to. What we have **not** yet done is listed under "Limits", and the listening-test results are added when there are some.

## 1. Intent

NASA's Earth Information Center shows Earth as pictures. A blind or low-vision person gets a caption at best. The Earth Jukebox turns each dated map into **sound and text at the same time**, so someone who cannot see the picture can still ask "is this place warmer than last month?" and hear the answer.

We chose three rules and kept to them:

1. **One variable, one main sound.** Pitch carries the value; everything else supports it or says where and when (`docs/SOUND_MAPPINGS.md` §1).
2. **Every sound has a text equivalent.** Nothing is only heard.
3. **Computed, not generated.** The same picture always gives the same note and the same words. No model sits between the picture and the sound.

## 2. The pipeline

| Step | What happens | Where |
|---|---|---|
| Read the picture | Each pixel's colour is matched to the nearest stop of the data set's colour scale. Land, labels and missing data (declared in the manifest) become "no value". | `valueAtPixel` in `src/analysis/analyze.ts` |
| One value per date | The median of the values at a region's sample points, and the share of points in each category. A date with too few valid points is "insufficient". | `analyzePixels` (`src/analysis/analyze.ts`), run in a worker (`src/analysis/worker.ts`) |
| A grid of the whole map | The same reading for every cell, for the sound-map explorer. | `analyzeGrid` (`src/analysis/index.ts`) |
| A category | The median falls in one of five ranges, each with a note (C4 E4 G4 C5 E5, a C major arpeggio, so every step is a pleasant interval). | `mapping.categories` in the data set's manifest |
| Musical extras | A chord from how mixed the area is, a slide when the category changed since the date before, a bell when it jumped two steps or more. | `voicingFor` in `src/audio/voicing.ts` |
| Sound | A struck, mallet-like note, then a short tick; panned from where the region sits on the map. | `src/audio/engine.ts` (Tone.js), `src/audio/pan.ts` |
| Words | A sentence per date, concise or rich, and one for a whole run. | `describeFrame`, `describeSequence` in `src/describe/index.ts` |

Everything specific to one data set (colour scale, categories, words, comparisons, story) is in its `manifest.json`, never in `src/`. That is how a second data set was added without changing code (`docs/DATASET-PLAYBOOK.md`).

## 3. The sound choices, and why

- **Pitch up means more.** Higher temperature is a higher note. For temperature this is the safest polarity; for other variables (ice, for example) it is to be checked in a listening test before it is fixed (`docs/SOUND_MAPPINGS.md` §1 and §7).
- **Five categories, not a continuous glide.** Five clear notes are easier to tell apart and to compare than a slide, and they match the categories the words use.
- **Where it is, in stereo.** The region's position on the map pans the note west to east. An optional 3D mode (HRTF, for headphones) also places north above and south below.
- **Missing data is a hiss, never a low note.** A short burst of pink noise means "no data". If it were a low note, a cloud-covered date would sound cold. We keep this cue the same everywhere (`docs/SOUND_MAPPINGS.md` §5).
- **A tick between dates** (C6, 60 ms) so repeated notes stay separate.
- **A "simple" style** with just the main note, for listeners who find the chord and bell too much.
- **The change from normal** (v2, an opt-in style): instead of the temperature it plays how far a date is above or below a baseline: a held bed whose pitch steps with the change (C3 to C4), and a moving tone that traces the line where the change reaches +1 or +2 degrees. Loudness is matched across steps, and the master chain limits the peak, so "warmer" is never "louder". The measurements are in `docs/performance.md`, the cue table in `docs/SOUND_MAPPINGS.md` §8.
- **Same input, same sound.** The reverb is `Freeverb`, not `Tone.Reverb`, because the latter builds its impulse from random noise (`src/audio/engine.ts`). Live playback and the WAV download use the same voices.

## 4. What the app does with the sound

- **Listen:** play the dates, step through them, explore the map by keyboard, finger or mouse (arrow keys move over places and play each one; a row or column can be swept), lock a place and hear it change across the dates, hear the legend, "what the sound hides", a data table, and a link to the exact moment.
- **Learn:** every cue played once, with its text.
- **Compare:** pick two dates, hear both, answer, and see the reveal. A listening-test mode records answers on the server.
- **Ask:** rule-based answers from the data, offline.
- **Voice guide (optional):** a spoken guide through Gemini Live. It can only reword and use five allow-listed actions; everything else in the app works with the server off (`src/boundary.test.ts` fails if the analysis, sound or description code touches the guide or the network).

## 5. What we rejected, and why

| Idea | Why not |
|---|---|
| Video or live satellite imagery in the app | Heavy and unpredictable. Frames are converted to PNG offline. |
| A language model that "describes the picture" | Not repeatable, and it could say things the data does not show. Descriptions are written by rules. |
| The voice guide on Google's Agent Development Kit | The spike showed it added weight without adding anything a listener needs (`docs/adk-spike.md`). Cut on 7 Nov. |
| Timbre (instrument) as the carrier of the value | Instrument-to-meaning matches are weak and differ between people. Timbre may say *what*, never *how much* (`docs/SOUND_MAPPINGS.md` §1). |
| A listening-test results page | With no testers yet, empty statistics would hurt. We report n and the caveats instead. |
| MIDI export, a contrast and text-size settings panel | No audience for the first; the browser already does the second. |

## 6. Accessibility decisions

- Every control has a label and works by keyboard; changes are announced through one live region (`useAnnounce`).
- No sound or speech starts before a click or key press. A link that opens on a map cell stays silent until the first key.
- Descriptions can be concise or rich; the choice is remembered.
- The map is explored by keyboard first. Touch and sliders are the same cursor, not a separate mode.
- Vibration marks each date on phones that support it (not iPhones).
- The sound never carries anything the text does not: the data table and descriptions give the same facts.
- The welcome mascot never talks over a screen reader.

## 7. Limits (as of 9 Nov 2026)

- **Not yet tested with blind or low-vision users.** n = 0 (`docs/evidence/results-note.md`). Anything about how well it works for them is still a claim to test.
- **The change style has not had its listening check**, so it stays opt-in (`docs/TICKETS.md` T114).
- **Numbers are read from pictures.** The app reads colours from NASA's rendered maps, not NASA's data files, so values are "about" (within the colour scale's steps).
- **One real data set so far:** sea surface temperature around Mauritius (`public/data/mur-sst-mauritius`). Its baseline is a reference date, so "change" there partly follows the season (`docs/data-sources.md`).
- **Vibration does not work on iOS.** The music-pauses-for-the-guide behaviour and vibration have not been checked on a real phone.
- **The server sleeps** on Render's free tier; the voice guide and the test API can take up to a minute to wake. The rest of the app does not need it.

## 8. Adding a data set

Follow `docs/DATASET-PLAYBOOK.md`: record the source, convert the frames, fill in the manifest (colour scale, categories, comparisons, story), run `npm run check-data`, and listen. No code changes are needed unless a new general manifest field is.
