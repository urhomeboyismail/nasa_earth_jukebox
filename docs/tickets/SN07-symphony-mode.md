# SN07 Listen: Symphony mode wired end to end; Detail, mixer, layer captions; Simple mode kept

| | |
|---|---|
| **Priority** | P1 |
| **Size** | L (more than a day) |
| **Who** | agent |
| **Needs** | SN01, SN03, SN04, SN06 |
| **Hotspots** | player |
| **Branch** | `feature/SN07-symphony-mode` |

## Goal

The Listen page gets a **Symphony** mode, which reads each frame as it is shown (SN06), turns it into a `MusicFrame` (SN03) and plays it on the ensemble (SN04). It has a Detail control (Calm, Standard, Full), a voice mixer (mute and solo per voice), a layer caption strip for sighted listeners and a plain "Now" line for screen readers. **Simple** is today's player, unchanged. The default is Symphony for a data set that has a `sonification` block, and Simple for any other, so the existing data sets and their player tests keep their behaviour.

## Why

- `src/features/player/index.tsx` `PlayerPage` renders `Player`, which runs `usePlayer` (`usePlayer.ts`). `usePlayer` plays one category per date through `createSoundEngine` (`src/audio/engine.ts`). Nothing else plays.
- The player's existing tests (`src/features/player/player.test.tsx`, `change.test.tsx`, `vibration.test.tsx`, `controls.test.ts`) describe Simple mode. They must pass **unchanged**. So Simple is not edited; Symphony is added beside it, and the page chooses between them.
- The default follows the data set, not a global switch: a data set with `sonification` (the v3 sets) opens in Symphony; the fixture, which has none, opens in Simple. That keeps the existing tests true with no edits. The team lead decides whether to change this; see Out of scope.

**Order.** The queue needs SN01 (`extractInWorker`, `FrameFeatures`), SN03 (`toMusicFrame`, `MusicFrame`, `DETAIL_VOICES`, `Preset`) and SN04 (`createEnsemble`, `useEnsemble`), and SN06 (`LiveSource`, `FrameSequenceSource`). The queue's Needs column omits SN06, so SN06 must be on `main` too. Hotspot `player`: no other player ticket (SN08, IX03, IX06) may run at the same time.

## Design

### Files (`src/features/player/`)

| File | Contents |
|---|---|
| `listenMode.ts` | `ListenMode`, `readListenMode`, `useListenMode(visualization)`. Storage key `earth-jukebox:listen-mode`. |
| `Symphony.tsx` | The Symphony panel: the picture or video, the controls, the status line, the caption strip, the "Now" line. |
| `symphony.ts` | `useSymphony(visualization)`: wires the source, `toMusicFrame` and the ensemble, and returns state and actions. No JSX. |
| `DetailControl.tsx` | A radio group: Calm, Standard, Full. |
| `VoiceMixer.tsx` | One row per voice: a mute button and a solo button, each with `aria-pressed`. |
| `LayerCaptions.tsx` | The caption strip (`aria-hidden`). |
| `index.tsx` | Adds the mode switch above the content. Simple renders today's content unchanged. |

### Mode (`listenMode.ts`)

```ts
export type ListenMode = 'symphony' | 'simple'   // SN08 adds 'scan'
export function readListenMode(hasSonification: boolean): ListenMode   // stored choice first; else symphony if hasSonification, else simple
export function useListenMode(visualization: Visualization): [ListenMode, (mode: ListenMode) => void]
```
Storage is guarded (`try`/`catch`, as `src/audio/style.ts` does). A stored choice for a data set without a `sonification` block still applies (a listener who picked Symphony keeps it).

### The page (`index.tsx`)

- A radio group "Listen as" with **Symphony** and **Simple** (`role="radiogroup"` by native radio inputs in a `fieldset` with a `legend`). Changing it announces the new mode through `useAnnounce` ("Symphony mode. Press Play to start."). Switching to Simple stops Symphony first (`ensemble.stop()` and `source.stop()`).
- Simple: the existing `Player` content, untouched.
- Symphony: `<Symphony visualization={…} />`.

### The Symphony panel (`Symphony.tsx`, `symphony.ts`)

State in `useSymphony`:
- `status`: the `SourceStatus` from SN06 (`idle`, `video`, `frames`, `stopped`, `error`) and the ensemble's `EnsembleStatus` (`off`, `on`, `paused`, `suspended`).
- `music`: the latest `MusicFrame` (for captions and the summary), `date`, `confidence`, `reason` (why the checked frames are used, if they are).
- `detail`, `muted: Set<VoiceId>`, `solo: VoiceId | null`.
- Actions: `play()`, `pause()`, `stop()`, `setDetail(d)`, `toggleMute(v)`, `toggleSolo(v)`, `setSpeed(s)`.

