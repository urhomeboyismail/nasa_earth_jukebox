# JB11 Echo's chat welcome, with a manual-setup form

| | |
|---|---|
| **Priority** | P2 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | JB09 |
| **Hotspots** | — |
| **Branch** | `feature/JB11-chat-welcome` (from `feature/welcome-name`, with `feature/JB09-tour-from-welcome` merged in) |

## Goal

The welcome feels like a chat with Echo: it asks your name, then how to tune your sound (four chips), then how you will use the app and checks your sound, and ends with "Frequencies locked, <name>!" as Echo docks. A "Prefer manual setup?" toggle swaps the chat for a plain form with the same choices. Returning visitors never see it.

## Why

- `feature/welcome-name` (commit `b800997`, unmerged) already asks the name and music taste and stores the name on this device only (`src/features/welcome/storage.ts`, `name`), and greets returning visitors (`src/features/home/useWelcomeBack.ts`). It is a step-by-step panel, not a chat, and has no quick form.
- The four sounds asked for already exist as styles: `cinematic`, `chiptune`, `nature`, `bass` (`src/sonify/presets.ts`, `STYLE_IDS` in `src/data/sonification.ts:9`), saved with `saveAudioPrefs({ style })` (`src/audio/prefs.ts`).
- Returning visitors already skip the welcome: `useWelcome().done` (`src/features/home/index.tsx:31`).

## Design

**Chat (default).** Each of Echo's lines and the listener's replies stay in a short transcript (`<ol>`, not live; announcements go through `useAnnounce`):

1. `CHAT_GREETING` ("Commander! Welcome to the Earth Information Jukebox. I'm Echo, your sonic guide. Before we drop the needle on these NASA datasets, what should I call you?"), a labelled name input (optional, 40 characters) and Send; Enter sends. "Skip this question" stays.
2. `tuneQuestion(name)` ("Great to meet you, <name>! How are we tuning your sound frequencies today?") and four chips (`Button pressed`, in a labelled group): Cinematic Orchestral, 8-Bit Arcade, Nature Ambient, Heavy Bass. A chip saves the style and moves on.
3. The existing path choice, then the existing sound check and volume.
4. `finish` as today; Echo's dock bubble says `lockedLine(name)` ("Frequencies locked, <name>! Let's explore the planet.") through `useMascotGuide().offerTip`, and the line is announced.

Echo pops in with a short scale-in, only without `prefers-reduced-motion`.

**Manual form** (`ManualSetup.tsx`), toggled by "Prefer manual setup?" ⇄ "Chat with Echo instead" at the top of the panel: a labelled name input, an "Audio preference" select (the four styles and "The data set's own sound"), a "How you will use it" fieldset with the three path radios, and "Save & Enter Jukebox". The choices are shared with the chat, so switching keeps them. Submitting saves the name and style and finishes with the chosen path, without the sound check.

**Storage.** The name in `earth-jukebox:welcome`, the style in `earth-jukebox:audio-prefs`, through the existing guarded stores. No new keys.

## Reuse

`saveWelcome`, `useWelcome`, `saveAudioPrefs`, `STYLE_IDS`, `Button`, `useAnnounce`, `useMascotGuide().offerTip`, `choose`, `finish` and the sound check in `Welcome.tsx`, `speak` and `hush`.

## Touches

- `src/features/welcome/Welcome.tsx`, `ManualSetup.tsx` (new), `lines.ts`, `welcome.css`, `welcome.test.tsx`.
- Merged in, unchanged: the files of `feature/welcome-name` and `feature/JB09-tour-from-welcome`.
- `docs/PRE-HACKATHON-WORK.md`: one line after the merge.

## Steps

1. Branch from `feature/welcome-name` without its `docs/TICKETS.md` hunk; merge `feature/JB09-tour-from-welcome`.
2. The chat steps and lines.
3. The manual form and the toggle.
4. Tests, checks, and a try in the browser (mouse, keyboard only, reduced motion).

## Tests

- Chat: name and Enter, the tune line greets by name, a chip saves the style, a path, finishing saves `{ done, name, path }` and Echo's bubble says the locked line.
- Manual: toggle, fill the form, "Save & Enter Jukebox" saves the name, style and path and closes the welcome; the screen-reader radio gives concise text and no speech.
- Switching views keeps what was typed and chosen; a returning visitor sees no welcome; the map path still starts the tour.
- `expectNoA11yViolations` on both views.

## Guardrails

- Every control is labelled and works by keyboard; focus moves to each new step's heading and to the view's heading on a switch.
- Nothing sounds or speaks before a click; the screen-reader path never speaks. The name never goes into `publishContext`, to the server or into a log.
- Nothing specific to one data set.

## Done when

- Both the chat and the form set the name, style and path, and a returning visitor skips the welcome. The checks pass.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- Tailwind (the app has none) and new storage keys.
- Changing the sound check or the Listen mixer.

## Result

`feature/welcome-name` (b800997) does not exist in the repo, so this was built on `main` (user decision, 14 Nov): the name reuses the planet intro's store (`earth-jukebox:intro`) and is not asked again when the intro has it; no new storage keys, and `earth-jukebox:welcome` has no name. `npm run build`: built. `npx tsc -b` and `npx oxlint`: clean. `npx vitest run`: 216 files, 3118 tests passed. Not tried in a real browser (mouse, keyboard only, reduced motion).
