# Feature review, 7 Nov 2026

**TL;DR:** Every built feature stays and gets improved. Four unbuilt extras and the ADK build are cut, and none of them had code. The biggest finding: v2 ("change from normal", T112 to T115) was merged but could never play, because T111 (the `baseline` field) was never built. **T111 was built later on 7 Nov** and v2 now plays on one made-up data set; see the update at the end.

Method: a static read of `main` at `b995ddc`, using `git log` and `git grep` over `src/` and `server/`. **Not done in this first pass:** the tests, the build and a browser check were not run, so "built" meant "merged with tests in the repo". They were run later the same day (845 tests passed and the build worked before T111; see the update at the end).

## Built: keep and improve

| ID | Feature | Evidence on `main` | What to improve |
|---|---|---|---|
| F1–F11 | Data loading, viewer, analysis worker, sound engine, player, Learn, Compare, About, a11y checks, voice guide reads the screen, listening-test mode | "Already built" in `TICKETS.md`; `src/data`, `src/analysis`, `src/audio`, `src/features/*`, `server/app/study` | Real NASA data (T85); a real screen-reader tester (T87). The Render free disk wipes test results, so export the CSV after every session |
| F12 | Music pauses while the guide talks | `src/assistant/ducking.ts` + test | Check it on a phone |
| F13 | Stereo pan west→east | `src/audio/pan.ts` | Listen check on speakers and headphones |
| F14 | WAV export | `renderToWav`, Download button (T80 A, T81 A) | Use it for the playlist (T87) and the demo backup |
| F15 | Vibration | `src/features/player/vibration.ts` | Say on About that iOS has none |
| F18, F27, F28 | Contour voice, change field, change style (v2) | T112–T115 merged (`change.ts`, `contour.ts`, `changeVoice.ts`) | **Was unreachable until T111** (`hasChange()` needs `baseline`). Now reachable on `synthetic-change` only; a real data set needs a baseline on 13 Nov |
| F19 | Concise / rich descriptions | `src/describe/detail.ts` (T82 A) | Have a tester pick the default |
| F20 | 3D HRTF audio, off by default | T84 (`pan.ts` elevation) | Headphone check: can north and south be told apart? Hide the toggle if not |
| — | Story mode | T83, `src/features/story/` | Real chapters, with every fact sourced (T85) |
| — | Sound-map explorer | T81 A, `src/features/explore/` | Keyboard and TalkBack pass by a real user |

## Not built: keep (worth building)

| ID | Feature | Why keep |
|---|---|---|
| F26 / T111 | Baseline in the manifest | **Built 7 Nov** (see the update below) |
| F16 / T85 | Real NASA data | Needed for Global Award eligibility (NASA data is required) |
| T87 | Evidence, playlist, write-up, submission | Required for submission |
| F23 | Time travel (lock one cell, scrub dates) | Cheap: it reuses `analyzeGrid` and the explorer. It answers "when did it change here?" directly |

## Not built: cut

| ID | Feature | Why cut | Revive if |
|---|---|---|---|
| F21 | Anomaly haptics | Android-only. F15 already vibrates, and the bell already marks a two-step jump | A tester asks for it |
| F22 | Reef style | Needs licensed recordings, a granular source and its own listening check, and it builds on v2, which had no data set that played it when this was written | v2 is the default and has passed its listening check |
| F24 | Fire alarm | It doubles the bell. A louder cue on bigger jumps adds alarm, not data | A real data set has rare outliers the bell misses |
| F25 | Sound buoys | Needs the sleeping free-tier server and two users; judges test alone | Never, for this hackathon |
| T86 / F19 ADK | Voice guide on ADK | The spike couldn't prove live voice or tool calls. The planning repo's eval failed on free-tier quota (every call 503 or 429, see `evidence/adk-eval-report.md`), and the bridge already works | A billed key, a clean held-out eval, and spare time after T111, T85 and T87 |

Council note (planning repo, 7 Nov): a public link with no login should not depend on a quota-limited model key. If an LLM helps, use it at build time, for example to suggest wordings, and have a person review the output.

## Update, 7 Nov (later): T111 built

What changed, in `nasa`: `baseline`, `changeSteps`, `contourLevels` and `frames[].baselineImage` are in the types and the schema; `npm run check-data` checks baseline pictures (same size, readable through the legend, never resampled), the noise floor (at least twice the legend's rounding) and an anomaly product's legend; `convert_frames.py` takes `--baseline-*`; the new data set `synthetic-change` has a known answer (a warm patch from August to October, a season bigger than the patch); the loader now resolves `baselineImage` like `image`.

**A bug fixed on the way:** the loader rewrote `frame.image` to a full URL but passed `baselineImage` through as written. The analysis resolves it against the page, so on the built site the request would have gone to `/baselines/...`, which the single-page app answers with HTML and status 200. v2 would have failed without a clear error.

**Checked:** 891 unit tests (845 before), lint, build, 62 Python tests, and the production build in a real browser: all 12 baseline pictures load with status 200, "Change from normal" appears and works on `synthetic-change`, and in October the page says "about 1.5 °C above its normal", "About 10% of the readable map is at least +1 °C", and "Trace the warm edge" is enabled.

**Not checked:** listening by ear (nobody has heard the change sound on this data), a screen reader, and a phone. The T115 line "Normal: 0 °C ..." for the whole map reads oddly beside the patch sentence in October; that wording is T115's.
