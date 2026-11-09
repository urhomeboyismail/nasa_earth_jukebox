# W4: The sound engine has never run in a real browser

TL;DR: The 22 sound tests use a stub for Tone.js and a fake clock. The code matches the library's source, but no one has heard it play or run it with a real AudioContext.
Status: **partly closed 2026-11-07**. Found in: T3 (`app/sound/engine.js`). Owner: sound designer + frontend.

## Update 2026-11-07: first run in real Chrome (desktop, headless-driven, no one listening)
- **Found and fixed a real bug the stub tests could not see.** The default timers were bare `setInterval` / `clearInterval` references called as methods, which Chrome rejects ("Illegal invocation"). Play did nothing. Fixed in `engine.js` and `player.js` (arrow-function wrappers).
- **Now verified in Chrome:** page loads, Tone 15.1.22 loads as a global, the AudioContext starts on a real click, Play runs to each key moment and gap, the live region gets exactly one message per stop and nothing between, Continue works, the switch changes mode silently and updates its description.
- **Still NOT verified:** that anyone can *hear* the sound or that it sounds right; Android Chrome; Safari and iOS (silent switch); NVDA/TalkBack reading of the page; scheduling drift under load; clicks and pops at note edges.
- **Lesson:** the stub tests passed with a bug that broke the whole app. Keep the browser run as part of "done" for T3 and T4, and re-run it after any change to timers or Tone calls.

## Why it matters
- The T3 "Done when" says the fixture plays end to end in both modes. That is only shown against a stub.
- Things a stub cannot catch: autoplay rules, `Tone.start()` timing, scheduling drift of the 50 ms timer, clicks and pops at note edges, iOS Safari's silent switch, a suspended AudioContext after the tab sleeps.

## Known risks (all `[assumption]` until tested)
- Scheduling uses `setInterval` with 0.2 s lookahead. A busy tab may starve it and drop notes.
- Setting `envelope.release` just before each note may click if a previous note is still releasing.
- `NoiseSynth.triggerAttackRelease(0.03, time)` is called as the library documents, but not run.
- The vendored `Tone.js` is a UMD build used through a `<script>` tag as a global; not run.

## How to fix
1. Open `app/sound/listen.html` through a local static server (not `file://`, because it fetches JSON).
2. Check: Enable sound, Play, Continue through every stop, Pause, mode switch, Reference tone, Hear this step both ways.
3. Repeat on Chrome desktop, Android Chrome, Safari desktop, and iOS Safari with the silent switch on and off.
4. Record what fails. Add a test for each real bug.
5. Keep the pre-rendered backup clip (`app/sound/backup/`) as the stage fallback until this passes.

## Done when
Each of the above works in at least Chrome desktop and one phone, and the results are written in `decisions.md`.
