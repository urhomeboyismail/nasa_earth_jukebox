# V02 Mic consent first, text-only mode, push-to-talk, session warning

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | app, voice |
| **Branch** | `feature/V02-mic-consent-text-only` |

## Goal

Nobody's microphone is asked for before they have chosen to use it. A listener can use the guide by typing only. The microphone is push-to-talk by default, and open-mic is an explicit choice that turns itself off after 60 seconds of silence. A denied microphone does not end the conversation. The listener is warned before the time limit. Starting the guide after a cold start says so. The microphone level no longer re-renders the whole app.

## Why

- `src/assistant/audio.ts:61` (`startRecorder`) calls `getUserMedia` straight from the "Start talking" click. The disclosure ("your voice ... is sent to Google's Gemini") is below the button (`src/VoiceAssistant.tsx`, the `voice-assistant__note` paragraph, about line 135), after the browser's prompt has already appeared.
- `src/hooks/useVoiceAssistant.ts:174` ends the whole session when the microphone is refused (`fail(micErrorMessage(cause))`). Typing needs a live session (`VoiceAssistant.tsx`, `canType`, about lines 35 and 118), so a listener who said no to the microphone cannot use the guide at all.
- The guide is open-mic: the recorder sends every frame above silence (`useVoiceAssistant.ts`, the `startRecorder` callback). A screen-reader user's speech and output can start a turn by accident. There is no push-to-talk.
- The session limit is 600 seconds (`server/app/config.py:37`). The client has no warning and cannot extend it. The browser is not told the limit at all.
- A Render free server takes up to a minute to wake (`AGENTS.md`, Deployment). The panel shows only "Connecting...".
- `src/hooks/useVoiceAssistant.ts:76,169` calls `setLevel` every 50 ms, which re-renders `App`, the whole page, about 20 times a second. The level is needed only by the meter in `VoiceAssistant.tsx`.

## Design

### Consent (new `src/assistant/consent.ts`)

- Stored choice in `localStorage` under `earth-jukebox:mic-consent`: `"mic"` (microphone allowed) or `"text"` (text only). Absent means not decided. Storage that is blocked or throws reads as "not decided" and writes nothing (the same rule as other stored settings in `src/audio/style.ts`).
- Before the first click that needs the microphone, when the choice is "not decided", the panel shows a **consent card** (a region with a heading "Use your microphone?"). It says, in plain words: Echo can hear you through your microphone; while the conversation is open, your voice and what you type are sent to Google's Gemini; the app saves none of it.
- Two buttons, **Allow microphone** and **Use text only**, with the same variant, size and order rules: neither is styled as the default. Pressing either stores the choice.
- A checkbox under them, **Keep the microphone open** (unchecked). Unchecked means push-to-talk. Checked means open mic, with the 60-second rule below. The checkbox's value is stored under `earth-jukebox:mic-talk` as `"push"` or `"open"`.
- **Revocable.** While a choice is stored, the panel shows a button **Change microphone choice**. It stops any running microphone, clears the stored choice, and shows the card again. An active text session keeps running.
- `getUserMedia` is called only after **Allow microphone** has been pressed. Test that it is not called before.

### Text-only sessions and a refused microphone (hook)

- "Use text only" starts a session with no recorder. The socket, the `start` message and typing work as today.
- A refused or missing microphone (`micErrorMessage`'s cases) no longer ends the session. The hook sets `micNote` to the plain text: "Echo cannot use the microphone. You can type your questions." (The other microphone text is the same ticket's job.) Status stays `listening`.
- The `ready` handling must not wait for the recorder to succeed. Today `ready` waits on `recorderReady` (`useVoiceAssistant.ts`, `case "ready"`). Change it so `ready` is accepted once the socket says ready, and the recorder result only sets the mic state.

### Push-to-talk and open mic

- **Push-to-talk (default).** The recorder runs, but frames are not sent. A **Talk** button (`aria-pressed`) starts sending frames; pressing it again stops. Stopping sends `{"type":"mic_off"}` (the server ends the audio stream, as today). The button name stays "Talk" in both states, and `aria-pressed` says which.
- **Open mic.** The button is "Mute microphone" as today (`toggleMute`). After 60 seconds with no sound above the existing `MIC_HEARD_LEVEL` threshold, the mic is muted, `mic_off` is sent, and the note says: "The microphone was turned off after 60 seconds with no speech. Press Mute microphone again to speak." Any speech resets the 60 seconds.
- The browser never sends audio frames while the mic is off or the listener is not talking. Frames that are not sent are not counted for the level meter either.

### Answer length

- A radio group **Answers**: **Short** and **Detailed**, default **Short**, stored under `earth-jukebox:answer-length`. It is sent in the `start` message as `"detail": "short"` or `"detailed"`. A change applies to the next conversation, and the panel says so.
- The server does not read `detail` yet. Post a request on `docs/AGENT-BOARD.md` to the server owner (G04 or G05): read `detail` in `start` and add one instruction line for each value. Until it merges, the server ignores the extra field, as it does today.

### Session warning and the limit

- The limit comes from the server's `ready` message, field `limitSeconds`. If the server does not send it yet, the client uses 600 seconds. Post a board request for the server to send it.
- At `limit − 60` seconds the panel shows a notice: "Echo will stop in 1 minute. Continue?" with a **Continue** button. Continue ends the current session and starts a new one at once (a click, so the microphone rule still holds). The transcript stays.
- The timer runs from the `ready` message.

