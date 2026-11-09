# SN11 Learn v3: one card per voice, played alone

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | SN01, SN02, SN03, SN04, SN06 |
| **Hotspots** | learn |
| **Branch** | `feature/SN11-learn-v3` |

## Goal

The Learn page gets a section **Seven voices**: one card for each voice of the ensemble. Each card says in plain words what the voice tells the listener, and has a **Play alone** button that plays the picture on screen with only that voice audible. A listener learns one voice at a time, by ear, before hearing them together.

## Why

- Learn today teaches the old single note per category (`src/features/learn/index.tsx`, `useEngine` at about line 42, the category cards with `categoryAt`). It says nothing about the seven voices of v3 (`docs/PLAN.md` §6.3, "Rules kept" and the ruleset table).
- The ensemble (SN04) can play one voice alone: `solo(voice)` on the same engine. The Learn page already creates an engine (`useEngine`), so the cards reuse that pattern rather than a new page.
- `docs/PLAN.md` §6.3 requires the first minute to teach by doing, so each voice is taught by playing it, not by reading about it.

**Order and a decision.** The queue lists SN02 and SN04. This ticket also needs SN01 (`extractInWorker`), SN03 (`MusicFrame`, `toMusicFrame`, `presetFor`) and SN06 (`FrameSequenceSource`, to step the frames). Merge those first. The queue says the cards play on the synthetic sets. A set id typed into `src/` would break `phases.md`, so the cards play **the data set on screen** (the page's `visualization`). The synthetic sets are used by the tests and by the team's listening check. If the team wants the cards always on one synthetic set, that is a decision for the team leader (a named constant in `src/config.ts`), to be posted on `docs/AGENT-BOARD.md` first.

## Design

### The cards (`src/features/learn/voiceCards.ts`, data; `voiceCards.tsx`, component)

```ts
export const VOICE_TEACHING: Record<VoiceId, { name: string; means: string; listen: string }>
```
One entry per voice, written in plain English, with no data-set words:

| Voice | Name | What it tells you (`means`) | What to listen for (`listen`) |
|---|---|---|---|
| `melody` | Melody | The overall level of the picture. | The line goes up when the overall level goes up. |
| `harmony` | Harmony | How mixed the picture is. | One note means one kind of value; more notes mean a mix. |
| `bass` | Bass | The shift from normal, or from the first date. | Low notes are below, high notes above. |
| `hotspots` | Hot spots | Each area that stands out, as one voice. | Higher notes are stronger areas; left and right show where they are. |
| `rhythm` | Rhythm | The edges: where the picture changes sharply. | Busy notes mean a sharp boundary; calm notes mean a smooth field. |
| `motion` | Motion | How fast the picture moves, and which way. | Open and bright is quick; a sweep to the right is eastward. |
| `time` | Time | Where you are in the dates. | A pulse for each date; an accent when the month or the year changes. |

- `VoiceCard` (component): a `<section aria-labelledby>` with the name as its heading, `means` and `listen` as paragraphs, and two buttons: **Play melody alone** (or the voice's name) and **Stop**. Play starts the ensemble from the click (`start()`), solos the voice (`solo(voice)`), and steps the frames of the current data set through `FrameSequenceSource` (SN06) at the "slow" step. Stop calls `solo(null)` and `stop()`.
- Only the first card's `Play` button is in the tab order before the others (a simple list; no roving tabindex is needed).
- A card for a voice the data set does not allow (`sonification.voices`) is shown with "This data set does not use this voice." and no button.

### The section (`src/features/learn/index.tsx`)

- A new heading "Seven voices" after the existing content, with a short intro: "The picture is read frame by frame. Each voice tells you one thing. Play one alone first."
- The section names the data set it plays on, from its title: "Played on: <title>." (The title comes from the manifest.)
- The existing Learn content and its engine are unchanged.

### Playing

- The picture stepping and the features come from `FrameSequenceSource` (SN06) with the checked frames, one at a time, through `extractInWorker` (SN01); each `MusicFrame` (SN03) goes to `apply` (SN04). The voice is soloed, so only it sounds.
- While a card plays, the others' Play buttons are disabled and the card shows "Playing <name> alone. Stop" (text, through the button's label, and through `useAnnounce` once at the start).

## Reuse

- `createEnsemble`, `useEnsemble` (`src/audio/ensemble/`, SN04), `solo`, `start`, `stop`.
- `FrameSequenceSource`, `SEQUENCE_STEP_MS` (`src/analysis/video/`, SN06).
- `extractInWorker`, `toMusicFrame`, `presetFor`, `VOICE_IDS` (SN01, SN03, `src/data/sonification.ts`).
- `useEngine` pattern in `src/features/learn/index.tsx` (about line 42), `useAnnounce`, `Button`.
- `learn.test.tsx` (existing) keeps passing unchanged.

## Touches

- New: `src/features/learn/voiceCards.ts`, `voiceCards.tsx`, `voiceCards.test.tsx`.
- Edit: `src/features/learn/index.tsx` (one section, after the existing content). No change to the existing category cards.
- Hotspot: `learn`.

## Steps

1. Write `voiceCards.ts` (the seven entries, in `VOICE_IDS` order) and a test that every voice has an entry and no entry names a data set or a unit.
2. Write `VoiceCard.tsx`, with a fake ensemble and a fake source: Play solos and starts, Stop releases.
3. Add the section to `index.tsx`; run `learn.test.tsx` before and after (it passes unchanged).
4. Manual check on a data set with `sonification`: each card plays its voice alone, and only that voice is audible.

## Tests

- **Entries.** Seven entries in `VOICE_IDS` order; no entry contains "warm", "cold", "temperature", a unit or a date (a test reads the text).
- **Play.** A click on "Play melody alone" calls `start()`, then `solo('melody')`, then starts the source; no call happens on render.
- **Stop.** Stop calls `solo(null)` and `stop()`; the other cards' buttons are enabled again.
- **Data set without the voice.** A card for a voice missing from `sonification.voices` shows the sentence and no button.
- **Announcement.** Starting a card announces its name once (through `AnnouncerProvider` in the test).
- **Accessibility.** `expectNoA11yViolations` on the section; each card is a labelled section; the buttons have names.
- **Existing Learn tests** pass unchanged.

- **Golden.** `src/features/learn/__golden__/voice-cards.json`: the card texts (`VOICE_TEACHING`) and, for the fixture, the first `MusicFrame` each card would solo, recorded as text.

## Guardrails

- No sound before a click: the cards start the ensemble only from their buttons.
- Every voice has its words on the card (`means`, `listen`); the sound has a text equivalent here.
- Nothing flashes; the Learn cards do not animate. Reduced motion: no change.
- Nothing data-set-specific in `src/`: the cards name voices, and the data set on screen is used for the sound.
- No model, no network beyond the same-origin PNG frames.

## Done when

- Seven cards are on the Learn page, each playing its voice alone on the data set on screen, with Stop.
- The text has no data-set words, and the test that checks it passes.
- `learn.test.tsx` passes unchanged.
- The manual check is recorded in Result.
- `npm run lint && npm test && npm run build` pass with their real output in Result.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- The old category cards on Learn (they stay).
- Quizzes and the ear-training game (IX11).
- A card per preset (the presets are on About; SN10 writes the recipe).

## Result

Not started.
