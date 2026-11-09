# SN13 One voice at a time: real gain ducking under the guide and speech on every page

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | SN04 |
| **Hotspots** | voice, engine |
| **Branch** | `feature/SN13-one-voice-at-a-time` |

## Goal

When a voice speaks (the voice guide, the browser's speech, or a screen reader's announcement from this app), the music **ducks**: it drops by 18 dB and comes back smoothly after the speech. It does not pause, and it does not stop the playing listener's place. The same rule holds on every page (Listen, Learn, Compare, the explorer, Welcome), not only on the Listen page. Speech never overlaps a note played on purpose: the Welcome sound check waits for its spoken line to finish.

## Why

- `src/assistant/ducking.ts` `useDucking` **pauses** the player with `sendPlayerCommand('pause')` while the guide speaks or listens. It is not ducking: the music stops, does not come back by itself, and the other pages are not affected (`ducking.ts` comment and the findings: "only reaches the player").
- `src/audio/engine.ts` `duck()` and `unduck()` (about lines 565 to 572) exist but nothing calls them. Their `duck()` is `pause()` + `silence()`.
- `src/features/welcome/Welcome.tsx` (line 156) plays a note and starts `speak(current.question)` in the same click, so the two overlap. `src/features/welcome/speak.ts` has no way to say when the speech ended.
- `src/components/Announcer.tsx` announces text for a screen reader, but music plays over it. "Screen reader first": the music must step aside while speech is made.
- The ensemble (SN04) has no ducking yet, so this ticket adds it in the same way.

**Order.** The queue lists SN04. This ticket edits `src/audio/engine.ts` and `src/audio/ensemble/` (both are SN04's or the team leader's), so SN04 must be on `main` first.

**Hotspots.** The queue lists `voice` only. This ticket also edits `src/audio/engine.ts` (hotspot `engine`) and `src/features/welcome/` (Roni). Do not run it with another ticket in `engine` or `welcome` at the same time.

## Design

### The duck controller (`src/audio/duck.ts`, new, pure)

```ts
export const DUCK_DB = -18
export const DUCK_LINEAR = 10 ** (DUCK_DB / 20)     // ≈ 0.126
export const DUCK_ATTACK_S = 0.3
export const DUCK_RELEASE_S = 0.8
export type DuckReason = 'guide' | 'speech' | 'announcement' | 'engine'
export type DuckListener = (gain: number, rampS: number) => void

/** Reference counted: the sound is ducked while any reason holds it. */
export const duck: {
  begin(reason: DuckReason): void
  end(reason: DuckReason): void
  /** Begins `reason` now and ends it after `ms` (a timer; tests use fake timers). */
  for(reason: DuckReason, ms: number): void
  /** Called by the ensemble and the engine. Returns the unsubscribe function. The listener is called at once with the current target. */
  subscribe(listener: DuckListener): () => void
  /** The current target gain: 1, or DUCK_LINEAR. */
  target(): number
}
/** A speech's length in ms, for the announcement duck: 1.2 s at least, 6 s at most, about 60 ms a character. */
export function speechMs(text: string): number
```
- `begin` and `end` change the target. The target is `DUCK_LINEAR` while any reason is held, else `1`. A change calls each listener with `(target, rampS)`, where `rampS` is `DUCK_ATTACK_S` going down and `DUCK_RELEASE_S` going up.
- `end` for a reason that is not held does nothing.
- Module-level state is the only state, and it is reset by `duck.reset()` for tests.

### The ensemble and the engine

- `src/audio/ensemble/index.ts` (SN04): `createEnsemble` subscribes to `duck` and ramps its master gain to the target (`rampTo(target × volume, rampS)`); `dispose` unsubscribes. The pause and resume fades keep working: they ramp to 0 and back to the target, not to 1.
- `src/audio/engine.ts`: the existing `duck()` and `unduck()` change their meaning. `duck()` calls `duck.begin('engine')` and the engine's master ramps to the target with `DUCK_ATTACK_S`; `unduck()` calls `duck.end('engine')`. Neither pauses nor silences. The engine subscribes once, when it is created (`createSoundEngine`), and unsubscribes on a new `dispose` if the engine gets one (add `dispose` as an optional method only if a test needs it).
- The `SoundEngine.duck` doc comment in `src/audio/index.ts` is updated to say "lowers the sound by DUCK_DB; not a pause". `src/audio/index.ts` is the team leader's file: this one comment line is the only change there.

### The guide (`src/assistant/ducking.ts`)

- `useDucking(status)` no longer sends `pause`. While the guide is `speaking` **or** `listening`, it calls `duck.begin('guide')`; when it leaves those states, `duck.end('guide')` is called after `DUCK_RELEASE_S` (so the end of a sentence is not cut).
- The functions `noteGuidePlaybackCommand` and `resetDucking` are removed with the pause logic, because nothing needs "the listener asked for sound" any more. Their callers are the guide's playback command path: remove those calls too in `src/hooks/useVoiceAssistant.ts` only if they are only there for ducking (Mohammad confirms first; see Touches).
- The listener's own playback commands are unchanged: "play" and "pause" still reach the player.

### Announcements (`src/components/Announcer.tsx`)

- `AnnouncerProvider.announce(text)` calls `duck.for('announcement', speechMs(text))` before it updates the live region. The announcement itself is not ducked against: the screen reader speaks over the music, which is now quiet.

### Speech (`src/features/welcome/speak.ts`)

- `speak(text)` returns `Promise<void>`, resolved on the utterance's `end` (or `error`, or at once when speech is not available). While it speaks it calls `duck.begin('speech')`, and `duck.end('speech')` on the end.
- `hush()` ends the duck too (`duck.end('speech')`).

### The Welcome sound check (`src/features/welcome/Welcome.tsx`, line 156)

