# D04 Known-answer check: decoded values against NASA's numbers

| | |
|---|---|
| **Priority** | P1 |
| **Size** | S (under half a day) |
| **Who** | agent+👤 |
| **Needs** | — |
| **Hotspots** | catalogue |
| **Branch** | `feature/D04-known-answer-check` |

## Goal

For a data set, a list of points where the value is **known from NASA's own numbers** (the data file or the value the source publishes, at a stated place and time) is kept in `public/data/<id>/known-answers.json`. A test decodes the frame's picture at each point through the legend and checks that the value read from the colour matches NASA's number, within the legend's own rounding. A mismatch names the frame, the place, NASA's value and the value read. The test runs in `npm run check-data` for every data set that has the file.

## Why

- `npm run check-data` checks that the legend reads back its own stops, and that the frames are the right size. It does not check that the **picture means the same numbers as NASA's**. A converter or a legend that is off by one step would pass every check today.
- The frames are decoded through `valueAtPixel` (`src/analysis/analyze.ts`), the same function the app uses. A known-answer check therefore tests what the listener hears and reads.
- `src/data/check.ts` `legendRounding(stops)` already gives the largest change in value that one step of colour can make. That is the honest tolerance, and it is used here instead of a made-up one.
- The synthetic sets prove the arithmetic (`expected.json`), but not the match to NASA. Only a NASA number can do that.

**Order.** The queue lists S02 (the `mur-sst-mauritius` salvage) because the first real known answers are for that data set. The mechanism and its test (steps 1 to 4) do not need S02 and can merge first; the data file for `mur-sst-mauritius` comes after S02 merges.

## Design

### The file (`public/data/<id>/known-answers.json`)

```json
{
  "id": "mur-sst-mauritius",
  "map": { "west": 55.0, "east": 65.0, "north": -10.0, "south": -22.0, "projection": "equirectangular" },
  "checks": [
    {
      "frameId": "2024-03-15",
      "lat": -19.5, "lon": 57.5,
      "value": 27.4, "unit": "°C",
      "decimals": 1,
      "source": {
        "dataset": "<the NASA data set's short name, as the source page gives it>",
        "variable": "<the variable name in that file>",
        "time": "2024-03-15T00:00:00Z",
        "url": "<the page or the file's address>",
        "retrievedOn": "YYYY-MM-DD"
      }
    }
  ]
}
```
- `map` is the extent of the map in degrees. It converts `lat`, `lon` to the picture: `x = (lon − west) / (east − west)`, `y = (north − lat) / (north − south)`, both as fractions of the image (inside `mapArea` if the data set has one). A map that is not equirectangular gives `"projection": "other"` and a list of `control` points (`{ lat, lon, x, y }`, at least 4), and the test uses them with a bilinear fit. Only one of the two forms is allowed (zod).
- `checks` has at least 5 entries, spread across the map, with at least one near each end of the legend and none on land or within one cell of a coast.
- `tolerance` (optional, the same unit) adds to the legend rounding; the default is 0. `decimals` is how many decimals NASA's number has, shown in the message.
- `source` is required for every check. An entry with no source is an error.

### The schema (`src/data/knownAnswers.ts`, new)

```ts
export const knownAnswersSchema = z.object({ id, map: …, checks: z.array(check).min(5) })   // zod, strict on the file's own keys
export type KnownAnswers = z.infer<typeof knownAnswersSchema>
/** The largest honest difference: the legend's rounding (check.ts legendRounding) or the tolerance, whichever is larger. */
export function allowedError(stops: ColorScale['stops'], check: { tolerance?: number }): number
/** The image point of a check, as fractions of the image (lat/lon through the map, or the control points). */
export function pointOf(check, map): { x: number; y: number }
```

### The test (`src/data/known-answers.test.ts`, new)

