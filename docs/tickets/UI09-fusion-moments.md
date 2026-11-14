# UI09 Remix: a chord when both decks peak together, and one caption strip

| | |
|---|---|
| **Priority** | P2 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | — |
| **Branch** | `feature/UI09-fusion-moments` |

## Standalone

It builds on Fusion as it is on `main` (`src/features/compare/Fusion.tsx`, `src/sonify/fuse.ts`). Neither file is in a hotspot, and it does not edit `compare/index.tsx`.

## Goal

In Compare's "Two data sets" mode, when both decks are at an extreme at the same moment and place, the listener hears a short composite chord. It is consonant when both extremes point the same way (both high or both low) and dissonant when they oppose. One caption strip under the decks says what happened in words.

## Why

- The master prompt asks for "composite harmonic/dissonant events when overlapping extreme metrics align, accompanied by a unified accessibility caption strip".
- Fusion already plays deck A left and deck B right with a crossfader, and its caption names the deck behind each phrase (`Fusion.tsx:18`, `:59`). Nothing marks the moments both decks agree.

## Design

- **Pure detection** in `src/sonify/fuse.ts`: `alignedExtremes(a, b, options): Aligned[]`. It works over the two decks' frame analyses on the shared dates (`fusionDates.ts`).
  - A frame is extreme for a deck when its value is in the top or bottom 10% of that deck's own range on those dates.
  - Two extremes align when they fall on the same date and in the same region, or within one sampling cell when there are no regions.
  - Each `Aligned` is `{ dateIndex, regionLabel?, kind: 'together' | 'opposed', aHigh: boolean, bHigh: boolean }`.
  - It is deterministic, with no randomness.
- **Sound:** at an aligned frame, a 600 ms chord through the existing Fusion output, centred. `together` is a major triad on the current key's root; `opposed` adds a minor second. Its level follows the crossfader's middle at −12 dB below the decks, and it never exceeds the −1 dBFS ceiling.
- **Caption strip:** one `<p>` under the decks. It updates with each moment ("Both high together, north-east: A's rainfall and B's wind"), uses the manifests' variable words (`variableWords`) and is announced through `useAnnounce`. Under the announcer's rate limit, moments closer than 2 s are merged into one line.
- A "Mark moments" switch (`Button pressed`, on by default) turns the chord and caption off.

## Reuse

`fuse.ts`, `fusionDates.ts`, `Fusion.tsx`, `variableWords`, `regionFor`, `useAnnounce`, `Button`. The key and root come from the existing style (`styleFor`).

## Touches

- `src/sonify/fuse.ts` and `fuse.test.ts`
- `src/features/compare/Fusion.tsx`, `Fusion.test.tsx`, `compare.css` (the strip)

## Steps

1. `alignedExtremes` with tests on the synthetic data sets.
2. The chord on aligned frames.
3. The caption strip and the switch.

## Tests

- `fuse.test.ts`: two synthetic decks with known peaks → the expected `Aligned` list; the same input gives the same list; no extremes → empty.
- `Fusion.test.tsx`: an aligned frame shows and announces the caption; the switch off stops both; `expectNoA11yViolations`.
- Peak stays at or below −1 dBFS with the chord.

## Guardrails

The template's guardrails, and:

- The same input always gives the same moments and the same sound.
- Nothing flashes. Every chord has its caption.
- Nothing specific to one data set in `src/`: the words come from the manifests.

## Done when

- Playing two data sets in Remix sounds a chord and shows a caption when they peak together. The switch turns it off, and the checks pass.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- Blending the two images visually beyond what Fusion does today. New routes (`/remix` stays Compare's mode).

## Result

Built by agent E, 14 Nov 2026.

- `src/sonify/fuse.ts`: pure `alignedExtremes(a, b)` (top or bottom 10% of each deck's own range on the shared dates; same place = within 1/8 of the image width, or date only when a deck has no place; `together` or `opposed`), `sampleOf` (a frame's median position and strongest hot spot), `placeWord` (ninth of the map), `momentChord` (major triad, plus a minor second when opposed; the whole chord 12 dB under the decks, scaled by the crossfader middle, silent at either end) and `momentSentence`.
- `Fusion.tsx`: reads every shared date of both decks once on its own streams, sounds the chord through `ensemble.playNotes` on an aligned date, shows one caption strip ("Moments") and announces it. Moments within 2 s are one line and one chord. A "Mark moments" switch (on by default) turns the chord and caption off.
- The caption uses each manifest's `variable.name` and its `highest` and `lowest` words; nothing is specific to one data set. `compare/index.tsx` is not touched. `sonify/index.ts` is not touched either, so `Fusion.tsx` imports from `sonify/fuse`.
- Where the extremes sit is the ninth of the map ("north-east"), not a manifest region, because the regions carry no bounds to test against.

Checks (Windows, Node):
- `npm run lint`: 0 errors.
- `npm test`: 213 files, 3087 tests passed (15 in `fuse.test.ts` including the new moment, chord and sentence tests; 4 new in `Fusion.test.tsx`).
- `npm run build`: built.
- Not heard in a browser; the chord is checked through the fake ensemble (`playNotes` called with the expected notes).
