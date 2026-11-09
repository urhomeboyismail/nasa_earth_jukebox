# SN05 Manifest fields `video`, `sonification`, `legend`, with defaults

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | schema, catalogue |
| **Branch** | `feature/SN05-manifest-v3-fields` |

## Goal

Three optional manifest fields, so a data set can say where its animation is (`video`), how it should be sonified (`sonification`) and whether its colour bar is data or a picture (`legend`). Every data set that exists today validates unchanged. `npm run check-data` checks that the video file exists and that every dated frame falls on the video's date grid.

This ticket also writes the three lists the v3 code uses (`PRESET_IDS`, `DETAIL_LEVELS`, `VOICE_IDS`), so there is one place for them.

## Why

- `src/data/types.ts` `Visualization` has no field for a video, a preset or a legend type. The v3 design needs all three (`docs/PLAN.md` §6.3, "EIC data").
- `src/data/schema.ts` is a `z.object` with `superRefine` checks. Its top-level object is not `strict()`, so an unknown field is dropped silently today. A typo such as `sonifcation` would then do nothing and say nothing. The new fields must be validated, not just allowed.
- `src/data/check.ts` `checkDataset` already reads each frame's file through `readImage(path)` and reports readable messages (for example `frames.1.image`). A video is checked the same way.
- `src/data/schema.ts` `checkChange` shows the cross-field rule style to copy for the date grid.

## Design

### Lists (`src/data/sonification.ts`, new)

```ts
export const PRESET_IDS = ['major', 'dorian', 'pentatonic'] as const
export type PresetId = (typeof PRESET_IDS)[number]
export const DETAIL_LEVELS = ['calm', 'standard', 'full'] as const
export type DetailLevel = (typeof DETAIL_LEVELS)[number]
/** The seven voices of the ensemble, in the order the captions list them. */
export const VOICE_IDS = ['melody', 'harmony', 'bass', 'hotspots', 'rhythm', 'motion', 'time'] as const
export type VoiceId = (typeof VOICE_IDS)[number]

/** A data set with no `legend` field is data; read it with this, never with `v.legend` directly. */
export function legendOf(v: { legend?: 'data' | 'picture' }): 'data' | 'picture' { return v.legend ?? 'data' }
```
`src/sonify/presets.ts` (SN03) must define exactly these preset ids. `src/sonify/detail.ts` (SN03) must define a value for each detail level.

### Types (`src/data/types.ts`)

```ts
import type { DetailLevel, PresetId, VoiceId } from './sonification'

/** The animation a live reader plays (SN06). The file is in the data set's folder. Video frame n shows the date `firstFrameDate + n × frameStepDays`. */
export type VideoSpec = {
  /** Relative to the manifest, for example "video/<id>.mp4". Same origin: an H.264 MP4 the site serves itself. */
  src: string
  /** Video frames a second, 1 to 60. */
  fps: number
  /** YYYY-MM-DD: the date shown in the first video frame. */
  firstFrameDate: string
  /** Whole days between consecutive video frames, 1 or more. */
  frameStepDays: number
}

/** How the data set is sonified by default (SN07). Every field after `preset` is optional. */
export type SonificationSpec = { preset: PresetId; detail?: DetailLevel; voices?: VoiceId[] }
```
Add to `Visualization`:
```ts
  /** v3: 'data' (default) when the colour bar decodes values; 'picture' for true-colour imagery with no measured values (the extractor reads brightness). */
  legend?: 'data' | 'picture'
  /** v3: the animation for live reading. Optional; without it, Symphony reads the checked frames. */
  video?: VideoSpec
  /** v3: the default sonification. Optional; without it, Listen uses preset 'major', detail 'standard', all seven voices. */
  sonification?: SonificationSpec
```
`voices`, when given, is a non-empty list of distinct voice ids. A voice left out is never sounded for this data set.

### Schema (`src/data/schema.ts`)