Rules:
1. **Play** (the click handler): `await ensemble.start()`, then `source.start()`. `play` is the only place either starts. If the ensemble is `suspended` after `start()`, the button reads **Turn sound on** and the next click calls `start()` again.
2. **Each frame.** `onFrame(frame)` → `toMusicFrame(frame.features, preset, previous)` → `previous = music` (kept in a ref) → `ensemble.apply(music, now + SCHEDULE_LOOKAHEAD_S)` → `setMusic(music)` from the callback. Not in an effect.
3. **Preset.** `visualization.sonification?.preset ?? 'major'`, through `presetFor` (SN03).
4. **Detail.** Starts at `visualization.sonification?.detail ?? 'standard'`. `voices`, when given in the manifest, limit the mixer rows: a voice not in the list has no row and never sounds.
5. **Speed.** In video mode it sets `video.playbackRate` (slow 0.5, normal 1, fast 2). In sequence mode it sets `SEQUENCE_STEP_MS` (SN06).
6. **Pause and resume.** Pause calls `ensemble.pause()` and `source.stop()`; resume calls `ensemble.resume()` and `source.start()` (but never `start()` of the ensemble without a click). The status line says "Paused".
7. **Page hidden.** SN04 pauses the ensemble on `visibilitychange`. The source also stops (the video is paused by the browser). The status line says "Paused while the page was hidden. Press Play to continue."
8. **Unmount.** `source.dispose()`. The ensemble is disposed by `useEnsemble`.

Picture and status:
- In video mode the picture is the `<video>` (muted, `playsInline`, no controls, `aria-label` = the alt text of the dated frame nearest the current video date). In sequence mode it is the existing `Viewer` (`Viewer.tsx`) with the frame's date and region outline. Nothing animates beyond the frames themselves (`prefers-reduced-motion`: no extra motion anywhere).
- The status line (visible, plain text): "Reading the video. Reading confidence 84%." / "Reading the checked frames. The video is not available: <reason>." Confidence is shown as a whole percentage. Below 60% it also says "Colours may be a little off; readings may be less exact."
- **Now** (a visible paragraph, not `aria-live`, so a screen-reader user can read it on their own): the `music.summary` sentence, for example "High overall, rising. Two hot spots. Moving east, quick." Changes are not announced here (SN10 does that, rate-limited).

### Detail, mixer and captions

- `DetailControl`: a radio group "Detail" with Calm, Standard, Full. Each choice calls `ensemble.setDetail` and announces "Detail: Standard. Melody, harmony, bass, hot spots and time." (the voice names from `DETAIL_VOICES`, in words).
- `VoiceMixer`: for each voice in `VOICE_IDS` order (only those the data set allows and the detail level allows), a button **Mute melody** (`aria-pressed`) and a button **Solo melody** (`aria-pressed`). Solo on one voice makes the others silent (the ensemble does it; the buttons only report). The voice names are words, not icons.
- `LayerCaptions`: `aria-hidden="true"`. One line per voice that is audible this frame, from `music.caption` (the empty ones are left out). Plain text, no animation, no colour as the only signal.

### Keys

Space plays and pauses, as Simple does. The existing `isTyping` and `spaceActivates` guards in `index.tsx` stay as they are. Keys for the mixer are the buttons' own keys (Tab and Enter). Esc stops the performance (`stop()`). Do not add shortcuts that conflict with the app's `F41` shortcuts (`docs/PLAN.md`).

## Reuse

- `toMusicFrame`, `presetFor`, `MusicFrame`, `Preset`, `voicesFor`, `DETAIL_VOICES` (`src/sonify/`, SN03).
- `createEnsemble` through `useEnsemble` (`src/audio/ensemble/`, SN04).
- `LiveSource`, `FrameSequenceSource`, `SEQUENCE_STEP_MS`, `FRAME_RATE_CAP_HZ` (`src/analysis/video/`, SN06).
- `SCHEDULE_LOOKAHEAD_S` (`src/audio/ensemble/constants.ts`, SN04).
- `Viewer.tsx`, `Button` and `ButtonGroup` (`src/components/`), `useAnnounce` (`src/components/useAnnounce.ts`).
- `readListenMode` pattern from `src/audio/style.ts` (guarded storage).
- `VoiceMixer` and `DetailControl` names in words: `VOICE_IDS`, `DETAIL_LEVELS` (`src/data/sonification.ts`, SN05).

## Touches

- New: `src/features/player/listenMode.ts`, `Symphony.tsx`, `symphony.ts`, `DetailControl.tsx`, `VoiceMixer.tsx`, `LayerCaptions.tsx`, and their tests.
- Edit: `src/features/player/index.tsx` (the mode switch and the Symphony render only; the Simple branch is the existing code, moved inside a function without change).
- Do not edit `usePlayer.ts`, `Viewer.tsx`, `controls.ts` or `player.test.tsx` (their behaviour must not change). If `Viewer.tsx` needs a prop, post on `docs/AGENT-BOARD.md` for Mohammad first.
- Hotspot: `player`.

