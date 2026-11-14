# AU-UI Interface sounds for playback, Compare and success

| | |
|---|---|
| **Priority** | P2 |
| **Size** | S (under half a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | player, compare |
| **Branch** | `feature/AU-UI-interface-sounds` |

## Standalone

`src/audio/cues.ts` is on `main` already (merged from `feature/interface-earcons`): four cues (`connected`, `ended`, `answer`, `error`), plain Web Audio, a switch in `SoundPrefs`, stored under `earth-jukebox:interface-cues`, wired into the voice guide and Ask. This ticket adds the cues that are still missing, in the same file and the same way. It does not wait for the listening test (the switch already exists and defaults to on; a later test can change `parse`'s default).

## Goal

Short, quiet interface sounds for the start and end of playback, Compare's A and B, and a success, each behind the existing switch and each with a text equivalent.

## Why

- Playback starts silently, so a listener can't tell it began without looking.
- Compare plays A and then B with nothing between them (`src/features/compare/index.tsx`).
- Saves, copies and links give no sound result, though errors do.

## Design

Add to `cues.ts` (extend `Cue` and `CUE_NOTES`; keep the existing four unchanged):

| Cue | When | Sound | Text equivalent (already visible or announced) |
|---|---|---|---|
| `start` | a sequence starts playing | rising two blips | the player's status line ("Playing") |
| `stop` | a sequence reaches its end | falling two blips | the status line ("Finished") |
| `compareA` | before Compare plays date A | one soft blip | the "Date A" label |
| `compareB` | before Compare plays date B | two soft blips | the "Date B" label |
| `success` | a save, copy or link is made | rising three short blips | the visible message, announced once |

- Same timbre and level as the existing cues: pure sine blips at `LEVEL` (0.04), each cue under 400 ms, so they never sound like data and never exceed the melody.
- Fire `start` and `stop` only on a real change of state, not on every date.
- Compare's A and B play before each date; no cue while the guide is speaking (`src/assistant/ducking.ts` already knows).
- When the switch is off, nothing plays and nothing else changes. No sound before the listener's first click or key press.
- The cues themselves are not announced. `success` is announced once through `useAnnounce` where its message already shows.
- Add one line per new cue to the switch's help in `SoundPrefs`, so every sound has words.

## Reuse

- `playCue`, `cuesOn`, `CUE_NOTES` and the switch in `src/audio/cues.ts` and `SoundPrefs.tsx`; the tests `cues.test.ts` and `SoundPrefs.test.tsx` as the model.

## Touches

- `src/audio/cues.ts`, `cues.test.ts`
- `src/features/player/SoundPrefs.tsx` (help lines), `usePlayer.ts` or `index.tsx` (the start and stop calls), `player.test.tsx`
- `src/features/compare/index.tsx`, `compare.test.tsx`

## Steps

1. Add the five cues to `CUE_NOTES` and the help lines.
2. Call `start` and `stop` on a real change of playback state.
3. Call `compareA` and `compareB` before each date in Compare.
4. Call `success` where a save, copy or link already shows its message.

## Tests

- `cues.test.ts`: every cue has notes, none is longer than 400 ms, and none is played when the switch is off.
- Player: `start` fires once when playback starts and `stop` once when it ends, not per date.
- Compare: `compareA` before date A and `compareB` before date B.
- `expectNoA11yViolations` on the switch and its help.

## Guardrails

The template's guardrails, and:

- Nothing specific to one data set in `src/` (`.claude/rules/phases.md`); colours and text come from the manifest.
- No sound before a click or key press. Nothing flashes. Every sound has a text equivalent.

- Same input, same cue. Level never above the melody.

## Done when

- The five cues play behind the existing switch with their text, and every existing test passes.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- Pitch registers computed from the data's range, offline rendering of cues, the voice guide's own cues (already built), the `docs/SOUND_MAPPINGS.md` noise-burst line (its owner updates it).

## Result

Agent D, 2026-11-14, Windows laptop (`--pool=forks --maxWorkers=1`, low RAM).

Built: `start`, `stop`, `compareA`, `compareB` and `success` in `src/audio/cues.ts` (same sine timbre, level 0.04, all under 400 ms; the existing four are unchanged). `playCue` now returns how long it sounded (0 if it did not play) and the five new cues stay quiet while any voice holds a duck (`duck.target() < 1`). `start` fires in `usePlayer.ts` only when playback goes from not-playing to playing (not on resume, a jump mid-run or the loop going round); `stop` fires when a run reaches its end. Compare plays `compareA` or `compareB` after the unlock, waits for the cue to finish, then sounds the date. `success` plays where the player's "Link copied" message shows. One help sentence in `SoundPrefs` covers all the sounds.

Not wired (outside Touches): the other success messages, `MarksPanel.tsx` (Link copied), `MyMixControls.tsx` (My mix saved) and `Crate.tsx` (saved on this device). They each need a one-line `playCue('success')`; ask their owners or add them to a follow-up ticket.

```
npm run lint        -> 0 new problems. Two errors remain in src/sonify/fuse.ts:31 and :39
                       (consistent-type-assertions); both are on clean main and not in this ticket's Touches.
npm run build       -> exit 0 (built in 1.43s)
npx vitest run --pool=forks --maxWorkers=1
                    -> Test Files 1 failed | 209 passed (210); Tests 1 failed | 3056 passed (3057); 1085 s
                       The one failure was src/data/change-regression.test.ts "gives the same Score every time",
                       a 90 s timeout under load. Re-run alone with these changes: Tests 7 passed (7), 58 s.
                       It also passes on clean main.
```
