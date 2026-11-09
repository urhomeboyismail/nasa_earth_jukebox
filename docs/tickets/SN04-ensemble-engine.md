# SN04 Ensemble engine: seven voices, master bus with limiter, dropout cue, lifecycle

| | |
|---|---|
| **Priority** | P1 |
| **Size** | L (more than a day) |
| **Who** | agent |
| **Needs** | SN03, SN05 |
| **Hotspots** | — |
| **Branch** | `feature/SN04-ensemble-engine` |

## Goal

`createEnsemble(preset, options)` returns an `Ensemble` that plays a `MusicFrame` (SN03) through seven voices into one master bus with a compressor and a −1 dBFS limiter. It has a lifecycle that a listener can trust (start from a click, pause and resume with a fade, sound turned off by the browser shows "Turn sound on", no sound after the page is hidden), and it renders the same graph offline for WAV export (SN12). The old engine (`src/audio/engine.ts`) stays as it is; this is a second, separate engine.

## Why

- `src/audio/engine.ts` plays one note per date. It has no master limiter in the "full" and "simple" styles (`engine.ts` `createVoices`; only the "change" style adds `Compressor` and `Limiter`, `ensureChangeVoices`). The peak is never measured.
- `engine.ts` `pause()` and `stop()` cut the sound. Nothing listens to `visibilitychange`, and `unlock()` never resumes a context the browser suspended (`engine.ts` `unlock`). A listener who switches tabs can come back to a dead page with no explanation.
- `engine.ts` `renderToWav` builds voices on Tone's offline context. The ensemble needs the same, so the live and the exported sound come from one graph.
- The noise hiss (`NoiseSynth` pink noise) is random and breaks "same input, same output". The ensemble uses no noise: the missing cue is a seeded dropout (see below).

**Order.** This ticket needs `MusicFrame`, `Preset`, `DETAIL_VOICES` and `VOICE_IDS` from SN03, and `DetailLevel` and `VoiceId` from SN05. The queue's Needs column says "—". SN03 (and so SN05 and SN01) must be on `main` first, so the types exist. Until then the graph code can be written against the types as given in SN03, but this branch cannot merge first.

## Design

