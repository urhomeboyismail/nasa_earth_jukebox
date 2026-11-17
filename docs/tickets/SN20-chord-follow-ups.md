# SN20 Sevenths that real data can reach, and words that describe the new chords

| | |
|---|---|
| **Priority** | P2 |
| **Size** | S (under half a day) |
| **Who** | agent |
| **Needs** | SN18 (PR #126; this ticket edits the code it adds) |
| **Hotspots** | — |
| **Branch** | `feature/SN20-chord-follow-ups` |

## Goal

When a map is very mixed, the harmony plays a four-note (seventh) chord on the committed NASA data, not only in theory. Every caption, Learn card and description says what the harmony does now: a three-note chord for a map of mostly one kind, a fuller four-note chord for a mixed one.

## Why

SN18 replaced the old harmony (one note per heard histogram band, 1 to 4 notes) with real chords: a triad, or a seventh when the heard bands are spread wide. Two loose ends remain. All line numbers below are on SN18's branch, `feature/SN18-real-chords`.

- **Sevenths never sound on real data.** `SEVENTH_SPREAD` is 0.35 (`src/sonify/ranges.ts:33`), but the committed NASA data sets only reach a spread of 0.08 to 0.26 (SN18's Result: Mauritius ≤ 0.12, SST anomaly 0.12, hurricanes ≤ 0.17, global temperature 0.12 to 0.26). So every chord is a triad, and the data no longer changes how full the chord is. 0.2 would give sevenths on some global-temperature frames.
  - `src/audio/ensemble/voices.test.ts:109-121` relies on `[0.3, 0.7, 0]` giving a smaller chord than `[0.2, 0.4, 0.4]`, so lowering the threshold breaks it.
- **The words are now wrong:**
  - `src/sonify/captions.ts:63` names a chord thin (1 note), medium (2) or thick (3+). Chords are now 3 or 4 notes, so every caption says "thick chord, 3 notes".
  - `src/features/learn/voiceCards.ts:16` says "One note means one kind of value; more notes mean a mix."
  - `src/describe/recipe.ts:22` says "thin when the map is of one kind, thicker when it is mixed".
  - The `MusicFrame.harmony` comment in `src/sonify/types.ts:41` says "Chord notes, 1 to 4 … Thin for a uniform picture, thick for a mixed one."

## Design

**Threshold**
- Set `SEVENTH_SPREAD` to `0.2` in `src/sonify/ranges.ts`, and update its comment with the measured spreads above.
- Pick the value by measuring, not by guessing. Print each committed data set's per-frame spread (a throwaway script in scratch space, not committed). Keep 0.2 only if:
  - at least one committed data set has some seventh frames;
  - no data set is sevenths on every frame;
  - a map of one kind (a single heard band) is still always a triad.

  If 0.2 fails any of those, choose the nearest value that passes, and record the measurements under **Result**.

**Words.** They should say what a listener hears and what it means:
- **Caption** (`captions.ts`): `Harmony: simple chord, 3 notes` for a triad and `Harmony: full chord, 4 notes, the map is mixed` for a seventh. Keep `CaptionParts.harmony.notes`; the wording comes from the count. A three-note chord that is a seventh which could not be spaced (SN18 plays it as a triad) is described as a triad.
- **Learn card** (`voiceCards.ts`, the `listen` line): "Three notes when the map is mostly one kind; a fuller four-note chord when it is mixed. The chord changes when the mix changes."
- **Description** (`recipe.ts`, `sounds`): "A chord of three notes when the map is mostly one kind, four when it is mixed. It changes only when the mix does, and moves to the nearest notes."
- **Type comment** (`types.ts`): "Chord notes, 3 (triad) or 4 (seventh), in the harmony range, voiced to move as little as possible from the last chord."

Wording is the team's call. If a reviewer prefers other words, keep the meaning the same: three notes means one kind, four means mixed.

## Reuse

- `isSpaced`, `voiceChord` and `chordOn` from SN18 (`src/sonify/music.ts`, `src/sonify/presets.ts`): no new chord logic.
- The goldens and how to regenerate them (each test file's header says how; read the diff before committing):
  - `src/sonify/__golden__/music.json` and `render.json`
  - `src/audio/ensemble/__golden__/plan.json`
  - `src/features/player/__golden__/symphony.json`
  - `src/features/learn/__golden__/voice-cards.json`

## Touches

- `src/sonify/ranges.ts`, `src/sonify/captions.ts`, `src/sonify/types.ts` (comment only), and their tests
- `src/features/learn/voiceCards.ts` and its test
- `src/describe/recipe.ts` and its test
- `src/audio/ensemble/voices.test.ts` (the chord-size fixture only)
- The goldens listed under **Reuse** (regenerated)

## Steps

1. After SN18 is merged, branch from `main`.
2. Measure the spreads, and set `SEVENTH_SPREAD`.
3. Fix `voices.test.ts:109-121`: choose histograms that give a triad, then a seventh, at the new threshold. Keep what the test checks: a bigger chord strikes the new notes, and a smaller one releases the extra synths.
4. Update the four pieces of wording, and their tests.
5. Regenerate the goldens and read the diffs.

## Tests

- **Caption:** a triad frame says "simple chord, 3 notes"; a seventh frame says "full chord, 4 notes, the map is mixed".
- **Threshold:** at least one committed NASA data set produces a seventh, and a single-band histogram never does.
- **Learn card:** renders the new `listen` line (`getByText`) and passes `expectNoA11yViolations`.
- **Description:** no "thin" or "thicker" is left in the harmony text.

## Guardrails

- The same input always gives the same output. Nothing random.
- Every voice keeps a true text equivalent. This ticket exists to make them true again.
- Nothing specific to one data set in `src/`. The threshold is one value for every data set; the measurements only choose it.

## Done when

- Sevenths sound on at least one committed NASA data set, and a uniform map always gives a triad.
- No caption, Learn card, description or comment describes the harmony as 1 to 4 notes, or as thin or thick.
- The goldens are regenerated and the diffs explained in the commit.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- Naming the chord in the caption (for example "F major"): a possible later ticket.
- Any change to how chords are chosen or voiced (SN18), or to the instruments (SN19).

## Result

Filled in by the agent: the branch, the commits, and the real output of the checks, failures included.