- `legend: z.enum(['data', 'picture'], { error: 'must be "data" or "picture"' }).optional()`.
- `video: z.object({ src: nonEmpty, fps: z.number().positive().max(60), firstFrameDate: isoDate, frameStepDays: z.number().int().min(1) }).optional()`.
- `sonification: z.object({ preset: z.enum(PRESET_IDS), detail: z.enum(DETAIL_LEVELS).optional(), voices: z.array(z.enum(VOICE_IDS)).min(1).optional() }).optional()`, with `voices` checked for duplicates in `superRefine`.
- The date grid, in `superRefine` (cross-field, in the same place as `checkChange`): when `video` is given, every frame's date must be `firstFrameDate` plus a whole number of `frameStepDays`, and not before `firstFrameDate`. The message names the field and the rule, for example `frames.3.date: 2026-01-04 is not on the video's grid: the first video frame is 2026-01-01 and frames are 1 day apart`. Use `Date.UTC` day arithmetic, the same as `src/dates.ts`.
- Add `.strict()` **only** for these three objects (`video`, `sonification`, and the `voices` list), so a typo inside them is reported. The top level keeps its current behaviour (unknown top-level keys are dropped, as today) so that no data set breaks.

### Check (`src/data/check.ts`)

In `checkDataset`, when `video` is given:
- `readImage(video.src)` must return bytes. If it throws: `video.src: there is no file "<src>" in public/data/<id>/`.
- The bytes must hold an MP4 `ftyp` box at offset 4. Otherwise: `video.src: "<src>" is not an MP4 file (no ftyp box); convert it to H.264 MP4 (scripts/eic_ingest.py, EIC01)`.
- Do not decode the video. Only the file's presence and its container are checked here.

### Date helpers (`src/data/video.ts`, new)

```ts
/** The date shown in video frame `index` (0-based). index may be any whole number of 0 or more. */
export function dateOfVideoFrame(video: VideoSpec, index: number): string
/** The video frame index that shows `date`, or null when that date is not on the video's grid. */
export function videoFrameOf(video: VideoSpec, date: string): number | null
/** The data set's frame dates on its video's grid, in order. */
```
Both are pure; they use `Date.UTC` and whole days only.

### Export (`src/data/index.ts`)

Re-export `PRESET_IDS`, `DETAIL_LEVELS`, `VOICE_IDS`, `PresetId`, `DetailLevel`, `VoiceId`, `legendOf`, `dateOfVideoFrame`, `videoFrameOf` (the types with `export type`).

### Documentation (`docs/data-sources.md`)

In "Manifest fields", add a sub-section "v3 fields (SN05)": one row per field (`legend`, `video`, `sonification`) with its default and what it does, and the rule about the date grid. Say that the defaults keep every data set as it is.

## Reuse

- `nonEmpty`, `isoDate`, `fraction` and the `superRefine` style in `src/data/schema.ts`.
- `readImage` in `src/data/check.ts`, as the frame checks use it.
- `src/dates.ts` for day arithmetic if it has a helper; if not, `Date.UTC` in `video.ts`.
- `visualizationSchema` and the existing schema tests (`src/data/schema.test.ts`).

## Touches

- `src/data/sonification.ts` (new), `src/data/video.ts` (new), `src/data/types.ts`, `src/data/schema.ts`, `src/data/check.ts`, `src/data/index.ts`.
- Tests: `src/data/sonification.test.ts` (new), `src/data/video.test.ts` (new), and additions to `src/data/schema.test.ts` and `src/data/check.test.ts`.
- `docs/data-sources.md` (the sub-section only).
- No `public/data/` file changes in this ticket (the first data set with a video is EIC03).

## Steps

1. Write `sonification.ts` and `video.ts`, with their tests.
2. Add the three fields to `types.ts`. Check that `schema.test.ts`'s compile-time check still passes (the zod output must equal the types).
3. Add the zod schemas and the `superRefine` rule for the date grid, with a test for each rule (a valid grid, a date off the grid, a date before the first frame, a duplicate voice, an unknown preset).
4. Add the file check to `checkDataset`, with its tests (a missing file, a file that is not an MP4, a good one, using fake bytes).
5. Export from `index.ts` and write the documentation sub-section.
6. Confirm every current data set still validates: `npm run check-data` and `npm test`.

## Tests

- Every current data set (`fixture`, `synthetic-ocean`, `synthetic-globe`, `synthetic-change`, and any `rehearsal-*` you have locally) still passes the schema with none of the new fields. `datasets.test.ts` already loops over the catalogue; keep it green.
- A manifest with `legend: 'picture'` validates; `legend: 'sepia'` is rejected with a message naming `legend`.
- A manifest with `video` on the grid validates; one frame off the grid is rejected and the message names `frames.<i>.date`; a `firstFrameDate` after the first frame is rejected.
- `sonification.preset` unknown is rejected; `voices` with a duplicate is rejected; `detail` unknown is rejected.
- `legendOf({})` is `'data'`; `dateOfVideoFrame` and `videoFrameOf` round-trip for every frame of a grid, and `videoFrameOf` returns `null` for an off-grid date.
- `checkDataset` with a `video` whose file is missing reports `video.src`.

- **Golden.** `src/data/__golden__/video-grid.json`: for the fixture and each `synthetic-*` set, the grid the set would need if it had a video (`firstFrameDate` = its first frame's date, `frameStepDays` = 1), and `videoFrameOf` for every frame date. Any change to the date arithmetic shows in the diff.

## Guardrails

- Nothing data-set-specific in `src/`: the three lists name presets, detail levels and voices, not any data set.
- The defaults keep every current data set exactly as it is. A test proves it.
- A bad manifest gives a readable message, naming the field (`phases.md`, "readable errors").
- No sound and no shown change in this ticket: the fields only describe what the later tickets do.

## Done when

- The three fields validate, with the tests above, and the defaults keep every current data set valid.
- The date-grid rule and the MP4 check report readable messages.
- `docs/data-sources.md` documents the three fields and their defaults.
- `npm run lint && npm test && npm run build` and `npm run check-data` pass with their real output in Result.

## Checks

```bash
npm run lint && npm test && npm run build
npm run check-data
```

## Out of scope

- Reading the video (SN06), the Listen page (SN07), the EIC ingest script that writes the field (EIC01).
- A check that the video's frame count matches the frames (the file is not decoded).
- Changing `colorScale`: it stays required for every data set, including picture ones. A picture data set still needs a colour scale in the manifest.

## Result

Built on `feature/SN05-manifest-v3-fields` by agent B, 10 Nov 2026 (Windows 11, Node, Git Bash).

**What changed**

- `src/data/sonification.ts` (new): `PRESET_IDS`, `DETAIL_LEVELS`, `VOICE_IDS`, their types, `LegendKind` and `legendOf`.
- `src/data/video.ts` (new): `dateOfVideoFrame`, `videoFrameOf`, and `dayNumber` (whole UTC days; `null` for a date that is not real, such as 2024-02-30). `videoFrameOf` returns `null` instead of dividing when `frameStepDays` is not a whole number of 1 or more.
- `src/data/types.ts`: `VideoSpec`, `SonificationSpec`, and `legend`, `video`, `sonification` on `Visualization`.
- `src/data/schema.ts`: the three fields (`video` and `sonification` strict), the duplicate-voice rule and the date-grid rule in `checkV3`. The grid rule is skipped when `frameStepDays` is already invalid, so a step of 0 gives one message, not one per frame.
- `src/data/check.ts`: `checkVideo`, which reports a missing file or a file with no `ftyp` box at offset 4 on `video.src`.
- `src/data/index.ts`: the exports listed in the design, plus `LegendKind`.
- `docs/data-sources.md`: "v3 fields (SN05)".
- Tests: `sonification.test.ts`, `video.test.ts` (with the golden `__golden__/video-grid.json`), and new blocks in `schema.test.ts` and `check.test.ts`. The golden numbers were checked by hand: the fixture's dates are 0, 182, 335 and 425 days after 2024-01-15.

**Notes for later tickets**

- `video.src` stays relative to the manifest after `loadVisualization` (only frame images are resolved there today). SN06 must resolve it against the data set's folder, the way `loadVisualization` resolves `frames[].image`, or a later ticket can resolve it in `loadVisualization`. `index.test.ts` is not in this ticket's Touches, so I left that change out.
- The design's third date helper ("The data set's frame dates on its video's grid, in order") had no signature and is not in the export list, so it is not written.

**Checks** (real output, trimmed to the summary lines)

```
$ npm run lint
> oxlint
LINT EXIT 0

$ npm test
     × notices when one legend stop of the fixture changes 27ms
 FAIL  src/data/sound-regression.test.ts > sound regression baseline > notices when one legend stop of the fixture changes
 Test Files  1 failed | 65 passed (66)
      Tests  1 failed | 1230 passed (1231)

$ npm run build
dist/assets/index-BYm4v1ZF.js             392.23 kB │ gzip: 122.82 kB
✓ built in 793ms

$ npm run check-data
 Test Files  1 failed | 10 passed (11)
      Tests  1 failed | 213 passed (214)
```

The one failure is the same test both times, and it is not caused by this ticket. This Windows checkout has `core.autocrlf=true` (set in `C:/Program Files/Git/etc/gitconfig`), so `src/data/__golden__/fixture.json` is on disk with CRLF line endings, and `sound-regression.test.ts:88` compares it as raw text with `toBe`. With the file converted to LF (no change to git, which stores LF), the test passes:

```
$ npx vitest run src/data/sound-regression.test.ts
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

The file was then restored with `git checkout`. Neither the file nor the test is in this ticket's Touches. On Linux or CI they pass as they are.
