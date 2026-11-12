# G09 Jukebox player: play the orchestrator's AudioPayload with Tone.js

| | |
|---|---|
| **Priority** | P1 |
| **Size** | S (under half a day) |
| **Who** | agent |
| **Needs** | G08 |
| **Hotspots** | — |
| **Branch** | `feature/G09-jukebox-player` |

## Goal

A React component, `JukeboxPlayer`, takes the `audio` object that `POST /api/v1/jukebox/generate` returns and plays it with Tone.js behind one Play/Stop button, so the team can hear what the orchestrator wrote.

## Why

G08 returns checked sound parameters (`server/app/agent/orchestrator.py`, `AudioPayload`), and nothing in the browser reads them: no file under `src/` calls the route or knows the payload's shape. Until something plays the payload, nobody can judge by ear whether the Synthesizer's output is any good.

## Design

The payload, as the server checks it:

```ts
type AudioPayload = {
  base_bpm: number                    // 20 to 300
  tracks: {
    instrument: string
    pitch_range: [number, number]     // two MIDI notes, lowest first
    volume_curve: number[]            // each 0 to 1
  }[]
}
```

Playback:

- **Tempo:** `base_bpm` sets the Transport's tempo. Each value of `volume_curve` is one step, an eighth note long.
- **Volume:** each track has one `Tone.Synth` and one `Tone.Sequence` over its `volume_curve`. At each step the sequence sets the synth's volume from the value (0 to 1 as gain, in decibels) and plays a note. A value of 0 is a rest.
- **Pitch:** `pitch_range` gives the lowest and highest MIDI note. The payload has no pitch curve, so pitch follows volume: the quietest sounding value of the track plays the lowest note (a rest does not count), the loudest plays the highest, and the notes between are spread evenly. A flat curve plays the middle note. MIDI becomes frequency with `440 × 2^((midi − 69) / 12)`.
- **Level:** every synth goes through one limiter at −1 dBFS, and each track's gain is divided by the number of tracks.
- **End:** playback stops by itself one step after the longest track's last step.
- `instrument` is shown as text and does not choose a sound yet: every track is a `Tone.Synth`.

The payload is model output, so the browser checks it again with zod before playing (`parseAudioPayload`): the server's limits, and also at most 16 tracks and 4096 steps a track, which the server does not cap.

The component is not on any page yet: `src/App.tsx` is a hotspot held by another ticket. To hear it, a page that only the dev server serves, `jukebox.html`, shows a text box for the JSON and the player. The production build does not include it.

## Reuse

- `Button`, `Notice`, `useAnnounce` from `src/components`.
- Tone is loaded on demand with `import('tone')`, as `src/audio/engine.ts:397` does, so the first load stays small.
- `src/audio/ensemble/toneMock.ts` shows how the tests stand in for Tone.

## Touches

- `src/features/jukebox/` (new): `JukeboxPlayer.tsx`, `payload.ts`, `jukebox.css`, their tests, `DevPage.tsx`, `dev.tsx`
- `jukebox.html` (new, dev server only)
- `docs/tickets/G09-jukebox-player.md`, `docs/TICKETS.md` (own row), `docs/PRE-HACKATHON-WORK.md` (after the merge)

## Steps

1. `payload.ts`: the zod schema, `parseAudioPayload`, `midiToFrequency`, and `trackSteps` (one `{ frequency, gain }` or rest for each value).
2. `JukeboxPlayer.tsx`: the button, the Tone graph built on the first Play, the sequences, stop and clean-up on unmount.
3. Tests for both.
4. `jukebox.html` and `dev.tsx`.

## Tests

- `payload.test.ts`: the schema refuses what the server refuses; `midiToFrequency(69)` is 440; the quietest step gets the lowest note and the loudest the highest; a flat curve gets the middle note; 0 is a rest.
- `JukeboxPlayer.test.tsx`, with Tone mocked: nothing is built or played before the click; Play sets the tempo, builds one synth and one sequence per track and starts the Transport; a step sets the volume and plays the right frequency; Stop stops and the button reads Play again; unmounting disposes; no accessibility violations.

## Guardrails

- The same payload always gives the same notes.
- The peak stays at or below −1 dBFS (the limiter). No sound before a click or key press.
- The button's name says what it will do, and "Playing" and "Stopped" are announced through `useAnnounce`.
- Nothing specific to one data set in `src/`.

## Done when

- Pasting the route's `audio` object into `http://localhost:5173/jukebox.html` and pressing Play plays it, and Stop silences it.
- The checks pass.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- Calling the route from the browser, and showing the `vision` descriptions.
- Putting the player on a page of the app (needs `src/App.tsx`, `src/pages.ts` and the server's page list).
- A different sound for each `instrument`.
- Sharing the Transport with the app's own player: both use Tone's one Transport, so they must not play at the same time. This has to be settled before the player goes on a page.

## Result

Branch `feature/G09-jukebox-player`.

```
$ npm run lint
lint exit 0 (no warnings)

$ npm test
 Test Files  126 passed (126)
      Tests  2104 passed (2104)

$ npm run build
✓ built in 529ms
build exit 0   (dist/ holds no jukebox file: the dev page is not in the build)
```

One earlier full run had 1 failed test out of 2103; its name was not captured, and three later full runs and five runs of this ticket's tests all passed.

**In a browser** (Chrome, `http://localhost:5199/jukebox.html`, the sample payload: 2 tracks, 16 steps, 120 beats a minute, with the real Tone.js 15.1.22): Play turned to Stop and "Playing" was announced; playback ended by itself after about 4 seconds, with "Finished"; a second Play and a Stop both worked; the console showed no error or warning. This checks the controls and the scheduling. Nobody has listened to it yet: the check was automated and cannot hear.

Two things the browser check changed:

- Stopping the Transport from inside its own callback made Tone warn about timing. The end now runs from a timer set for the time the callback was for.
- Tone's Draw was tried for that and dropped: it waits for the page to be painted, so in a background tab playback never ended.

Known limits, as under Out of scope: the player is on no page of the app, `instrument` does not choose a sound, and it must not play at the same time as the app's own player.
