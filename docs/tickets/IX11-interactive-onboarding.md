# IX11 Interactive onboarding: the first minute is a game

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | IX04 |
| **Hotspots** | player |
| **Branch** | `feature/IX11-interactive-onboarding` |


## Goal

A first-time listener learns the keys by doing four small tasks in about a minute: move and hear, find the warm place, ask what's here, lock a place and scrub it through time. Nothing is read to them first. The game is skippable and can be started again.

## Why

- The welcome (`src/features/welcome/Welcome.tsx`, `lines.ts`) explains by words. Its sound check (`Welcome.tsx:66-73`) plays notes and asks yes or no, with nothing to do.
- The principles (PLAN §6.3, principle 5) say the first minute is a game, not a paragraph.
- IX01 defines the keys and IX04 gives the first game, so the onboarding is a sequence of those, not a new system.

## Design

- **Four steps (pure, `src/features/onboarding/steps.ts`).** Each step has an id, a visible prompt, and a condition that is met by actions dispatched through IX01:
  1. "Move with an arrow key. Each place you land on makes a sound." Met after three `move` actions.
  2. "Find the warmest place. Press F to start the find game." Met when IX04 reports its first target found.
  3. "Press I to ask what's here." Met by one `query`.
  4. "Press L to lock this place, then Alt with Left or Right to hear it on other dates." Met by a `lock` and a `scrubTime` with `Alt`.
  The prompts are shown as text, and the words are read on request (`I`) only; the step change is announced once through `useAnnounce`.
- **Where it starts.** On the welcome's "Just play me something" path, and on the first Listen visit when the flag is unset. A "Play the first-minute game" button on Listen starts it again.
- **Skip and finish.** A Skip button and a Done state; both write `earth-jukebox:onboarding` (zod: `{ done: boolean }`). Escape stops the sound, not the game.
- **Sound.** Each met step plays the `lock`-style chime from IX01's feedback (a short rising pair), not a new sound.
- **Data sets.** The game uses whatever data set is open; it names no data set.

## Reuse

- IX01: `useActionHandler` (the steps listen to actions; they do not add DOM listeners), the feedback table.
- IX04: its "target found" event (a callback prop, not a second game).
- `src/components/Button.tsx`, `useAnnounce`.
- `src/features/welcome/storage.ts` (the pattern for stored choices; read it and copy the style, do not change it).

## Touches

- `src/features/onboarding/steps.ts`, `store.ts` (zod), `useOnboarding.ts`, `OnboardingPanel.tsx`, and tests.
- `src/features/welcome/Welcome.tsx`: the "Just play me something" path opens the game (one line).
- `src/features/player/index.tsx`: mount the panel and the restart button (one line). `player.test.tsx`.

## Steps

1. Write `steps.ts` as a pure function from the step and an action to the next step.
2. Write `store.ts` (zod) and `useOnboarding.ts`: the current step, the done flag.
3. Register the handlers for `move`, `query`, `lock`, `scrubTime`, and the IX04 event.
4. Write `OnboardingPanel.tsx`: the prompt text, the Skip button, the restart button.
5. Hook up the welcome path and the first-visit check.

## Tests

- `steps.test.ts`: each step is met by its action and not by another; the order holds; three moves are needed for step 1.
- `store.test.ts`: the done flag round-trips; a corrupt value counts as not done.
- `OnboardingPanel.test.tsx` (`userEvent`, fake engine): a keyboard run through the four steps reaches done; Skip hides the panel and writes the flag; the restart button shows it again.
- The step change is announced once (`liveText()`), and no step speaks by itself.
- `expectNoA11yViolations` on the panel at each step.

## Guardrails

- The same actions give the same steps. Nothing is random.
- Peak at or below −1 dBFS; no sound before a key press or click (the welcome already needs a click to start sound).
- Nothing flashes; the prompt does not blink.
- Every sound has its text: each chime is the step's visible prompt; the step change is announced once.
- Changes are announced through `useAnnounce`; nothing speaks on its own.
- No data-set name in `src/`.

The five principles, for this ticket:
1. Each task's answer is the sound of the action, within the budget.
2. Sound first: nothing is read aloud; the prompt is text and the words come on request.
3. The listener can skip, leave, and come back; Escape never traps.
4. Every step uses the same keys and gestures as the rest of the app.
5. Learn by doing is the whole design of this ticket.

## Done when

- A keyboard-only run through the four steps reaches Done, on the fixture.
- Skip and Done are remembered; the restart button brings the game back.
- The welcome's "Just play me something" path starts the game.
- All tests pass and the checks are green.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- Rewriting the welcome, its choices or its sound check (Roni's F37 work).
- A tutorial for the voice guide.
- Any new key.

## Result

Not started.
