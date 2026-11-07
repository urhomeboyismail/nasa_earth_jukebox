# Feature review, 7 Nov 2026

**TL;DR:** Every built feature stays and gets improved. Four unbuilt extras and the ADK build are cut, and none of them had code. The biggest finding: v2 ("change from normal", T112 to T115) is merged but never plays, because T111 (the `baseline` field) was never built.

Method: a static read of `main` at `b995ddc`, using `git log` and `git grep` over `src/` and `server/`. **Not done:** `npm test`, `npm run build` and a browser check were not run for this review, so "built" means "merged with tests in the repo", not "checked working today".

## Built: keep and improve

| ID | Feature | Evidence on `main` | What to improve |
|---|---|---|---|
| F1–F11 | Data loading, viewer, analysis worker, sound engine, player, Learn, Compare, About, a11y checks, voice guide reads the screen, listening-test mode | "Already built" in `TICKETS.md`; `src/data`, `src/analysis`, `src/audio`, `src/features/*`, `server/app/study` | Real NASA data (T85); a real screen-reader tester (T87). The Render free disk wipes test results, so export the CSV after every session |
| F12 | Music pauses while the guide talks | `src/assistant/ducking.ts` + test | Check it on a phone |
| F13 | Stereo pan west→east | `src/audio/pan.ts` | Listen check on speakers and headphones |
| F14 | WAV export | `renderToWav`, Download button (T80 A, T81 A) | Use it for the playlist (T87) and the demo backup |
| F15 | Vibration | `src/features/player/vibration.ts` | Say on About that iOS has none |
| F18, F27, F28 | Contour voice, change field, change style (v2) | T112–T115 merged (`change.ts`, `contour.ts`, `changeVoice.ts`) | **Unreachable until T111.** `hasChange()` (`src/analysis/available.ts`) needs `baseline`, but the schema and all three data sets have none |
| F19 | Concise / rich descriptions | `src/describe/detail.ts` (T82 A) | Have a tester pick the default |
| F20 | 3D HRTF audio, off by default | T84 (`pan.ts` elevation) | Headphone check: can north and south be told apart? Hide the toggle if not |
| — | Story mode | T83, `src/features/story/` | Real chapters, with every fact sourced (T85) |
| — | Sound-map explorer | T81 A, `src/features/explore/` | Keyboard and TalkBack pass by a real user |

## Not built: keep (worth building)

| ID | Feature | Why keep |
|---|---|---|
| F26 / T111 | Baseline in the manifest | **Top open item.** It is a small schema change that unlocks four merged tickets of v2 work |
| F16 / T85 | Real NASA data | Needed for Global Award eligibility (NASA data is required) |
| T87 | Evidence, playlist, write-up, submission | Required for submission |
| F23 | Time travel (lock one cell, scrub dates) | Cheap: it reuses `analyzeGrid` and the explorer. It answers "when did it change here?" directly |

## Not built: cut

| ID | Feature | Why cut | Revive if |
|---|---|---|---|
| F21 | Anomaly haptics | Android-only. F15 already vibrates, and the bell already marks a two-step jump | A tester asks for it |
| F22 | Reef style | Needs licensed recordings, a granular source and its own listening check, and it builds on v2, which does not play yet | v2 is the default and has passed its listening check |
| F24 | Fire alarm | It doubles the bell. A louder cue on bigger jumps adds alarm, not data | A real data set has rare outliers the bell misses |
| F25 | Sound buoys | Needs the sleeping free-tier server and two users; judges test alone | Never, for this hackathon |
| T86 / F19 ADK | Voice guide on ADK | The spike couldn't prove live voice or tool calls. The planning repo's eval failed on free-tier quota (every call 503 or 429, see `evidence/adk-eval-report.md`), and the bridge already works | A billed key, a clean held-out eval, and spare time after T111, T85 and T87 |

Council note (planning repo, 7 Nov): a public link with no login should not depend on a quota-limited model key. If an LLM helps, use it at build time, for example to suggest wordings, and have a person review the output.
