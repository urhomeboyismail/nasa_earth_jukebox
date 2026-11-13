# IX05 Predict, then hear

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | SN01 |
| **Hotspots** | player |
| **Branch** | `feature/IX05-predict-then-hear` |

## Goal

At a date, the listener answers one question about the next two dates before hearing them. Then the two dates play, and the answer is given in sound and in words, with the right answer computed from the frames. It works in the story and in the demo.

## Why

- Nothing in the app asks the listener anything. The story and the demo play through (`src/features/story/StoryPanel.tsx`, `src/features/demo/runDemo.ts`).
- `src/features/compare/judge.ts` already decides a right answer from analysis (`judge()`), but only for the Compare page's two dates, and only from categories.
- SN01 gives per-frame features for every date offline, so the next two dates' answers are known before they play.

## Design

- **The judge (pure, `src/features/predict/judge.ts`).** `questionsFor(features)` returns the questions that have a tracked hot spot in the current date. `answerFor(question, now, later)` computes the answer from the features of the date and the two dates after it:
  - **Size.** "Will the warm area get bigger, smaller, or stay about the same?" The area of the hot spot with the same track id, at the date two steps later, against now. Bigger or smaller beyond ±10%; otherwise the same.
  - **Direction.** "Which way will the warm area move?" The dominant axis of the centroid's move from now to two steps later, when it moved at least one cell: north, south, east or west. Otherwise "it stays put".
  - A question is offered only when the track exists at both ends. Otherwise `null`: no question, no button.
- **The panel (`src/features/predict/PredictPanel.tsx`).** A "Predict" button. Pressing it pauses playback and plays the current date's music as the question sound (`playNotes` with `notesOf(frame, 1.5)`, IX01 `notes.ts`). Then the choices appear as buttons: the question's answers only.
- **The reveal.** The two dates play in order: `playNotes(notesOf(later, 0.8))` at now and again at +0.8 s, driven by a timer (each call is self-releasing). Then the answer is given: the right answer is two rising notes (`playNotes`); a wrong one is two falling notes, in the melody range. The text is "You said bigger. It got bigger." (or "You said bigger. It got smaller."), through `useAnnounce`, once.
- **Story and demo.** A "Predict" button appears on a story chapter when `questionsFor` returns one. The demo's script (`src/features/demo/script.ts`) gets one predict step, which waits for the answer before the next step.
- **Keys.** None. The panel is buttons, so it works by keyboard, touch and screen reader without a single-key shortcut.

## Reuse

- SN01's `FrameFeatures` (`hotspots` with track ids, and `motion` or the centroid) from SN01's ticket file, and its offline per-frame analysis for the two later dates.
- SN04's `playNotes`; IX01's `notes.ts` (`notesOf`, `noteForPosition`).
- `src/features/compare/judge.ts`: the shape of a pure judge with a `null` for "no answer" (read it, copy the pattern, do not import it).
- `src/components/Button.tsx`, `useAnnounce`.

## Touches

- `src/features/predict/judge.ts`, `judge.test.ts`, `PredictPanel.tsx`, `PredictPanel.test.tsx`, `usePredict.ts`.
- `src/features/story/StoryPanel.tsx` and its test: the button on a chapter.
- `src/features/demo/script.ts` (one step) and `runDemo.ts` only if the step needs to wait for the answer.
- `src/features/player/index.tsx`: mount `PredictPanel` (one line). The queue row has no hotspot for this ticket; the mount is small, so no other player ticket runs at the same time.

## Steps

1. Write `judge.ts` with `questionsFor` and `answerFor` as pure functions over `FrameFeatures`. Table-test them on the SN02 set, where the answers are known.
2. Write `usePredict.ts`: the state (asked, chosen, revealed) in React state; the timers in refs.
3. Write `PredictPanel.tsx`: the button, the question text, the choice buttons, the reveal text.
4. Add the button to the story chapter and the demo step.
5. Check that the answer is never read before the choice is made: the answer is not in the DOM until the reveal.

## Tests

- `judge.test.ts`: the SN02 set with a known growing spot gives "bigger"; a shrinking one, "smaller"; a steady one, "the same"; a spot with no track at both ends gives `null`; a centroid move of one cell or less gives "stays put".
- `PredictPanel.test.tsx` (fake engine, `userEvent`): the choices appear only after Predict; the answer text is absent before the choice; after the choice the two later dates are played (`playNotes` called twice, at 0 and 800 ms); the right and wrong sounds are different calls.
- `StoryPanel.test.tsx`: the Predict button shows on a chapter that has a question and not on one that does not.
- `expectNoA11yViolations` on the panel before and after the reveal.