1. For each id in `public/data/index.json`, if `public/data/<id>/known-answers.json` exists: parse it through `knownAnswersSchema` (readable error on failure).
2. Load the manifest through `visualizationSchema`. Each check's `frameId` must be a frame of the data set.
3. Decode the frame's PNG (`decodePng`, `src/analysis/png.ts`), then `px = floor(x × width)`, `py = floor(y × height)`, and read `valueAtPixel(pixels, px, py, colorScale)`.
4. Pass when the read value is not `null` and `|read − value| ≤ allowedError`. A `null` read fails with "cannot be read: the point is on land, cloud, a label or off the legend; move the point".
5. The message on a failure, one line: `<id> <frameId> at <lat>, <lon>: NASA's number is <value> <unit>, the picture reads <read> (allowed <e>). Check the point and the legend.`
6. The test also checks the mechanism on a made-up scene with a known answer (`src/test/changeScene.ts` `scene()`), for a passing check and a failing one, so the test itself is proven.

## Reuse

- `decodePng` (`src/analysis/png.ts`), `valueAtPixel` (`src/analysis/analyze.ts`).
- `legendRounding` (`src/data/check.ts`).
- `visualizationSchema` (`src/data/schema.ts`), `catalogSchema`, `loadCatalog`'s file (`public/data/index.json`), as `src/data/datasets.test.ts` reads them.
- `scene()` in `src/test/changeScene.ts` for the mechanism test.
- `check-data`'s file reading (`readFileSync` as in `change-regression.test.ts`).

## Touches

- New: `src/data/knownAnswers.ts`, `src/data/known-answers.test.ts`.
- Per data set (step 5, after the person supplies the numbers): `public/data/<id>/known-answers.json`.
- Edit: `docs/data-sources.md` (a short section "Known answers (D04)": the file, its fields, how to get a NASA number).
- Do not change any existing data set's files in this ticket except adding its `known-answers.json`.

## Steps

1. Write `knownAnswers.ts` (schema, `allowedError`, `pointOf`) with tests for the map conversion and the tolerance.
2. Write `known-answers.test.ts`: the loop over the catalogue, the messages, and the mechanism test on the made-up scene (a pass and a fail).
3. Run `npm run check-data`: with no data set having the file, the loop must do nothing and pass.
4. Write the section in `docs/data-sources.md`.
5. **(👤)** The person opens the NASA source for the data set (the data file or the published value), reads the value at each chosen point and time, and writes a table: lat, lon, time, value, unit, decimals, the dataset's short name, the variable, the URL and the day read. No value comes from memory or from the picture.
6. **(agent)** Converts the table into `known-answers.json`, computing `x` and `y` from `map`, and checks that each point is inside `mapArea` and on water (run the test).
7. **(👤)** Looks at the failing checks, if any, and decides: the point is moved, or the legend is wrong (then the data set is not signed off), or the NASA number is the one to check again.

## Tests

- Schema: a check with no `source` is rejected; fewer than 5 checks is rejected; both `map` and `control` given is rejected; a `frameId` not in the data set is rejected by the test.
- `pointOf`: the corners of `map` give the corners of the image (0 and 1); the centre of the map is `(0.5, 0.5)`.
- `allowedError`: equal to `legendRounding(stops)` when `tolerance` is 0; the tolerance when it is larger.
- Mechanism: on the made-up scene, a value at the scene's known level passes; the same point checked against a value 3 units off fails with the one-line message.
- Each data set with the file: every check passes (the test loops; it is empty until a person adds a file).
- `check-data` runs this test with the rest of `src/data`.

## Guardrails