### Waking Echo

- While the status is `connecting` for more than 3 seconds, the panel shows: "Waking Echo up, this can take a minute." It is a visible note, not a second announcement (V03 announces "Connecting" once).

### Level out of App state

- `useVoiceAssistant` stops calling `setLevel`. It writes the level to a ref, `levelRef`, which it returns.
- `VoiceAssistant.tsx` reads the ref in a `requestAnimationFrame` loop while the meter is shown, and sets the meter's `--level` custom property directly on its element. The loop stops when the meter is hidden or the panel closes. Under reduced motion the meter still updates, because it shows the listener's own sound level and is not an animation.
- The hook no longer returns `level`. `App.tsx` does not change.

## Reuse

- `src/assistant/audio.ts` (`startRecorder`, `frameLevel`, `SpeechPlayer`), `src/hooks/useVoiceAssistant.ts` (`toggleMute`, `micErrorMessage`, `MIC_HEARD_LEVEL`).
- `src/components` (`Button`, `Notice`, `IconButton`), the existing radio and checkbox patterns in `src/features/` (look for `type="radio"` and `type="checkbox"` before writing new ones).
- `src/test/fakes.ts` and the mocks in `src/hooks/useVoiceAssistant.test.ts` (how `startRecorder` and `WebSocket` are faked there).

## Touches

- `src/assistant/consent.ts` (new), `src/assistant/consent.test.ts` (new)
- `src/hooks/useVoiceAssistant.ts` (consent, text-only, push-to-talk, the 60-second rule, `detail`, `limitSeconds`, the waking flag, `levelRef`)
- `src/VoiceAssistant.tsx` (consent card, Talk, answer length, warning, waking note, meter loop)
- `src/hooks/useVoiceAssistant.test.ts`, `src/VoiceAssistant.test.tsx` (new cases)
- `src/assistant/` styles, using existing tokens only

Do not touch `App.tsx` (the `app` hotspot is listed for this ticket, but this ticket needs nothing there). Do not change the server.

## Steps

1. Read `useVoiceAssistant.ts` and `audio.ts` in full, and the existing tests' mocks.
2. Write `consent.ts` with its tests.
3. Hook: text-only, the refused-mic path, `ready` without the recorder, push-to-talk, the 60-second rule, `detail`, `limitSeconds`, the waking flag, `levelRef`.
4. Panel: the card, the buttons, Talk, the answer group, the warning, the waking note, the meter loop.
5. Board requests for `detail` and `limitSeconds`.
6. Tests (below). Run the checks.

## Tests

Vitest and Testing Library. Find things by role and name, use `userEvent`, stub `navigator.mediaDevices.getUserMedia` with `vi.fn` and undo it, and use the fake WebSocket and recorder the existing hook test uses. Use fake timers for the 3 s, 60 s and warning cases.

1. On first Start, the consent card shows, and `getUserMedia` has not been called.
2. "Allow microphone" stores `"mic"` and then calls `getUserMedia` once.
3. "Use text only" stores `"text"`, starts a session, makes no `getUserMedia` call, and typing sends a `text` message.
4. The two consent buttons have the same class name and the same size class.
5. A refused microphone (`NotAllowedError`) leaves the session open with the note "Echo cannot use the microphone. You can type your questions.", and typing works.
6. `ready` is accepted when the recorder is still starting or has failed.
7. Push-to-talk by default: frames are not sent until Talk is pressed; pressing Talk sends frames; pressing it again sends `mic_off`.
8. Open mic: after 60 s of quiet the mic is muted, `mic_off` is sent, and the note appears. Speech during the 60 s resets the timer.
9. The answer length is sent in `start` as `detail`, and it is remembered after a reload.
10. With `limitSeconds` 600 in `ready`, the warning appears at 540 s; Continue opens a new WebSocket; the transcript is still shown.
11. With no `limitSeconds`, the warning uses 600 s.
12. "Waking Echo up, this can take a minute." appears after 3 s of connecting and not before.
13. The hook returns no `level`, and the meter element's `--level` changes while the level ref changes.
14. "Change microphone choice" clears the stored choice and shows the card again.
15. Blocked storage (a `localStorage` that throws) does not crash the card; the choice is simply not remembered.
16. `expectNoA11yViolations` on the panel in the consent state, the session state and the warning state.

## Guardrails

The microphone is never opened before a choice. No sound plays because of this ticket. The meter's update is a visual, text-free level for the listener's own microphone; it must not flash, and it must be hidden when the mic is off.

## Done when

- No microphone prompt appears before the listener chooses.
- Text-only and a refused microphone both leave a working conversation.
- Push-to-talk is the default, and open mic turns off after 60 seconds of quiet.
- The warning, the waking note and the answer length work as described, with the server's two requests noted.
- The level no longer causes app-wide re-renders (test 13).
- Every test in the list passes.

## Checks

```bash
npm run lint && npm test && npm run build
```

No server change, so the server checks do not apply.

## Out of scope

- Reading `detail` and sending `limitSeconds` on the server (board requests).
- The error texts and the Echo did list (V01).
- The status line and icons (V03).
- Any new server message type.

## Result

Not started.
