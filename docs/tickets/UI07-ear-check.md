# UI07 Ear check: "Which is higher?" and "Left or right?", then a starting detail level

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | welcome |
| **Branch** | `feature/UI07-ear-check` |

## Standalone

A new component in its own folder, offered from two places that are on `main` today: the Listen page's sound settings and the welcome's sound check. It does not wait for any other ticket. The welcome edit is one line, but it puts this ticket in the `welcome` hotspot, so it starts when no other ticket holds `welcome`. Whoever merges second rebases and keeps the other's welcome logic.

## Goal

A two-question ear check, under 30 seconds, tunes the sound to the listener: "Which is higher?" (two tones) and "Left or right?" (one panned tone). The answers set the starting detail level (Calm, Standard or Full) and, if the listener's left and right are swapped, flip the stereo for them. The check is remembered on this device and can be run again.

## Why

- The master prompt (14 Nov 2026) asks for a "2-step sensory calibration mini-check" to calibrate stereo cues and the default detail level.
- Pan carries meaning (west is left, east is right; `src/audio/pan.ts:1`), but nothing checks that the listener's headphones are the right way round.
- The detail level starts at the manifest's value or `'standard'` (`src/features/player/symphonyState.ts:101`). The listener's own choice is not remembered between visits.
- The welcome has a sound check for volume only (`src/features/welcome/Welcome.tsx`).

## Design

- `src/features/calibration/earCheck.ts` (pure): `scoreEarCheck({ higher, side }): { detail: DetailLevel, swapEars: boolean }`.
  - Pitch right and side right → `standard`, `swapEars: false`.
  - Side answered the opposite way → `swapEars: true`.
  - Pitch wrong, or "Can't tell" for either → `calm`.
  - `full` is never suggested; the listener picks it.
- `EarCheck.tsx`: a labelled region with a heading.
  1. "Which is higher?": "Play the two tones" plays 330 Hz then 495 Hz, 0.4 s each (a fixed order, so the check is the same every time). Answers: "The first", "The second", "Can't tell".
  2. "Left or right?": "Play the tone" plays 440 Hz panned fully left. Answers: "Left", "Right", "Both or can't tell".
  3. A result: "Suggested detail: Calm" with a radio group of Calm, Standard and Full (the suggestion pre-selected), plus "Your left and right are swapped; we'll flip them" when it applies. "Save" stores both.
- Tones go through one small helper in `src/audio/cues.ts`: `playTone(hz, seconds, pan)`, a sine with a 20 ms fade, peak at −6 dBFS. Nothing plays before the button is pressed.
- Every answer and the result are announced through `useAnnounce`.
- **Storage** (guarded, through `useStoredValue` / `readStored`):
  - `swapEars: boolean` (default `false`) added to the audio prefs in `src/audio/prefs.ts`. The parser accepts old stored values without it.
  - The detail level in a new key, `earth-jukebox:detail-level`.
- **Where it takes effect:**
  - `src/audio/pan.ts`: `createPanner` (and the pan helpers it feeds) negate the pan when `swapEars` is on. This is one place, so every engine follows it.
  - `symphonyState.ts:101` starts from the stored level when there is one, otherwise the manifest's, otherwise `'standard'`. Changing the level in `DetailControl` stores it.
- **Where it is offered:**
  - `SoundPrefs.tsx`: a "Check your ears" button opens it in the existing `Dialog`.
  - `Welcome.tsx`: one line, an optional "Check your ears (30 seconds)" link in the sound-check step.

## Reuse

`Dialog`, `Button`, `ButtonGroup`, `useAnnounce`, `useStoredValue` / `readStored`, `DETAIL_WORDS` and `DetailLevel` (`symphonyState.ts`), the audio context in `src/audio/cues.ts`.

## Touches

- `src/features/calibration/earCheck.ts`, `EarCheck.tsx`, `earCheck.css`, their tests (new)
- `src/audio/cues.ts` (`playTone`), `src/audio/prefs.ts` (`swapEars`), `src/audio/pan.ts` (the flip)
- `src/features/player/symphonyState.ts` (the starting level and storing it), `SoundPrefs.tsx` (the button)
- `src/features/welcome/Welcome.tsx` (one line)

## Steps

1. Write `scoreEarCheck` and its test.
2. Add `playTone`, `swapEars` and the flip in `pan.ts`, with tests.
3. Write `EarCheck` and mount it in `SoundPrefs` and the welcome.
4. Store the detail level and start from it.

## Tests

- `earCheck.test.ts`: every answer pair gives the expected detail and swap.
- `EarCheck.test.tsx` with `installFakeAudioContext()`: no oscillator before a click; "Play the two tones" starts two; answers move to the next step; the result pre-selects the suggestion; Save stores both. `expectNoA11yViolations`.
- `pan.test.ts`: with `swapEars` on, `panForPoint(0)` heard through `createPanner` is +1.
- `prefs.test.ts`: an old stored value without `swapEars` parses as `false`.
- Existing player, welcome and SoundPrefs tests pass.

## Guardrails

The template's guardrails, and:

- No sound before a click or key press; peak at −6 dBFS, well under −1 dBFS.
- Every tone has a text equivalent ("Tone one, lower. Tone two, higher." on request after the answer).
- Nothing specific to one data set in `src/`.

## Done when

- A listener can take the check from Listen and from the welcome. Their detail level and stereo direction apply at once and on the next visit. The checks pass.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- A hearing test or any medical claim. Per-frequency equalisation. Changing the welcome's flow (JB11) or its look (UI02).

## Result

Filled in by the agent.