Files, all new, in `src/audio/ensemble/` (team leader's area: `src/audio/` except `pan.ts`):

| File | Contents |
|---|---|
| `constants.ts` | Every number below. |
| `types.ts` | `Ensemble`, `EnsembleStatus`, `HeldTone`, `NoteEvent`, `ScheduledFrame`, `EnsembleOptions`. |
| `dropout.ts` | `dropoutTaps(seed)`: pure, seeded, no randomness from the browser. |
| `graph.ts` | `buildGraph(t, destinationContext)`: the master chain and the seven voices. Used live and offline. |
| `plan.ts` | `planFrame(frame, detail, mix)`: pure. Turns one `MusicFrame` into the list of voice actions, with no Tone in it. The golden test runs on this. |
| `voices.ts` | Applies the list from `planFrame` to the graph, one voice at a time. |
| `lifecycle.ts` | The status machine, `visibilitychange` and the context's `statechange`. |
| `index.ts` | `createEnsemble`. |
| `useEnsemble.ts` | React hook: create on mount, dispose on unmount, status by `useSyncExternalStore`. |

### Constants (`constants.ts`)

```ts
export const MASTER_LIMIT_DB = -1                       // the limiter's threshold: the peak stays at or below −1 dBFS
export const COMPRESSOR = { threshold: -18, ratio: 3, attack: 0.01, release: 0.25 }   // as engine.ts
export const VOLUME_RAMP_S = 0.05
export const PARAM_RAMP_S = 0.1                         // level, pan, filter, detail, mute, solo
export const GLIDE_S = 0.12                             // melody portamento
export const STOP_FADE_S = 0.05
export const PAUSE_FADE_S = 0.2
export const RESUME_FADE_S = 0.2
export const RELEASE_S = 0.1                            // a note's release when a voice goes quiet
export const INTERACTIVE_LOOKAHEAD_S = 0.02             // default atTime for apply() and hold(): now + 20 ms
export const SCHEDULE_LOOKAHEAD_S = 0.1                 // for frames scheduled ahead by the caller
export const MIN_APPLY_GAP_S = 0.05                     // at most 20 frames a second are sounded; a faster caller is held back
export const MAX_HOTSPOT_VOICES = 3                     // slots in the hot-spot voice (SN03 MAX_HOTSPOT_NOTES)
export const HARMONY_POLYPHONY = 4
export const SCAN_VOICES = 8                            // notes that playNotes can sound at once
export const VOICE_GAIN_DB: Record<VoiceId, number> = {
  melody: -6, harmony: -14, bass: -10, hotspots: -12, rhythm: -16, motion: -20, time: -22,
}
export const DROPOUT_GAIN_DB = -14
export const DROPOUT_SEED = 20261109
export const DROPOUT_SPACING_S = 0.12                   // the two taps
export const MAX_RENDER_S = 180                         // as engine.ts: over three minutes is refused
export const RENDER_TAIL_S = 1.5
export const MOTION_FILTER_HZ = { low: 300, high: 3000 }
export const HOLD_FILTER_HZ = { low: 400, high: 3400 }  // driven by brightness (0 to 1)
```

### Types (`types.ts`)

```ts
export type EnsembleStatus = 'off' | 'on' | 'paused' | 'suspended'

/** A continuous tone for interactive use (explore, SN09). midi is a whole or fractional note; pan and elevation −1 to +1; level and brightness 0 to 1. */
export type HeldTone = { midi: number; level: number; pan: number; elevation?: number; brightness: number }

/** One note of a scan column or a probe (SN08). `seconds` is how long it sounds. */
export type NoteEvent = { midi: number; level: number; pan: number; elevation?: number; brightness?: number; seconds: number }

export type ScheduledFrame = { frame: MusicFrame; atSeconds: number }

export type EnsembleOptions = { detail?: DetailLevel; volume?: number; spatial?: SpatialMode }

export type Ensemble = {
  /** Call from a click or key press only (WCAG 1.4.2). Starts the audio context and resumes it if the browser suspended it. */
  start(): Promise<void>
  /** Silences every voice with a short fade and stops the transport. The next start() begins again. */
  stop(): void
  /** Fades the master to silence over PAUSE_FADE_S, then pauses the transport. */
  pause(): void
  /** Fades back in from silence. Does not resume a context the browser suspended: that needs start(). */
  resume(): void
  /** One frame of music, for the voices the current detail level allows. `atTime` is an audio-clock time in seconds; default is now + INTERACTIVE_LOOKAHEAD_S. Never queues: each call sets the voices for its own time. */
  apply(frame: MusicFrame, atTime?: number): void
  /** A continuous tone for explore (SN09). A new midi glides from the last one over GLIDE_S (portamento). `null` releases it. Not a mixer voice: detail, solo and mute do not apply to it. */
  hold(tone: HeldTone | null, atTime?: number): void
  /** Sounds notes at once through the scan bank (SN08): up to SCAN_VOICES at a time, the rest are dropped. */
  playNotes(notes: NoteEvent[], atTime?: number): void
  /** The seeded dropout cue, once. `apply` calls it itself when a frame's `dropout` goes from false to true. */
  playDropout(atTime?: number): void
  /** Only this voice sounds, or `null` for all the voices the detail level allows. */
  solo(voice: VoiceId | null): void
  mute(voice: VoiceId, muted: boolean): void
  /** Calm, standard or full (SN03 `DETAIL_VOICES`). A voice outside the level fades out and is not triggered. */
  setDetail(level: DetailLevel): void
  /** 0 to 1 (clamped). Ramps over VOLUME_RAMP_S. */
  setVolume(zeroToOne: number): void
  status(): EnsembleStatus
  /** The audio clock in seconds (the raw context's currentTime), or 0 before start(). Scan and explore line the picture up with the sound through it. */
  now(): number
  onStatus(listener: (status: EnsembleStatus) => void): () => void
  /** Releases every voice, removes the listeners and disposes the nodes. Calls after this do nothing. */
  dispose(): void
  /** Renders the schedule through the same graph, faster than real time. Returns the left and right channels. Never plays. */
  renderOffline(schedule: ScheduledFrame[], options: { detail: DetailLevel; sampleRate?: number; tailSeconds?: number }): Promise<[Float32Array, Float32Array]>
}
```
`createEnsemble(preset: Preset, options?: EnsembleOptions): Ensemble` (in `index.ts`). `useEnsemble(preset, detail)` returns `{ ensemble, status, start }`.

### The graph (`graph.ts`)

```
voice gains (7 voices, + hold, + scan bank, + dropout)
   → voice panner (createPanner from src/audio/pan.ts, stereo by default)
   → sum bus → Compressor (COMPRESSOR) → Limiter (MASTER_LIMIT_DB) → master gain → destination
```
- Voices: `melody` (triangle, mallet envelope, portamento for glide), `harmony` (PolySynth of sines, up to `HARMONY_POLYPHONY`), `bass` (triangle, one octave below the harmony range), `hotspots` (`MAX_HOTSPOT_VOICES` slots, each its own Synth → lowpass at the preset's brightness → its own panner, so each spot has its own place), `rhythm` (short triangle plucks), `motion` (sawtooth pad → lowpass whose cutoff goes from `MOTION_FILTER_HZ.low` to `high` with `openness`; the pan follows `sweep`), `time` (a sine click on the transport each beat).
- The graph is built the same way on the live context and inside `Tone.Offline`. Do not create a `NoiseSynth`, a `Reverb` (it builds its impulse from random noise) or anything that uses `Math.random`. A `Freeverb` is allowed (it is deterministic), with a wet level of 0.15 on the melody and harmony.
- Every change of level, pan and cutoff uses `rampTo` or `linearRampToValueAtTime` over `PARAM_RAMP_S`, never a jump. Note start and stop times are the audio times the caller gives.

### The plan (`plan.ts`, pure)

```ts
export type VoiceAction = {
  voice: VoiceId
  /** For 'hotspots', the slot 0 to MAX_HOTSPOT_VOICES − 1; otherwise 0. */
  slot: number
  /** false: the voice is silent for this frame (not allowed by the detail level, muted, not soloed, or missing or null in the frame). */
  sounding: boolean
  midis: number[]
  level: number          // 0 to 1, the target after the mix (detail, mute and solo already applied)
  pan: number            // −1 to +1
  elevation: number      // −1 to +1
  glide: boolean
  brightness: number     // 0 to 1
}
export function planFrame(frame: MusicFrame, detail: DetailLevel, mix: { solo: VoiceId | null; muted: ReadonlySet<VoiceId> }): VoiceAction[]
```
One action per voice slot, in `VOICE_IDS` order, with the hot-spot slots after the hot-spot voice. `planFrame` is the only place that decides what sounds; `voices.ts` only sends its result to Tone. Its output is what the golden test records.

### Frame rules (`voices.ts`, `apply`)

1. `apply` is ignored unless the status is `on`. Before `start()` nothing sounds.
2. The frame is clamped to the rate limit: a call whose `atTime` is less than `MIN_APPLY_GAP_S` after the last accepted one is dropped, unless it is a dropout onset (never dropped).
3. Each voice the detail level allows, and is not muted, is set from the frame: `melody` triggers on a new midi and slides when `glide` is true, or releases when `null`; `harmony` releases and re-triggers only when its notes change, otherwise only its level ramps; `bass`; `hotspots` by slot (slot `i` takes `hotspots[i]` and releases when there is none), with pan and elevation through `aimPanner`; `rhythm` cancels the notes it scheduled before (keep the ids of `Transport.schedule` and clear them) and schedules `perBeat × 2` notes over the next two beats, cycling through `midis`; `motion` ramps its cutoff, pan and level; `time` sets the pulse (`Transport.scheduleRepeat` at `60 / pulseBpm`, re-set only when the tempo changes) and the accent (`month`: +3 dB; `year`: up an octave, +3 dB).
4. A voice whose frame target is `null` or that is missing releases, and makes no sound. A missing voice is silent, never a noise.
5. `frame.dropout` going from `false` to `true` calls `playDropout(atTime)`. It does not repeat while the frame stays dropped.

### Dropout (`dropout.ts`)

`dropoutTaps(seed: number): { offsetS: number; midi: number; level: number }[]`: exactly two taps, at `0` and `DROPOUT_SPACING_S`. The midi and the level come from a seeded generator (mulberry32 with `seed`, a tiny pure function written in the file) choosing from fixed lists (for example midi 60 or 64, level 0.8 to 1). The same seed gives the same taps. The taps are played by two `Synth` sines at `DROPOUT_GAIN_DB`. There is no noise.

### Lifecycle (`lifecycle.ts`)

- **start()**: in the click or key handler, `await import('tone')`, `await Tone.start()`, then build the graph (once). If the raw context's state is not `running` after that, status is `suspended`; otherwise `on`. The master fades in over `RESUME_FADE_S`.
- **suspended**: when the browser suspends the context (`statechange` on the raw context), status becomes `suspended` and the UI must show "Turn sound on". Only `start()` (from a click) resumes it. Never resume on a timer or on focus.
- **stop()**: releases every voice, fades the master to 0 over `STOP_FADE_S`, stops and clears the transport. Status `off`. The next `start()` fades back in.
- **pause()** / **resume()**: `pause` fades the master to 0 over `PAUSE_FADE_S`, then `Transport.pause()`, status `paused`. `resume` (only from `paused`) restarts the transport and fades in over `RESUME_FADE_S`, status `on`.
- **visibilitychange**: when `document.hidden` becomes true and the status is `on`, call `pause()` and remember that the page paused it. When the page is visible again, do **not** resume: status is `paused` (or `suspended` if the context was suspended). The listener presses Play.
- **onStatus** listeners are called on every change. `useEnsemble` reads the status with `useSyncExternalStore`, not with `setState` in an effect (`frontend.md`).
- **dispose()**: remove the `visibilitychange` and `statechange` listeners, release and dispose every node, status `off`. Further calls do nothing.

### Offline (`renderOffline`)

Builds the same graph inside `Tone.Offline` at `sampleRate` (default 44 100), stereo, and calls `apply(frame, atSeconds)` for each scheduled frame in order. The duration is the last `atSeconds` plus `tailSeconds`, and a duration above `MAX_RENDER_S` is refused with the message "That is too long to render (over 3 minutes)." It never calls `start()` and never touches the live status. The same schedule and detail give the same samples.

## Reuse

- `createPanner`, `aimPanner`, `SpatialMode` (`src/audio/pan.ts`). Use them for every panner; do not write a new one.
- `COMPRESSOR`, `MASTER_LIMIT_DB` values as in `src/audio/engine.ts` (`COMPRESSOR`, `LIMITER_DB`). Copy the numbers into `constants.ts`, do not import from `engine.ts`.
- `encodeWav` is **not** used here: SN12 writes the WAV from the channels this ticket returns.
- `MusicFrame`, `Preset`, `DETAIL_VOICES`, `voicesFor` (`src/sonify/`, SN03). `VOICE_IDS`, `VoiceId`, `DetailLevel` (`src/data/sonification.ts`, SN05).
- `installFakeAudioContext` (`src/test/fakes.ts`) for the raw context's state and `statechange`.
- `src/audio/engine.test.ts`'s recording Tone mock (`vi.hoisted`) as the pattern for the Tone tests.

## Touches

- New: `src/audio/ensemble/**` (all files listed above), with tests.
- Do not edit `src/audio/engine.ts`, `src/audio/index.ts`, `src/audio/pan.ts` or any file outside `src/audio/ensemble/`. A shared helper that belongs in `pan.ts` goes on `docs/AGENT-BOARD.md` first.

## Steps

1. Write `constants.ts`, `types.ts`, `dropout.ts` (with its seed test) first.
2. Write `graph.ts` and check that it builds the same nodes on a live context and an offline one (a test with the recording mock).
3. Write `voices.ts`: one voice at a time, each with its test. Start with `melody`, then `harmony`, `bass`, `hotspots`, `rhythm`, `motion`, `time`, then the dropout onset.
4. Write `lifecycle.ts` and `index.ts` (`createEnsemble`, `start`, `stop`, `pause`, `resume`, `apply`, `hold`, `playNotes`, `playDropout`, `solo`, `mute`, `setDetail`, `setVolume`, `dispose`, `renderOffline`).
5. Write `useEnsemble.ts` and its test (mount, unmount disposes, the status updates).
6. Run the checks. Record the Result, including the measured peak of an offline render of a loud test frame: write the schedule to a WAV in a test-only script, then run the command under Checks.

## Tests

Use a recording Tone mock (as `src/audio/engine.test.ts` does) and `installFakeAudioContext`. No real audio is made in jsdom.

- **Limiter and order.** The graph is built with a `Compressor` and then a `Limiter` with threshold −1 dB, and the limiter is the last node before the master. (The measured peak is the manual check in Checks.)
- **No sound before start.** `apply`, `hold`, `playNotes` and `playDropout` before `start()` create no Tone node and no note.
- **Lifecycle.** `start` with a running context gives `on`; with a suspended one gives `suspended`. `pause` fades before the transport pauses. `resume` from `suspended` does nothing. `stop` releases every voice.
- **Visibility.** `document.hidden` set to true while `on` pauses; setting it back to visible does not resume (status `paused`).
- **Context suspended.** A `statechange` to `suspended` while `on` gives `suspended`.
- **Detail, solo, mute.** `setDetail('calm')` never triggers `bass`, `hotspots`, `rhythm`, `motion`; `solo('melody')` silences the others; `mute` on a voice releases it.
- **Frame rules.** A melody frame triggers the melody at its midi; `glide` sets portamento to `GLIDE_S`; a `null` melody releases; a missing voice makes no sound; a harmony with the same notes does not re-trigger.
- **Rate limit.** Two `apply` calls 10 ms apart: the second is dropped; a dropout onset inside the gap is not.
- **Never queues.** Ten `apply` calls in a row set the voices for their own times; none is replayed later.
- **Interactive default.** `apply(frame)` with no `atTime` schedules at `now + INTERACTIVE_LOOKAHEAD_S`, which is 50 ms or less from now.
- **Dropout.** `dropoutTaps(DROPOUT_SEED)` gives the same two taps every time; a different seed gives different taps; the cue plays once per onset.
- **Offline.** `renderOffline` refuses a schedule longer than `MAX_RENDER_S`; the same schedule gives identical channels twice (the recording mock returns a deterministic buffer for the test).
- **dispose.** After `dispose`, `apply`, `start` and `stop` do nothing; listeners are removed.
- **Plan.** `planFrame` on hand-made frames: `calm` never plans `bass`, `hotspots`, `rhythm`, `motion`; `solo` leaves one voice sounding; a muted voice is silent; a missing voice is silent and not triggered; the hot-spot slots are in order and at most three.
- **Golden.** `src/audio/ensemble/plan.golden.test.ts`: for the fixture, `synthetic-ocean`, `synthetic-globe` and `synthetic-change`, the `MusicFrame`s of the first twelve frames (from SN03's `toMusicFrame`, after SN01 is on `main`) are planned at `full` and at `calm`, and the plans are recorded in `src/audio/ensemble/__golden__/plan.json`. Run `npx vitest run -u` once, then read the diff.

Manual check (Result must show it): `npm run dev`, a test page that calls `renderOffline` on a loud frame (all voices at level 1), then:

```bash
python3 -c "import wave,array,math,sys; w=wave.open(sys.argv[1]); a=array.array('h',w.readframes(w.getnframes())); p=max(abs(x) for x in a)/32768; print('peak dBFS', round(20*math.log10(p),2) if p>0 else 'silent')" file.wav
```
The printed peak must be −1.00 dBFS or lower.

## Guardrails

- No sound before a click or key press (WCAG 1.4.2): `start()` is the only place that creates the audio context, and the tests check it.
- The peak stays at or below −1 dBFS in every style: the limiter is the last stage before the destination.
- Nothing flashes; there is no visual here.
- Every voice has a text equivalent through `MusicFrame.caption` (SN03); this ticket adds none of its own words.
- Same input, same output: no `Math.random`, no `Date.now()`, no noise. The dropout is seeded.
- No model, no network, no import of `src/assistant/` or `src/config`.
- Under `prefers-reduced-motion` nothing changes here (it is audio). Visual changes belong to SN07.

## Done when

- `createEnsemble` implements every method of the `Ensemble` type above, with the tests passing.
- The lifecycle works as above and is covered by tests (start, suspend, visibility, stop, dispose).
- The offline render gives identical channels twice, and the manual peak check reads −1.00 dBFS or lower.
- `npm run lint && npm test && npm run build` pass with their real output in Result.

## Checks

```bash
npm run lint && npm test && npm run build
```

Plus the manual peak check above, with its real output under Result.

## Out of scope

- The Listen page and the mode switch (SN07), the scan (SN08), explore (SN09), the WAV file and the playlist (SN12), ducking under the guide (SN13).
- Changing the old engine (`src/audio/engine.ts`). It stays as the Simple mode.
- Spatial audio beyond what `createPanner` already does (the 3D mode uses it as it is).

## Result

Not started.
