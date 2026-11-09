# IX12 Art mode: your own preset, recorded and exported

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | SN03, SN12 |
| **Hotspots** | player |
| **Branch** | `feature/IX12-art-mode` |


## Goal

A listener makes their own sound: a key, a scale, a tempo and a brightness, saved as a preset. They play it on any data set, record it and export both the WAV and the preset file. The panel is labelled: "Art mode: the sound choices are yours; the data mapping doesn't change."

## Why

- Presets are the artistic layer (PLAN §6.3: "key, scale and instruments come from a preset, which is artistic, the same for every frame and never carries data"). SN03's `Preset` has the key (`tonic`), the `scale`, the `bpm` and the `brightness`; it has no instrument field, and the voice timbres are fixed in SN04. The listener has no way to choose a preset.
- F57 (a piano voice, presets in SN03) is parked in the archive (`docs/archive/README.md`). This ticket gives the listener the choice that F57 wanted, without changing the data mapping.
- The data mapping is the part that carries meaning. The listener must be able to see that it is not changed.

## Design

- **What the listener may change.** Only these fields of SN03's `Preset`: `tonic` (the key, 0 to 11), `scale` (`major`, `dorian` or `minorPentatonic`), `bpm` (60 to 120) and `brightness` (0 to 1). Instruments are not a choice in this version (see Why). A timbre choice, if the team wants one, is an SN04 change posted on the board, not something this ticket adds. The ruleset (SN03's function from `FrameFeatures` to `MusicFrame`) is not editable. The editor has no control that maps a feature to a voice, so there is no UI path to change the mapping.
- **The label.** The panel's heading and first line read exactly: "Art mode: the sound choices are yours; the data mapping doesn't change." The same text is the panel's accessible description.
- **Save and load.** Presets are kept under `earth-jukebox:art-presets`: at most 10, each with a name the listener gives. Load, rename and delete are buttons.
- **Import and export.** Export downloads the preset as JSON (`*.preset.json`). Import reads a file, parses it, and validates it with a zod schema written in this feature (`src/features/art/schema.ts`), built from SN03's `Preset` type and the four fields above. SN03 has no runtime schema to reuse, so this ticket writes one and does not add it to SN03's folder. An invalid file is refused with a text message and changes nothing.
- **Play.** The chosen preset is applied to the Listen page's Symphony mode (SN07) for this session. It goes back to the default when the listener turns art mode off.
- **Record.** "Record this art" uses SN12's offline render with the chosen preset, and downloads the WAV. The file name uses the preset's name and the data set's id.

## Reuse

- SN03: `Preset`, `PRESETS`, `presetFor`, `SCALES` and the ruleset (names from SN03's ticket file). Do not redefine them.
- SN07: the Symphony mode's preset input (its name from SN07's ticket file).
- SN12: the offline render (its function name from SN12's ticket file).
- `src/components/Button.tsx`, `Slider.tsx`, `useAnnounce`.

## Touches

- `src/features/art/presets.ts` (pure: the editable fields and the save and load rules), `schema.ts` (zod: the preset file and the stored list), `store.ts`, `ArtPanel.tsx`, `useArt.ts`, and tests next to each.
- `src/features/player/index.tsx`: mount the panel and pass the chosen preset to SN07's input (one line each). `player.test.tsx`.
- Nothing in `src/sonify/` changes. If SN03 lacks a field the listener must choose, post on `docs/AGENT-BOARD.md` for the SN03 owner.

## Steps

1. Write `presets.ts`: list the editable fields, and a function that applies a choice to a `Preset` and returns a new one.
2. Test that the ruleset gives the same driver values for the same features with any art preset (see Tests).
3. Write `store.ts` with zod: the list of up to 10 named presets; a corrupt list falls back to none.
4. Write `ArtPanel.tsx`: the heading, the label, the fields (buttons and sliders only), save, load, delete, export, import, record.
5. Apply the chosen preset through SN07's input, and reset it when art mode is off.

## Tests

- `presets.test.ts`: applying a choice changes only the editable fields; an attempt to set a field outside the list is refused.
- The mapping test: the same `FrameFeatures` run through SN03's ruleset with two different art presets give the same driver values (for example the melody's `stats.median` mapping, the harmony's band weights, the hot-spot pitch from the peak). Only the key, the scale, the tempo and the brightness differ, and the test checks that only those four fields are read from the art preset. This test is the proof that the data mapping does not change.
- `store.test.ts`: at most 10 presets; a corrupt list is ignored.
- Import: a valid preset file is accepted; a file with an unknown field, a bad type or a non-JSON body is refused with the message, and the current preset is unchanged.
- Export then import gives the same preset.
- `ArtPanel.test.tsx`: the label text is in the document and is the accessible description; every control has a name; `expectNoA11yViolations`.
- Record: the render is called with the art preset; a download link is made (stub `URL.createObjectURL`).

## Guardrails

- The same preset and the same frames give the same WAV bytes (SN12's guarantee).
- Peak at or below −1 dBFS; the preset cannot raise the limiter's ceiling (SN04's master bus is not editable here).
- No sound before a key press or click.
- Nothing flashes.
- Every sound has its text: the preset's name and the label; the recording's status is visible text.
- Changes are announced through `useAnnounce`: preset saved, loaded, refused, recorded.
- No data-set name in `src/`. Presets are general; a manifest only names one.

The five principles, for this ticket:
1. A preset change is heard on the next frame at once (the same `apply` and `playNotes` path as the rest).
2. Sound first: the listener's own sound is the point; words are the labels and the messages.
3. Art mode turns off and the default returns; nothing is saved without a save.
4. Keys are not added: all controls are buttons and sliders, so every device works.
5. The label teaches the difference between the choices and the data.

## Done when

- Art mode shows the label; the listener can choose a key, a scale, a tempo and a brightness, and hear them on a data set.
- The mapping test passes: two presets give the same driver values for the same features.
- A preset exports and imports; an invalid file is refused.
- A recording downloads a WAV with the preset's sound.
- All tests pass and the checks are green.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- Editing the mapping, the ruleset or the voices SN04 provides.
- Sharing presets through a server or an account.
- A piano voice, any new instrument, or a timbre choice (SN03 and SN04 own the voices).

## Result

Not started.
