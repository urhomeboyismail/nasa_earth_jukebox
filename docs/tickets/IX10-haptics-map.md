# IX10 Haptics map on the audio clock, gamepad rumble

| | |
|---|---|
| **Priority** | P1 |
| **Size** | S (under half a day) |
| **Who** | agent |
| **Needs** | IX01 |
| **Hotspots** | explorer, player |
| **Branch** | `feature/IX10-haptics-map` |

## Goal

On phones that can vibrate, each place, edge, lock and mark gives a pulse that lands with its sound. A gamepad rumbles with the same pattern. Browsers with no vibration (iPhone and iPad) say so in one line.

## Why

- Vibration fires when the code runs, not when the sound leaves the speaker. `src/features/player/vibration.ts` (`vibrateForDate`) and `src/features/explore/useExplorer.ts` (`soundCell`, around `:152` and `:266`) call `navigator.vibrate` straight away, so the pulse leads or trails the sound by the audio latency.
- `patternFor` (`vibration.ts`) already gives each category a pulse length; the missing data is two quick taps (`MISSING_PATTERN`). These are the shapes to keep.
- Gamepads have their own vibration (`vibrationActuator`), which nothing uses.
- The setting is hidden where there is no vibration (`vibration.ts`: "the setting is not shown"). A listener on an iPhone gets no reason for that.

## Design

- **The audio clock (`src/features/haptics/clock.ts`, pure with one call to the browser).** `wallTimeOf(context, contextTime)` gives the `performance.now()` value at which the audio at `contextTime` leaves the speaker:
  - if `context.getOutputTimestamp` exists, `ts = context.getOutputTimestamp()` and `wall = ts.performanceTime + (contextTime − ts.contextTime) × 1000`;
  - otherwise `wall = performance.now() + (contextTime − context.currentTime + (context.outputLatency ?? context.baseLatency ?? 0)) × 1000`.
  Then the pulse is fired at `wall − VIBRATION_LAG_MS` with `setTimeout`. `VIBRATION_LAG_MS` is a constant, 0 at first, measured on a device in H06 and set then.
- **Which pulse.** Moves use `patternFor(category)`. An edge is two short pulses (`[20, 40, 20]`). A lock is one long pulse (`[120]`). A mark is a double (`[40, 60, 40]`). A missing place uses `MISSING_PATTERN`. The shapes are in one table, `src/features/haptics/patterns.ts`.
- **Gamepad.** `navigator.getGamepads()` gives the connected pads. Where `pad.vibrationActuator?.playEffect` exists, call `playEffect('dual-rumble', { duration, strongMagnitude, weakMagnitude })` at the same scheduled wall time, with the magnitude from the category's rank (0 to 1) and the duration from the pattern. Where there is none, do nothing.
- **Setting.** The existing toggle (`useVibrationSetting`) controls both the phone and the pads. Keep it off by default.
- **No vibration.** When `navigator.vibrate` is missing, show one line next to the setting, and no sniffing of the user agent: "Vibration is not available in this browser, for example on iPhone and iPad. The sound is the same."

## Reuse

- `src/features/player/vibration.ts`: `patternFor`, `MISSING_PATTERN`, `vibrateForDate`, `useVibrationSetting`, `isVibrationSupported`. Extend them; do not write a second copy.
- IX01: the events (`move`, `edge`, `lock`, `mark`) from `dispatch`; the feedback table.
- SN04's `Ensemble` gives the audio clock (its `currentTime`), but not the context's `getOutputTimestamp()`. Ask the SN04 owner on `docs/AGENT-BOARD.md` for a read-only `outputTimestamp()` (or the context), and use it. Do not create a second `AudioContext`. Until SN04 answers, the fallback branch of `wallTimeOf` is the only one this ticket can test; set `blocked` only if the answer is needed to finish.

## Touches

- `src/features/haptics/clock.ts`, `patterns.ts`, `pad.ts` (gamepad), and tests.
- `src/features/player/vibration.ts` and `vibration.test.tsx`: the pattern table and the no-vibration line.
- `src/features/explore/useExplorer.ts`: replace the direct `vibrateForDate` calls with the scheduled one (IX01 already moved the handlers).
- `src/features/player/index.tsx`: the one line that shows the no-vibration note (the player already shows the setting).

## Steps

1. Write `clock.ts` with both branches of `wallTimeOf`, and table-test them with fake times.
2. Move the pattern shapes into `patterns.ts`; keep `patternFor` and `MISSING_PATTERN` exported from `vibration.ts` for existing callers.
3. Route the explorer's pulses through the scheduled call. Keep the setting check first.
4. Add the gamepad path in `pad.ts`.
5. Add the no-vibration line.

## Tests

- `clock.test.ts`: with `getOutputTimestamp`, a contextTime 100 ms ahead maps to `performanceTime + 100`; without it, `outputLatency` is added; a missing latency counts as 0.
- Fake `AudioContext` (`installFakeAudioContext()`) with a stubbed `getOutputTimestamp`, and fake timers: the `navigator.vibrate` stub is called at the expected wall time, minus `VIBRATION_LAG_MS`.
- No pulse when the setting is off; no pulse when `navigator.vibrate` is missing.
- `pad.test.ts`: a fake gamepad with a fake `vibrationActuator.playEffect` gets a `dual-rumble` call with the magnitudes; a pad with no actuator gets none.
- The no-vibration line is shown when `vibrate` is missing and not shown when it exists.
- `expectNoA11yViolations` on the setting.

## Guardrails

- The same input gives the same pulses at the same wall times (for the test's fake clock).
- The haptic is not the sound: nothing about the peak or the sound changes.
- Nothing flashes. Haptics are not visual.
- Every pulse has its text: the cue is the visible line and the words the listener asks for (IX02).
- No data-set name in `src/`; the magnitude comes from the category's rank in the mapping.

The five principles, for this ticket:
1. A pulse lands with its sound, on the audio clock.
2. Sound first; the pulse is an extra channel and never the only one.
3. The listener turns it off; nothing vibrates by default.
4. The same events give pulses for touch and rumble for gamepads, through IX01.
5. The shapes are learnt by feel, with the same ranks the sound uses.

## Done when

- On a device with vibration, a move's pulse is scheduled to the sound's wall time (tested with the fake clock; measured on a device in H06).
- A gamepad rumbles with the same pattern when it has an actuator.
- On a browser with no vibration, the one line says why, and nothing else changes.
- All tests pass and the checks are green.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- Measuring `VIBRATION_LAG_MS` on a real phone (H06 records the number; this ticket keeps 0).
- Any haptic for the voice guide.
- Changing the vibration setting's default.

## Result

Not started.
