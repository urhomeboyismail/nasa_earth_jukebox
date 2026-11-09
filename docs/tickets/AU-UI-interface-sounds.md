# AU-UI Interface sounds, quiet and behind a switch

| | |
|---|---|
| **Priority** | P2 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | SN04, H03 |
| **Hotspots** | player, compare, voice |
| **Branch** | `feature/AU-UI-interface-sounds` |

**Blocked until H03 is done.** H03 is a practice listening test with a blind or low-vision tester (a person's task, P3). The listening test hears these cues first; its notes decide the default of the switch and whether any cue changes. Do not claim this ticket before then.


## Goal

Short interface sounds for the start and end of a sequence, Compare's A and B, an error, a success, and the voice guide starting and stopping its listening. They are quiet, not noise, outside the data's pitch range, never louder than the melody, behind an "Interface sounds" switch, and each one has a text equivalent.

## Why

- `docs/SOUND_MAPPINGS.md` §5 (lines 95-104) asks for start and end chimes and Compare's A and B earcon. None exists: there are no earcons anywhere in the code.
- The start of a sequence is silent today, so a listener cannot tell that playback began unless they look.
- Compare plays A and then B with nothing to separate them (`src/features/compare/index.tsx:130-150`).
- The guide's listening state is silent. `src/assistant/ducking.ts` pauses the music when the guide listens, and nothing says so.

**A conflict to resolve, not to copy.** `docs/SOUND_MAPPINGS.md:100` says missing data is "a short filtered noise burst". PLAN §6.3 bans noise textures and makes missing data a seeded dropout. This ticket follows PLAN §6.3 and the interface cues are not noise. The SOUND_MAPPINGS line must be updated by its owner (see the report); do not edit it here.

## Design

**The cues** (`src/audio/interfaceCues.ts`, team leader's folder). Each cue is a list of SN04 `NoteEvent`s (the input of `playNotes`), so it is played by the same engine and rendered by the same offline path (SN12). The text is the one a listener reads or hears from the screen reader.

| Id | When | Sound | Text equivalent |
|---|---|---|---|
| `start` | a sequence starts (Listen, play, or a story chapter) | rising two-note figure, 2 × 180 ms | "Playback started." (shown in the player's status line) |
| `end` | a sequence ends | falling two-note figure, 2 × 180 ms | "Playback finished." (shown in the status line) |
| `compare-a` | Compare plays date A | one soft note, panned left | "Date A." |
| `compare-b` | Compare plays date B | two soft notes, panned right | "Date B." |
| `error` | an action fails (a file, the data, the microphone) | a tritone, falling, 2 × 220 ms | the visible error text, announced once with `useAnnounce` |
| `success` | a save, a copy, a link made | rising three-note figure, 3 × 90 ms | the visible text, announced once with `useAnnounce` |
| `guide-on` | the voice guide starts listening | a short note up, 60 ms | "Echo is listening." |
| `guide-off` | the voice guide stops listening | a short note down, 60 ms | "Echo has stopped listening." |

**Register and level.**
- Pitch: every cue note is at least a fourth above the highest note of the active mapping's data range, and no higher than 1,200 Hz. The data range is computed from SN03's constants: its top is the highest of `MELODY_LOW_MIDI + MELODY_SPAN`, `HOTSPOT_LOW_MIDI + HOTSPOT_SPAN` and `RHYTHM_LOW_MIDI + RHYTHM_SPAN`. The test checks it. If a data set's range leaves no room, the cues go below the range instead, and the test says which.
- No cue note equals a data note.
- Timbre: whatever SN04's `playNotes` gives, which must be a tone with a fast attack and a short decay, not noise and not a click. SN04 has no bell voice; if its timbre is not suitable, post on the board before the cues are tuned.
- Peak: each cue's level is at most `LEVEL.melody / 4` (SN03's constant, −12 dB below the melody), and each cue peaks at or below the melody's peak and at or below −1 dBFS.
- Length: 60 to 400 ms per cue.

**The switch.** A "Interface sounds" button with `aria-pressed` on the Listen settings row and on Compare. It is stored under `earth-jukebox:interface-sounds` (zod). The default is the constant `INTERFACE_SOUNDS_DEFAULT`, set from the H03 notes (on if the testers found the cues helpful, off otherwise). When off, no cue plays and nothing else changes.

**Help text.** The switch's help is a `<dl>` listing each cue and its text equivalent, so every sound has words (a term and a description for each).

**Wiring.**
- `start` and `end`: the player's playback (`src/features/player/usePlayer.ts`, Mohammad). Only on a real change of state, not on every date.
- `compare-a` and `compare-b`: the Compare page before it plays each date (`compare/index.tsx:130-150`).
- `error` and `success`: where the visible message is already shown; no new messages.
- `guide-on` and `guide-off`: on each change of the guide's listening state in `src/assistant/ducking.ts` (`useDucking(status)`).
- No cue plays while the guide is speaking (SN13 handles ducking; this ticket checks the same flag).

**Not announced.** The cues themselves are not spoken: the text is the visible line or the cue's help. Only `error` and `success` are announced, once, because those results need words.

## Reuse

- SN04's `playNotes` and the offline render (SN12), named in their ticket files.
- `src/audio/` `createSoundEngine` (for the switch's test only; the cues go through the same engine as the music).
- `src/components/useAnnounce.ts`, `src/components/Button.tsx`, `Notice.tsx`.
- `src/assistant/ducking.ts` (`useDucking`) and its test.

## Touches

- `src/audio/interfaceCues.ts` and `interfaceCues.test.ts` (new).
- `src/features/player/usePlayer.ts`, `index.tsx` and `player.test.tsx`: the start and end cues, and the switch.
- `src/features/compare/index.tsx` and `compare.test.tsx`: the A and B cues and the switch.
- `src/assistant/ducking.ts` and `ducking.test.tsx`: the guide's cues.
- `src/components/` (the switch and its help `<dl>`) and `components.test.tsx`.
- `src/features/player/player.css` only if the help needs a class.

## Steps

1. Write `interfaceCues.ts` as data (the steps for each cue) and a function that returns the steps. No Tone code here.
2. Render every cue offline through SN12 in a test, and measure its peak and length; check the pitches against SN03's data range.
3. Write the switch component and its store (zod), with the default constant.
4. Wire the start and end cues into the player on a real state change.
5. Wire Compare's A and B cues.
6. Wire the guide's cues in `ducking.ts`.
7. Write the help `<dl>` with every cue's text.

## Tests

- `interfaceCues.test.ts`: every cue has a text equivalent; the lengths are between 60 and 400 ms; no cue note equals a data note; every cue is at least a fourth above the data range's top and at most 1,200 Hz (or the stated alternative).
- Offline render (SN12) of each cue: the peak is at or below the melody's peak and at or below −1 dBFS; a second render is byte-identical.
- Fake engine tests: the switch off means no cue call; on means the cue call; `start` and `end` fire once per change of state, not per date.
- Compare: A's cue is played with pan −1 and B's with +1, before each date.
- Ducking: `guide-on` on the transition to listening, `guide-off` on the transition away; none while speaking.
- `error` and `success`: the announcement is once (`liveText()`).
- `expectNoA11yViolations` on the switch and its help.

## Guardrails

- The same input gives the same cue samples (SN12's byte-identical output).
- Peak at or below −1 dBFS and at or below the melody's peak. No sound before a key press or click; the cues play only after the listener has started sound.
- Nothing flashes.
- Every cue has its text in the help and in the visible status or message.
- Changes are announced through `useAnnounce` only for `error` and `success`.
- No data-set name in `src/`. The register is computed from the mapping's range, not a fixed note.

The five principles, for this ticket:
1. A cue answers the event it marks, at once.
2. Sound first: the cue is the sound; words are the status line or the help.
3. The switch turns every cue off, and nothing else changes when it is off.
4. Cues come from the same engine on every page.
5. Learn by hearing: the help shows each sound's meaning.

## Done when

- H03's notes are recorded, and the default is set from them.
- Every cue plays behind the switch, at the stated peak and register, and has its text.
- Compare's A and B are separated by the cues, and the guide's listening state is heard.
- All tests pass and the checks are green.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- The "missing data" cue (it is SN04's seeded dropout, not an interface sound).
- Changing `docs/SOUND_MAPPINGS.md` (its owner updates the noise line).
- Speech for any cue.
- The threshold cue from `docs/SOUND_MAPPINGS.md` §5: SN04 has no bell voice, so it is a later question for the team.

## Result

Not started.
