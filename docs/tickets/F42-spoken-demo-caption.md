# F42 Spoken demo caption; demo fixes

| | |
|---|---|
| **Priority** | P2 |
| **Size** | S (under half a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | — |
| **Branch** | `feature/F42-spoken-demo-caption` |

## Goal

A listener in a room can hear the demo tour, not only read it. A switch, off by default, makes the page speak each caption. While it speaks, the music pauses. The comment that says the caption is "read out" is made true, or corrected.

## Why

- `src/features/demo/script.ts:8` says each caption is "read out". It is not. The caption is a paragraph with `aria-live="polite"` (`src/features/demo/DemoControl.tsx`), which only a screen reader announces. Nothing is spoken for a listener without a screen reader.
- `src/features/demo/DemoControl.tsx:70`: the Escape key handler listens on `window` and does not check `event.defaultPrevented`, so Escape also stops the demo when another control has already handled the same key.
- The brainstorm card (`docs/planning/BRAINSTORM-9NOV.md` §4, F42) asks for an opt-in "Read the demo aloud" switch. It is off on the screen-reader path, because a screen reader is that listener's voice.
- A spoken voice already exists: `src/features/welcome/speak.ts` (`speak`, `hush`). It is used only after a click, and never on the screen-reader path. Reuse it.
- Ducking exists for the voice guide: `src/assistant/ducking.ts` pauses the player with `sendPlayerCommand('pause')` (`src/features/player/controls.ts`). The demo should pause the music the same way while it speaks.

## Reuse

- `speak(text)` and `hush()` from `src/features/welcome/speak.ts`.
- `readWelcome()` from `src/features/welcome/storage.ts`: the stored `path` tells whether the listener chose the screen-reader path (`'screen-reader'`).
- `sendPlayerCommand('pause')` from `src/features/player/controls.ts`.
- `runDemo` in `src/features/demo/runDemo.ts`, with its `DemoDeps`, so the tour runs on a fake clock in tests.
- The `Button` component (`src/components/Button.tsx`) with `pressed`, as the demo's button already uses it.

## Design

- A switch in the demo panel: `Read the demo aloud`, a `<input type="checkbox">` with a visible label, off by default. Hidden on the screen-reader path (where `readWelcome().path === 'screen-reader'`).
- Store the choice for the visit only. Do not save it to storage.
- `DemoDeps` gets one more optional function, `speakCaption(text): Promise<void>`. It resolves when the speech ends, or after 15 seconds, or at once when speech is not available. `DemoControl` passes the real one when the switch is on, and nothing when it is off.
- For each step, before the caption is spoken: send `pause` if the switch is on. Then speak, wait, then hold for `holdMs` or call `playAndWait` as now. A step that plays the dates starts them after the caption has finished.
- Stopping the demo (button or Escape) calls `hush()`.
- Under `prefers-reduced-motion` nothing moves. Speech is not motion, so it is not affected.

## Touches

- `src/features/demo/DemoControl.tsx`, `runDemo.ts`, `script.ts` (the comment at line 8), and their tests.
- `src/features/welcome/speak.ts`: read only.

## Steps

1. Fix the comment at `script.ts:8`: say that the caption is shown, and spoken only when the switch is on.
2. Add the switch in `DemoControl.tsx`. Label it "Read the demo aloud". Keep its state in a `useState`, off by default.
3. Read the path with `readWelcome().path` when the panel opens. If it is `'screen-reader'`, do not render the switch.
4. Extend `DemoDeps` in `runDemo.ts` with the optional `speakCaption`. In `runDemo`, after `deps.say(step.say)`, await `deps.speakCaption?.(step.say)` if present, then continue as now.
5. In `DemoControl.tsx`, when the switch is on, pass a `speakCaption` that sends `pause` (only when the player is playing) and calls `speak(text)` and resolves on the utterance's end (use `SpeechSynthesisUtterance.onend`, or the timeout). Check that `speak.ts` returns nothing today: extend it to return a promise only if you need the end event. If you change `speak.ts`, say so in the pull request and update its callers.
6. On stop (button or Escape), call `hush()`.
7. In the Escape handler, return early when `event.defaultPrevented` is true.
8. Add the tests below.
9. Add one line to `docs/PRE-HACKATHON-WORK.md` under "During the hackathon".

## Tests

Stub `window.speechSynthesis` and `SpeechSynthesisUtterance` with `vi.stubGlobal`, and restore in `afterEach`. Mock `speak` with `vi.mock('../welcome/speak', ...)` if that is simpler.

- With the switch on, each step's caption is passed to `speak` once, in order (`runDemo` test, fake clock).
- With the switch off, `speak` is never called, and the captions still show.
- With the switch on, the player receives `pause` before each caption, and `play` is only sent by the play step.
- On the screen-reader path (`readWelcome` returns `path: 'screen-reader'`), the switch is not in the document.
- Stopping the demo calls `hush`.
- Escape with `defaultPrevented` set does not stop the demo.
- `await expectNoA11yViolations(container)` with the switch shown and off, and with it on.
- The switch is labelled "Read the demo aloud" (query by role `checkbox`, name).

## Guardrails

- Nothing is spoken before a click. The switch itself is the click.
- The music pauses while the caption speaks. No sound plays before a click or key press (WCAG 1.4.2).
- The screen-reader path never speaks through this switch.
- Every caption is text first, so a listener who has the switch off still reads it.

## Done when

- With the switch on, each step calls `speak` with its caption (test), and the player is paused while the caption speaks.
- With it off, nothing is spoken, and the captions show as before.
- The switch is not shown on the screen-reader path.
- The comment at `script.ts:8` is true.
- `npm run lint && npm test && npm run build` pass.

## Checks

```bash
npm run lint && npm test && npm run build
npx vitest run src/features/demo src/features/welcome
```

## Out of scope

- A voice for the demo that is recorded (H07 covers the video).
- Changing the demo's words (I02 covers the words that name temperature).
- The demo's order or timing.

## Result

Not started.
