# I12 Unit tests for five untested modules

| | |
|---|---|
| **Priority** | P2 |
| **Size** | S (under half a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | — |
| **Branch** | `chore/I12-missing-unit-tests` |

## Goal

Each of five modules that have no test file gets one. The tests check what each module does, using the fakes in `src/test/fakes.ts`. No module changes.

## Why

Checked on `main` on 9 Nov. Each file has no `.test.ts` or `.test.tsx` next to it:

- `src/useNavDrag.ts` (83 lines): the drag along the phone's tab bar.
- `src/config.ts` (14 lines): `apiBase()` and `socketUrl()`, which read `VITE_API_URL`.
- `src/features/learn/legendTour.ts` (15 lines): `legendSteps`, `legendLabel` and `LEGEND_GAP_MS`. Learn's "Play all" and Listen's "Hear the legend" use them.
- `src/features/welcome/speak.ts` (12 lines): `speak` and `hush`, the optional spoken voice. It must do nothing when the browser has no speech.
- `src/assistant/audio.ts` (164 lines): `INPUT_RATE`, `OUTPUT_RATE`, `frameLevel`, `startRecorder` (with an `AudioWorkletNode`) and `SpeechPlayer` (created with `new AudioContext`, line 103).

## Reuse

- `src/test/fakes.ts`: `installFakeAudioContext()` and `uninstall()`.
- `vi.stubEnv` and `vi.stubGlobal` (Vitest), restored in `afterEach` with `vi.unstubAllEnvs()` and `vi.unstubAllGlobals()`.
- `@testing-library/react`'s `renderHook` and `fireEvent` for the drag.
- `src/test/a11y.ts` is not needed: none of these modules renders a page.

## Touches

Only the five new test files:

- `src/useNavDrag.test.tsx`
- `src/config.test.ts`
- `src/features/learn/legendTour.test.ts`
- `src/features/welcome/speak.test.ts`
- `src/assistant/audio.test.ts`


## Steps

1. `src/config.test.ts`: `vi.stubEnv('VITE_API_URL', ' https://x.example/// ')` and check that `apiBase()` returns `https://x.example`. With an empty value, `apiBase()` returns `''`. `socketUrl('/api/v1/assistant/live')` with `https://x.example` gives `wss://x.example/api/v1/assistant/live`. With `http://` it gives `ws://`. With an empty base, it uses `window.location.origin`.
2. `src/features/learn/legendTour.test.ts`: build a `SoundMapping` from the fixture (`public/data/fixture/manifest.json`, its `mapping` field) with the test's own helper. `legendSteps` returns one step per category, in the order of `mapping.categories`, spaced by `LEGEND_GAP_MS` (1200). `legendLabel` returns the category's label, and `''` for an index out of range.
3. `src/features/welcome/speak.test.ts`: stub `speechSynthesis` (an object with `speak`, `cancel`) and `SpeechSynthesisUtterance` (a small class that stores `text`). `speak('Hi')` cancels, then speaks one utterance with text `Hi`. `hush()` cancels only. With no `speechSynthesis` in `window` (delete the stub), both do nothing and do not throw.
4. `src/useNavDrag.test.tsx`: render a `<nav>` that spreads the handlers from `useNavDrag` (through a small test component). Stub `window.matchMedia` so that `(max-width: 767.98px)` matches. Stub `Element.prototype.getBoundingClientRect` and `HTMLElement.prototype.setPointerCapture`. Cases:
   - a press and release without movement calls nothing;
   - a horizontal drag of several tabs calls `onSelect` with the tab under the release point, and a click right after is suppressed for 350 ms;
   - a mostly vertical move cancels the drag and calls nothing;
   - the drag does nothing when the screen is wider than 768 px;
   - `onPointerCancel` clears the drag without calling `onSelect`.
   Use `fireEvent.pointerDown` / `pointerMove` / `pointerUp` with `clientX`, `clientY`, `pointerId`, `button` and `isPrimary`. Use `vi.useFakeTimers` for the 350 ms.
5. `src/assistant/audio.test.ts`: `frameLevel` on a silent buffer is 0; on a buffer with one full-scale sample is near 1; the value is a peak, not an average (one loud sample in silence gives the loud value). `SpeechPlayer`: with `installFakeAudioContext()`, constructing it creates one context at 24 000 Hz; `play(chunk)` with a short PCM16 chunk makes one buffer source; `close()` closes the context. Read the class (`src/assistant/audio.ts:102` to `:164`) before you write the assertions, and test what it does, not what it might do.

## Tests

The five test files are the tests. Each file must pass on its own (`npx vitest run <file>`), and the whole suite must pass.

## Guardrails

Not applicable: no sound or visual change. The tests do not play sound.

## Done when

- The five files exist and pass.
- Each module's exported functions are called by at least one test.
- `npm run lint && npm test && npm run build` pass. The number of test files goes up by five.
- No module under test has changed (`git diff --stat` shows only the five new files).

## Checks

```bash
npm run lint && npm test && npm run build
npx vitest run src/useNavDrag.test.tsx src/config.test.ts src/features/learn/legendTour.test.ts src/features/welcome/speak.test.ts src/assistant/audio.test.ts
```

## Out of scope

- Changing any of the five modules, even to make them easier to test.
- Tests for the voice guide's session logic (V01, V02).
- Coverage targets.

## Result

Not started.
