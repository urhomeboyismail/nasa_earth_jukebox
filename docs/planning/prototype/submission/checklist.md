# Submission checklist (T11)

TL;DR: What must be true before we submit. Each item says who checks it. Status shown honestly; nothing is ticked that has not been done.
Rules come from the 2025 guide as recorded in CLAUDE.md. **Re-verify all of them against the 2026 guide (expected about 13 November 2026 [unverified]).**

## Required content
| Item | Where | Status |
| --- | --- | --- |
| Project summary | `submission/project-page.md` | drafted |
| Demo: video of 30 seconds or less with English subtitles, or 7 slides or fewer | `submission/demo-30s.mp4` (30.0 s, English subtitles burned in; rebuild with `bash submission/build_video.sh`), `submission/slides.html` (7 slides, prints to PDF) | **both built.** The video is real app screenshots + real audio + subtitles, with no voice and no person in it. A human may still want to re-record it with a real listener |
| Public final project link, no login | `app/DEPLOY.md`, `.github/workflows/pages.yml` | ready to publish; **not deployed** (needs the repo owner) |
| Detailed description | `submission/project-page.md` | drafted |
| NASA data used and how | `submission/project-page.md` | drafted |
| All other data, code and images credited | `submission/project-page.md` | drafted |
| AI-use disclosure | `submission/project-page.md` | drafted; person sign-off **not done** |
| Everything in English | all | yes |

## Honesty checks (red team)
- [ ] Every number in the pitch traces to the app, the story files, or `proof/results-note.md`.
- [ ] "Tested with blind users" appears only with a real n next to it.
- [ ] No claim of an EIC match. The app and slide 3 say none was verified.
- [ ] Check 3 (cross-check) is not claimed as passed.
- [ ] No "validated" thresholds (W1 is open).
- [ ] Every sentence in the app has been read by a person (audit log sign-off).

## Rules checks
- [ ] No NASA logo, insignia, patch or flag in the app, slides, video or icon.
- [ ] Link opens logged-out on a fresh device and a phone.
- [ ] Full demo runs in airplane mode after the first visit.
- [ ] The app works with no API key (the agent is optional).

## Who does what
| Task | Owner (fill in) |
| --- | --- |
| Record the video | |
| Build the slides | |
| Deploy and test the link | |
| Run a tester session | |
| Read and sign off sentences | |
| Final read against the 2026 guide | |
