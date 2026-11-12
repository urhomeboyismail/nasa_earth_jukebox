# JB03 Audio-reactive chest: EQ bars and mini globe from the playing sound

| | |
|---|---|
| **Priority** | P2 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | JB01 |
| **Hotspots** | — |
| **Branch** | `feature/JB03-audio-chest` |

## Goal

While a data set's sonification plays, the equalizer bars on Echo's chest screen move with the real sound (Web Audio `AnalyserNode`), and the mini globe turns faster when the sound is louder. When nothing plays, the chest rests. Nothing here makes sound.

## Why

- There is no analyser anywhere in the app: no `createAnalyser` or `getByteFrequencyData` in `src/`. Engines are per page (`src/features/player/usePlayer.ts:85`, `src/features/welcome/Welcome.tsx:49`), and each builds its own master gain (`src/audio/engine.ts:150`). So the one place every sound passes through is Tone's shared destination.
- `src/audio/engine.ts` is the `engine` hotspot, and SN04 (claimed) is rebuilding the master bus. Tapping `Tone.getDestination()` from a new file avoids both.
- Tone is loaded lazily in `unlock()` (`src/audio/engine.ts:390`), after a user gesture. The tap must never load Tone or start a context by itself (WCAG 1.4.2: no sound before a click).
- F58 gives `Echo` the `levels` and `globeSpin` props; JB01 docks Echo and knows when the player is `playing` (`src/features/player/index.tsx:138` on the context bus).
- `installFakeAudioContext` in `src/test/fakes.ts` has no `createAnalyser`.

## Design

`src/audio/levels.ts` (new):

```ts
export const LEVEL_BANDS = 5
export function attachLevels(tone: typeof import('tone')): void   // idempotent: one AnalyserNode (fftSize 256) on tone.getContext(), fed from tone.getDestination()
export function getLevels(out: Uint8Array): boolean               // false until attached; else fills `out` (length LEVEL_BANDS) with band averages 0–255
export function getLoudness(): number                             // 0–1 RMS of the time-domain data; 0 until attached
export function detachLevels(): void
export function bandsFrom(freq: Uint8Array, bands: number): Uint8Array   // pure: log-spaced band averages
```

- `attachLevels` is called by whoever already has Tone: add one call in `unlock()` after Tone loads. If that touches `engine.ts`, post on the board for the `engine` hotspot holder instead. Alternatively, `src/features/mascot/useLevels.ts` calls `import('tone')` **only after** the player context reports `playing`, which means Tone is already loaded and the import is a cache hit. **Use this second way**, so this ticket stays out of `engine.ts`.
- The analyser only listens: it is connected from the destination and connected to nothing.

`src/features/mascot/useLevels.ts` (new):

```ts
export function useLevels(active: boolean): { levels: Uint8Array | null; loudness: number }
```

- While `active` (the player is playing and the dock is shown and the document is visible), one requestAnimationFrame loop reads `getLevels` and `getLoudness`, throttled to 30 updates a second. Otherwise there is no loop, and it returns `null` and `0`.
- Under reduced motion it reads once a second, so the bars still show the sound's shape as a slowly changing picture, not an animation.
- `MascotDock` passes `levels` and `globeSpin = loudness` to `Echo`.

## Reuse

- `Echo`'s `levels` and `globeSpin` props (F58); `MascotDock` and its `playing` subscription (JB01).
- `installFakeAudioContext` in `src/test/fakes.ts`: extend it, don't write a second fake.

## Touches

- `src/audio/levels.ts` and `src/audio/levels.test.ts` (new).
- `src/features/mascot/useLevels.ts` and `useLevels.test.ts` (new); `src/features/mascot/MascotDock.tsx` (pass the props).
- `src/test/fakes.ts`: add `createAnalyser` (with `fftSize`, `frequencyBinCount`, `getByteFrequencyData`, `getByteTimeDomainData`, `connect`, `disconnect`).
- `docs/PRE-HACKATHON-WORK.md`: one line.

## Steps

1. Write `bandsFrom` and its test.
2. Write `levels.ts` against a fake Tone object (`getContext().createAnalyser()`, `getDestination().connect()`).
3. Extend `fakes.ts`.
4. Write `useLevels` and wire it into the dock.
5. Run the checks. In the browser, play a data set on Listen and watch the chest follow the sound.

## Tests

- `bandsFrom`: known input gives known averages; the length is always `bands`.
- `levels.ts`: `getLevels` returns false before `attachLevels`; `attachLevels` twice makes one analyser; the analyser is connected from the destination and not to it; `detachLevels` disconnects.
- `useLevels`: with `active` false there is no requestAnimationFrame and no `import('tone')`; with `active` true it updates; it stops when `active` turns false.
- `MascotDock.test.tsx` keeps passing; `await expectNoA11yViolations(container)`.

## Guardrails

- No sound before a click or key press: this ticket never creates, resumes or loads an audio context, and only reads what is already playing (WCAG 1.4.2).
- Nothing flashes more than 3 times a second. The bars change height, not brightness. Under reduced motion they update at most once a second.
- No announcement: the sound itself and SN10's text equivalents already say what is playing.
- No change to the sound: the analyser is a listener only, and the output is byte-identical.

## Done when

- The chest bars and globe follow the real sound while a data set plays, and rest otherwise.
- No audio context is created by the mascot. The checks pass.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- The voice guide's speech driving the chest (its audio is not on Tone's destination). A follow-up can reuse `level` from `useVoiceAssistant`.
- Changing `engine.ts` or SN04's master bus.

## Result

Done on `feature/JB03-audio-chest`.

- `src/audio/levels.ts` (new): `bandsFrom`, `attachLevels`, `getLevels`, `getLoudness`, `detachLevels`. One `AnalyserNode` (fftSize 256) fed from Tone's destination and connected to nothing. It never creates, resumes or loads a context. `attachLevels` is generic over the analyser type so the real Tone module and a test fake both fit without a cast.
- `src/features/mascot/useLevels.ts` (new): while `active`, one `requestAnimationFrame` loop throttled to 30 updates a second; under reduced motion one read a second and no frame loop. Not active: no loop, no `import('tone')`, no analyser. Cleanup cancels the loop and detaches the analyser.
- `MascotDock.tsx`: `active` is "Echo is shown, the voice panel is closed, the player is playing and the tab is visible"; passes `levels` and `globeSpin` (the loudness) to `Echo`.
- `src/test/fakes.ts`: `FakeAnalyserNode` and `createAnalyser` on `FakeAudioContext`.
- **Differs from the ticket:** `LEVEL_BANDS` is 4, not 5, because Echo's chest draws four bars (`RESTING_LEVELS` in `src/components/mascotTypes.ts`).
- `engine.ts` is untouched; the analyser is attached from the mascot after the player reports `playing`.
- **Not done:** step 5, watching the chest follow a real data set in a browser. This session has no audio output; a person should check it once.

```
npx vitest run src/features/mascot src/audio/levels -> 6 files, 55 tests passed
npx tsc -b      -> no errors
npm run lint    -> no errors
npm test        -> 122 files, 2016 tests passed
npm run build   -> built in 852ms
```