## Steps

1. Write `listenMode.ts` and its tests (default by `sonification`, stored choice, guarded storage).
2. Write `symphony.ts` (the hook) against a fake source and a fake ensemble (the hook takes them as arguments in tests; in the page they come from `useEnsemble` and `LiveSource`).
3. Write `DetailControl.tsx`, `VoiceMixer.tsx`, `LayerCaptions.tsx`, then `Symphony.tsx`.
4. Wire the mode switch into `index.tsx`. Run `player.test.tsx`, `change.test.tsx`, `vibration.test.tsx` **before and after** the change: they must pass unchanged.
5. Add the Symphony tests. Run the accessibility check.
6. Manual check: `npm run dev`, a data set with `sonification` and a `video` (after EIC01 and EIC03, or a test data set with an MP4). Record in Result: the first sound happens after the Play click; "Turn sound on" appears after a suspended context; switching tabs pauses; switching back does not resume.

## Tests

Use `installFakeAudioContext` and `installFakeWorker` (`src/test/fakes.ts`), `userEvent` for clicks, and `expectNoA11yViolations` on the rendered page in both modes. Mock `src/audio/ensemble` and `src/analysis/video` with `vi.mock` where the real ones would reach for Tone or a video element.

- **Default mode.** A visualization with `sonification` opens in Symphony; one without opens in Simple, and Simple shows the existing Play control.
- **Stored mode.** A stored `simple` choice wins over the default.
- **No sound on mount.** Rendering Symphony creates no audio context and calls no `start`.
- **Play.** A click calls `ensemble.start()` and then the source's `start()`; the source's frames reach `apply` as `MusicFrame`s.
- **Turn sound on.** When the ensemble reports `suspended`, the button reads "Turn sound on" and a click calls `start()` again.
- **Detail.** Choosing Calm calls `setDetail('calm')` and announces it through `useAnnounce` (with an `AnnouncerProvider` around the test). The radio group is keyboard operable (arrow keys move the choice).
- **Mixer.** "Mute melody" toggles `aria-pressed` and calls `mute('melody', true)`; "Solo bass" calls `solo('bass')`, and a second press calls `solo(null)`. Only the voices of the manifest's `voices` (if given) and the detail level have rows.
- **Captions.** `LayerCaptions` has `aria-hidden="true"`; the "Now" paragraph has the summary text and is not `aria-live`.
- **Status line.** The video path says "Reading the video" with the confidence; the fallback says "Reading the checked frames" with the reason; a confidence below 60% adds the less-exact sentence.
- **Pause and hidden page.** Pause calls `ensemble.pause()` and `source.stop()`; a hidden page leaves the status as "Paused" and does not resume.
- **Unmount.** The source is disposed.
- **Existing player tests.** `player.test.tsx`, `change.test.tsx`, `vibration.test.tsx`, `controls.test.ts` pass with no change to them.
- **Accessibility.** No violations in Symphony (both source paths) or Simple.

- **Golden.** `src/features/player/__golden__/symphony.json`: the calls `useSymphony` makes to a fake ensemble for the first four frames of the fixture (read through a fake source that uses SN01's `extractFeatures`): the `apply` arguments as `MusicFrame`s, and the caption lines. Run `npx vitest run -u` once, then read the diff.

## Guardrails

- No sound before a click or key press (WCAG 1.4.2): `play()` is the only caller of `start()`.
- Every voice and cue has a text equivalent: the caption strip (for sight), the "Now" line (for reading), the mixer buttons (named in words), and the status line. Changes are announced through `useAnnounce`, never by a live region of their own.
- Nothing flashes more than 3 times a second. The caption strip only changes text. The video plays the NASA frames as they are.
- Under `prefers-reduced-motion`: no animation is added; the strip and the picture do not move beyond the frames.
- Nothing data-set-specific in `src/`: the names come from the manifest (`sonification`, `voices`, `frames`) and from `VOICE_IDS`.
- No model, no network: the video and the PNG frames are same-origin.

## Done when

- The Listen page opens in Symphony for a data set with `sonification`, and in Simple otherwise, and the choice can be changed and is remembered.
- Play, pause, stop, detail, the mixer and the captions work by keyboard and by mouse, with the tests above.
- `player.test.tsx`, `change.test.tsx`, `vibration.test.tsx` and `controls.test.ts` pass unchanged.
- The manual checks in Step 6 are recorded in Result.
- `npm run lint && npm test && npm run build` pass with their real output in Result.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- Scan mode (SN08), explore (SN09), text events and rate-limited announcements (SN10), ducking under the guide (SN13).
- The voice guide's view of Symphony (its context keys, G06).
- Changing the default for the fixture or for any data set without `sonification`. The team lead decides that, on the board, after the listening check (H03).
- Vibration in Symphony (F15 is on the player's Simple path only).

## Result

Not started.