- The click plays the question's note **after** the spoken line ends: `await speak(current.question)` (when speech is on) and then `playNote(...)`, or only the note when speech is off. The "Play" button is disabled while either is running, and the listener cannot start a second one. The note plays "after the question", so the two never overlap.
- The existing sound check, its answers and its tests (`welcome.test.tsx`) keep their meaning; the test that expects both calls at once is changed to expect the order.

## Reuse

- `engine.ts` `duck`, `unduck`, `silence`, `open` (about lines 565 to 572 and the helpers above them).
- `src/assistant/ducking.ts` `useDucking` shape; `AssistantStatus` (`src/hooks/useVoiceAssistant.ts`).
- `speak` and `hush` (`src/features/welcome/speak.ts`).
- `useAnnounce`, `AnnouncerProvider` (`src/components/`).
- `CUT_RAMP_S`, `VOLUME_RAMP_S` as the pattern for ramps (`src/audio/engine.ts`).

## Touches

- New: `src/audio/duck.ts`, `src/audio/duck.test.ts`.
- Edit: `src/audio/engine.ts` (`duck`, `unduck`, the subscription; team leader); `src/audio/index.ts` (one doc comment; team leader); `src/audio/ensemble/index.ts` (SN04's file: the subscription and the unsubscribe in `dispose`; team leader); `src/assistant/ducking.ts` and its test (Mohammad); `src/components/Announcer.tsx` (Roni); `src/features/welcome/speak.ts`, `Welcome.tsx` and `welcome.test.tsx` (Roni).
- Maybe: `src/hooks/useVoiceAssistant.ts` only to remove the ducking calls, after Mohammad says so on `docs/AGENT-BOARD.md`.
- Do not touch the player (`usePlayer.ts`) or `src/features/player/`: the Listen page gets its ducking through the ensemble and the engine.
- Reviewers: Mohammad (`src/assistant/`, `useVoiceAssistant`), Roni (`Announcer.tsx`, `welcome/`), team leader (`src/audio/`).

## Steps

1. Write `duck.ts` and its tests with fake timers (no Tone): begin, end, reference counting, target values, `for`, `speechMs`.
2. Subscribe the engine (`duck`/`unduck` now ramp) and test it with the recording mock from `engine.test.ts`.
3. Subscribe the ensemble (SN04's file), with the pause and resume fades still ramping to 0 and back.
4. Change `ducking.ts`: remove the pause, duck on `speaking` and `listening`. Update its test (no `pause` command is sent).
5. Make `Announcer.tsx` duck on each announcement; test with an `AnnouncerProvider` and fake timers.
6. Make `speak` return a promise and duck on speech; change Welcome to play the note after the speech; update `welcome.test.tsx`.
7. Run the checks, then the manual check: a page with music playing, the guide asked a question: the music drops and comes back.

## Tests

- **Controller.** Two reasons held: the target stays `DUCK_LINEAR` until both end; `end` of a reason not held does nothing; `for` ends after the given time; a listener gets `(DUCK_LINEAR, 0.3)` on a duck and `(1, 0.8)` on a release.
- **speechMs.** A short text gives 1200 ms; a long text gives 6000 ms; in between, about 60 ms a character.
- **Engine.** `duck()` ramps the master gain to `DUCK_LINEAR` over `DUCK_ATTACK_S`, with no `pause` and no `silence` call; `unduck()` ramps back over `DUCK_RELEASE_S`.
- **Ensemble.** A duck ramps the master gain; a pause still fades to 0; a resume fades back to the target (not to 1 while ducked).
- **Guide.** `speaking` ducks and sends no `pause`; the end waits `DUCK_RELEASE_S` before the release; `listening` ducks too.
- **Announcer.** Each announcement begins a duck of `speechMs(text)`; the live region still gets the text.
- **Speech.** `speak` resolves on the utterance's end; `hush` ends the duck; with no speech API, `speak` resolves at once.
- **Welcome.** The note is not played until the speech has ended (a fake speech that ends later: no `playSequence` call before its end). `welcome.test.tsx` passes after the change.
- **Accessibility.** No new violations on Welcome and the announcer.
- **Existing tests** outside these files pass unchanged (`engine.test.ts`, `player.test.tsx`, `learn.test.tsx`).

- **Golden.** `src/audio/__golden__/duck.json`: the `(gain, rampS)` calls the controller makes for a fixed script of `begin`, `end` and `for` calls (with fake timers), recorded as a list. Any change to the timings shows in the diff.

## Guardrails

- Screen reader first: while speech or an announcement is made, the music is quiet, so it never covers the words.
- No sound before a click: the ducks change only sounds that are already playing; none starts a sound.
- No flashing; no visual change.
- The peak stays at or below −1 dBFS: ducking only lowers the sound.
- Nothing data-set-specific in `src/`.
- No model, no network. `speechSynthesis` is the browser's own.

## Done when

- The music ducks under the guide, under speech and under announcements on every page, and comes back smoothly; it is never paused by these.
- The Welcome sound check no longer overlaps the question.
- The tests pass, including the changed ones named above.
- `npm run lint && npm test && npm run build` pass with their real output in Result, and the manual check is recorded.

## Checks

```bash
npm run lint && npm test && npm run build
```

Manual: `npm run dev`, a data set playing on Listen; open the voice guide and ask a question (or use the browser's speech on Welcome); record in Result that the music dropped by about 18 dB during the speech and came back afterwards.

## Out of scope

- The voice guide's own audio (`src/assistant/audio.ts`, its recorder and speech player). Their contexts are a separate issue (findings: three live contexts).
- Vibration and haptics (F15, IX10).
- Interface sounds (AU-UI).
- Changing which playback commands the guide may send.

## Result

Not started.
