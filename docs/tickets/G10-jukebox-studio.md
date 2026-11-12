# G10 Jukebox studio: narration in time with the sound, instrument timbres, and the live route

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | G08, G09 |
| **Hotspots** | — |
| **Branch** | `feature/G10-jukebox-studio` |

## Goal

On the standalone Jukebox page (`jukebox.html`), someone types a question or presses a demo button, the page calls `POST /api/v1/jukebox/generate`, and the answer plays: the sound, with each of the vision agent's descriptions shown, announced and optionally spoken at its moment, and with instruments that sound different from each other.

## Why

- G09's player takes only the `audio` half of the route's answer (`src/features/jukebox/JukeboxPlayer.tsx`). The `vision` half, the time-coded alt text that is the accessibility point of the orchestrator, is dropped.
- Every track is the same `Tone.Synth`, so two tracks cannot be told apart by ear.
- Nothing in the browser calls the route: a payload has to be pasted by hand.

## Design

**No change to `src/App.tsx`** (hotspot `app`, held by another ticket). Everything is on `jukebox.html`, which only the dev server serves.

### A. Narration on the Transport

- `JukeboxPlayer` takes an optional `vision` prop next to `payload` (the audio). Without it the player behaves as in G09.
- `VisionPayload` is `{ descriptions: { timestamp_sec, alt_text, intensity_level: 'low' | 'medium' | 'high' }[] }`, checked with zod (`parseVisionPayload`).
- `captionTimes(vision, payload)` gives each description its time on the track, in time order. If the latest `timestamp_sec` is later than the track's last step, every time is scaled by the same factor so the latest lands on the last step; otherwise the times are used as they are.
- Each description is put on the Transport with `transport.scheduleOnce`. At its moment the player:
  - shows `alt_text` and `intensity_level` in the caption region (large text on the inverse surface colours);
  - passes `alt_text` to `useAnnounce()`;
  - speaks it with the Web Speech API if the "Spoken narration (Web Speech API)" toggle is on (off at the start; not shown where the browser has no speech). Stop silences the speech too.
- The caption region is not itself a live region: the announcer already reads the text, and a second live region would read it twice.

This is the ADR-0005 exception recorded in G08: the vision agent's alt text is the one model-written text a user reads. It is rendered as plain text only.

### B. Timbres

`timbreOf(instrument)`, case-insensitive, by the words in the name:

| The name contains | Timbre | Voice |
|---|---|---|
| `bass` or `drone` | `bass` | `Tone.Synth`, triangle oscillator, one octave lower |
| `pad` or `ambient` | `pad` | `Tone.AMSynth`, attack 0.1 s |
| anything else | `lead` | `Tone.Synth`, sawtooth oscillator |

### C. The live route

- `generate.ts`: `generateJukebox({ query, contrast, detailLevel }, signal)` posts `{ query, accessibilityProfile: { contrast, detailLevel } }` and returns one of: the checked answer; "nothing was made" (the route answers 200 with no audio when no data was found); or an error kind (`rate` for 429, `model` for 502 and 504, `off` for 503, `unreachable` for anything else). It never throws. The answer is checked with zod; an answer whose audio does not pass is a `model` error, and a vision half that does not pass is dropped.
- `JukeboxStudio.tsx`, the page:
  - a form: the question (300 characters at most, as the server), two demo buttons that fill the question and send it, a contrast choice (high or low) and a detail choice (verbose or brief);
  - while waiting, the status "Orchestrating NASA data and auditing accessibility..." in a `role="status"` region, and the form's buttons are disabled;
  - an error message for each error kind, with a Retry button that sends the same request again;
  - when the auditor did not approve the result, a warning says so in the page's own words; the auditor's note, which a model wrote, is behind a "details" control marked as such;
  - the player, with the answer's audio and vision;
  - `<details>` "Load Raw JSON Payload (Offline Demo Mode)": the text box from G09. It takes the route's whole answer or a bare audio payload, and starts with a made-up sample that has descriptions.

The two demo questions name places and dates. They are example questions on a development page, not a data set's details, and they live in the studio file only.

## Reuse

- `speak` and `hush` from `src/features/welcome/speak.ts` (they also handle a browser with no speech).
- `apiBase()` from `src/config.ts`; the request pattern of `src/features/ask/remote.ts`.
- `Button`, `Notice`, `useAnnounce`, and the `.ui-field`, `.ui-input`, `.ui-select`, `.ui-textarea` styles.
- `payload.ts` and the end-of-playback timer from G09.

## Touches

- `src/features/jukebox/`: `JukeboxPlayer.tsx`, `payload.ts`, `jukebox.css`, `dev.tsx`, their tests; new `generate.ts`, `JukeboxStudio.tsx` and their tests; `DevPage.tsx` is replaced by `JukeboxStudio.tsx`
- `docs/tickets/G10-jukebox-studio.md`, `docs/TICKETS.md` (own row), `docs/PRE-HACKATHON-WORK.md` (after the merge)

## Steps

1. `payload.ts`: the vision schema, `captionTimes`, `timbreOf`.
2. `JukeboxPlayer.tsx`: timbres, captions on the Transport, the caption region, the speech toggle.
3. `generate.ts`.
4. `JukeboxStudio.tsx` and `dev.tsx`.
5. Tests for each.

## Tests

- `payload.test.ts`: the vision schema; `captionTimes` keeps times that fit, scales times that do not, and sorts; `timbreOf` for each row of the table, in any case.
- `JukeboxPlayer.test.tsx`: without `vision` nothing about captions is shown or scheduled; with it, each description is scheduled at its time, and at that time the caption shows, the text is announced, and it is spoken only when the toggle is on; Stop clears the pending captions and the speech; each timbre builds the right voice, and the bass plays an octave lower.
- `generate.test.ts`, with `fetch` stubbed: the body sent; a good answer; no audio; 429, 502, 504, 503, a network failure; an answer that is not an answer.
- `JukeboxStudio.test.tsx`: a demo button sends its question; the status while waiting; the player appears with the answer; each error has its message and Retry sends the same request again; the unapproved warning; the offline box loads a pasted answer; no accessibility violations.

## Guardrails

- The same payload always gives the same notes and the same caption times.
- The peak stays at or below −1 dBFS. No sound and no speech before a click or key press.
- Every sound has a text equivalent: the captions are text, and are announced through `useAnnounce`.
- A model's text is shown as plain text only, and only where the ticket says.

## Done when

- With the server running with `JUKEBOX_ENABLED=true`, a demo button on `http://localhost:5173/jukebox.html` plays an answer with its captions.
- With no server, the error and Retry show, and the offline box still plays the sample with its captions.
- The checks pass.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- A page of the app, and the production build (`jukebox.html` is still dev-server only).
- Retrying on the server, and streaming progress from the graph.
- Sharing the Transport with the app's own player (as in G09).
- Lowering the music while the narration speaks.

## Result

Filled in by the agent: the branch, the commits, and the real output of the checks, failures included.