## Guardrails

- The same frames give the same question and the same answer. Nothing is random.
- Peak at or below −1 dBFS; no sound before the press of Predict.
- Nothing flashes. Held chord is steady.
- Every sound has its text: the question is the visible text; the answer is words, once.
- Changes are announced through `useAnnounce`; the question is asked on screen, not spoken on its own.
- No data-set words in `src/`: "bigger", "smaller" and the compass words are general.

The five principles, for this ticket:
1. The question's chord sounds at once when Predict is pressed.
2. Sound first: the two dates play before the answer; words come only as the answer.
3. The listener chooses the time to answer; Escape stops the sound.
4. Buttons work from keyboard, touch and gamepad focus alike.
5. The question teaches the listener what to listen for.

## Done when

- Predict works on a fixture date with a tracked spot, and on the SN02 set, with a right answer each time.
- A date with no track offers no question.
- The story and the demo show the same panel.
- All tests pass and the checks are green.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- Questions about temperature values or categories (the judge uses features and tracks only).
- A score across questions.
- Any server call.

## Result

Built on `feature/IX05-predict-then-hear`, from `main` at the claim.

- `src/features/predict/judge.ts`: `questionsFor(now, later)`, `answerFor(question, now, later)`, `revealText`. Pure over `FrameFeatures`. The question is about the largest warm (`high`) spot that SN01 tracks to the date two steps later. Size: more than ±10% of the cells is bigger or smaller, otherwise the same. Direction: the longer axis of the centroid's move in cells, and "it stays put" when it moved one cell or less. No tracked spot at both ends gives no question.
- `usePredict.ts`: reads the date and the two after it in order with `extractFeatures(…, previous)` (so the hot-spot ids follow the same spot), keeps the answer in memory, and picks the question by `index % questions.length` (nothing random). Predict halts playback and sounds the date as the question (`playNotes(notesOf(…, 1.5))`). The choice plays the next two dates at 0 and 800 ms, then two rising notes (right) or two falling notes (wrong) at 1600 ms, with "You said bigger. It got bigger." announced once. Escape (`stopSpeech`) or "Stop the question" cancels the sound and the timers.
- `PredictPanel.tsx`, `predict.css`: Predict button, the question and its choices as buttons, the answer line after the reveal. The answer is not in the DOM before it.
- Story: `StoryPanel.tsx` takes an optional `predict` and shows "Predict" on a chapter whose first date has a question.
- Demo: `script.ts` has one `predict` step on Listen; `runDemo.ts` waits for `predictAndWait` (optional, holds if absent); `DemoControl.tsx` asks the player through `predict/bus.ts` until a player takes it (gives up after 5 s with no player, waits up to 45 s for the answer).
- Mount: `player/index.tsx`, three lines (the hook, the panel, the story prop). The queue row lists the `player` hotspot.
- Files outside the ticket's Touches, both small and needed for the demo step: `src/features/demo/DemoControl.tsx` and `src/features/demo/DemoControl.test.tsx` (the second one because the tour now has a question step).

Tests: `judge.test.ts` (table tests), `synthetic.test.ts` (real extractor on painted scenes and on the SN02 `synthetic-storm` set: growing, shrinking, steady, moving, lost spot, the storm's direction from the drawn centres), `PredictPanel.test.tsx` (choices only after Predict, answer text absent before the choice, `playNotes` at 0 and 800 ms, rising and falling answer notes, Escape, demo request, `expectNoA11yViolations` before, while asking and after the reveal), `StoryPanel.test.tsx` (button shown and not shown), `runDemo.test.ts` and `DemoControl.test.tsx` (the question step waits).

```
$ npm run lint        -> oxlint, no warnings, exit 0
$ npm test            -> Test Files 167 passed (167), Tests 2610 passed (2610)
$ npm run build       -> built in 1.33s
```

Note: `src/App.test.tsx` is timing-flaky on this machine under load (a different test in it fails on some runs). It fails the same way on a clean `main`, so it is not from this ticket. It passed in the full runs above.