- A NASA number is never invented, estimated or copied from the picture. The source (the dataset, the variable, the time, the URL and the day read) is written for every check.
- A failing check is never "fixed" by changing the tolerance without a reason written in the file.
- A legend that disagrees with NASA's numbers stops the data set's sign-off: the legend is checked again, not the test.
- No data-set-specific code in `src/` (the test reads any data set's file).
- No network: the numbers come from a person reading the source, not from the test.

## Done when

- The mechanism passes its tests, and `npm run check-data` passes with no known-answer file present.
- The section in `docs/data-sources.md` exists.
- For the first data set that has NASA numbers (after S02), its `known-answers.json` passes, and the person has signed off on the table (with the sources).
- `npm run lint && npm test && npm run build` pass with their real output in Result.

## Checks

```bash
npm run check-data
npm run lint && npm test && npm run build
```

## Out of scope

- Choosing the data set or downloading NASA's data (EIC02, EIC03, S02).
- Checking the synthetic sets against NASA (they are made up; their own `expected.json` covers them).
- Checking the sound or the words (H04, H08).
- A projection other than equirectangular, beyond the control-point form.

## Result

Steps 1 to 4 built by agent D on `feature/D04-known-answer-check`, 12 Nov 2026. Steps 5 to 7 need a person (NASA's numbers) and are not done, so no data set has a `known-answers.json` yet.

**What changed**

- `src/data/knownAnswers.ts` (new):
  - `knownAnswersSchema` is strict, with `map` either `equirectangular` (west/east/north/south, the right way round) or `other` (at least 4 `control` points that can be fitted), never both. It requires at least 5 checks, each with a full `source`.
  - `allowedError` is the larger of `legendRounding` and `tolerance`. The Design text says the tolerance "adds", but the function comment and Tests say "whichever is larger", so it follows Tests.
  - `pointOf` puts an equirectangular map into `mapArea`; control points are fitted bilinearly by least squares (`fitControl`).
  - `checkKnownAnswers` returns one line per failure: a wrong number, a point that can't be read (land, cloud, a label), a frame not in the data set, a point outside the map, or a file whose `id` doesn't match. It decodes each picture once.
- `src/data/known-answers.test.ts` (new), run by `npm run check-data` with the rest of `src/data`: the loop over `index.json`, which is empty until a file exists; a test that every file belongs to a listed data set; and the schema, `pointOf`, `allowedError` and mechanism tests on `scene()` from `src/test/changeScene.ts`. The mechanism tests include a pass, a 3-unit fail with the exact one-line message, a land point, a missing frame, a point off the map and a mismatched id.
- `docs/data-sources.md`: the section "Known answers (D04)", covering the file, its fields, how to get a NASA number, and what to do when a check fails.

**Left for a person (steps 5 to 7)**: read NASA's numbers for `mur-sst-mauritius` (at least 5 points with their sources) from the PO.DAAC MUR data, then an agent converts the table to `public/data/mur-sst-mauritius/known-answers.json` and runs the test.

**Checks** (Windows, Node 24.19.0)

`npm run lint`:
```
> moon-heist@0.0.0 lint
> oxlint
```
(exit 0, no findings)

`npm run build`:
```
✓ built in 1.42s
```
(exit 0)

`npm test` (as `npx vitest run --maxWorkers=2`; the default 8 workers run out of memory on this 8 GB laptop):
```
 FAIL  src/data/sound-regression.test.ts > sound regression baseline > notices when one legend stop of the fixture changes
 Test Files  1 failed | 109 passed (110)
      Tests  1 failed | 1817 passed (1818)
   Duration  112.88s
```

`npm run check-data` (as `npx vitest run --maxWorkers=2 src/data src/analysis/synthetic.test.ts`):
```
 FAIL  src/data/sound-regression.test.ts > sound regression baseline > notices when one legend stop of the fixture changes
 Test Files  1 failed | 12 passed (13)
      Tests  1 failed | 262 passed (263)
```

`src/data/known-answers.test.ts` alone: `Tests  15 passed (15)`.

The one failure is not from D04. It fails the same way on clean `main`: this machine checks files out with `core.autocrlf=true`, so `src/data/__golden__/fixture.json` has `
` on disk, and the test compares it against `
` text (see JB04's Result). With no `known-answers.json` present, the loop adds no tests and passes, as step 3 asks.
