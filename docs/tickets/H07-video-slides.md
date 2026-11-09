# H07 30 s video and 7 slides

| | |
|---|---|
| **Priority** | P3 |
| **Size** | M (about a day, plus recording) |
| **Who** | 👤 |
| **Needs** | H01, S02, H03 |
| **Hotspots** | — |
| **Branch** | `chore/H07-video-slides` |

## Goal

A 30-second video with English subtitles, and a 7-slide deck, both made from the real data set and the shot list in `docs/submission/demo-script.md`. The video opens with an ocean-current animation in Symphony mode. Every number and every claim on screen is in the app, and the testing line says what the practice test really found.

**Dependency note.** `docs/submission/demo-script.md` is on `feature/T88b-demo-script` until H01 merges it. Do not start until it is on `main`. The queue row for H07 does not list H01 under Needs; the team should add it.

## Why

- The submission needs a video and slides (`docs/PLAN.md` M5; the F34 evidence pack). The script exists; the video and deck do not.
- `docs/submission/demo-script.md` sets the rules: at most 30 seconds with subtitles, or at most 7 slides; every number must be in the app; the testing line must match `docs/evidence/results-note.md` word for word; no NASA logo, patch or flag; the NASA credit exactly as in `README.md`.
- The brief for this video is the ocean-current animation in Symphony mode (SN07) as the opening shot, because it shows the feature the judges are asked to hear. The script's current opening is Home; change the shot list in the script, and say so in a dated note in the script.

## What to do

### Before recording

Use the demo script's "Before recording" checklist, and tick each item in the script's copy (not in this ticket).

- The real data set is on `main` and listed (`docs/submission/demo-script.md` refers to board entry `R-20261109-T85-2`; check the board, and if the entry is missing, say so on the board).
- The server is awake if the voice guide is shown (the health URL a minute before). Keep the server off for the first pass.
- Headphones on. Set the volume once with "Test sound".
- The credit and licence lines in the manifest have been checked by a person (`docs/data-sources.md`).
- Record the real gap (the date with no data). Never edit in silence.

### The 30-second video

- Follow the shot list in the script, with one change: the first 5 seconds show Listen in **Symphony** mode, playing the real data set, with the ocean-current animation visible. Use the caption "Symphony mode" only if Symphony's name is in the app.
- Subtitles in English, on screen, for everything said or heard that matters. Say in a subtitle who tested it, using the testing line.
- The voice is a human voice, or a synthetic one that is clearly labelled as synthetic in the subtitles.
- Keep the voice below the data sound.
- At most 30 seconds. Check the length with `ffprobe` before sending.

### The 7 slides

- Use the slide content in the script, slide by slide.
- Slide 5 ("What the sound hides, and what we checked") and slide 7 (AI use) use the wording from the script and the results note. Do not write a stronger claim than the results note.
- Slide 6 lists the limits. Add any limit found in the practice test (H03) and the device numbers (H06).

### Where it goes

- The video and the deck are large binary files. Keep them out of git unless the team decides otherwise. Put the links in `README.md` (S03 owns the README; post on the board if S03 is not `done`).
- If the shot list changed, write the change as a dated note at the end of `docs/submission/demo-script.md`. Do not edit the script's rules.

## Done when

- A video of 30 seconds or less, with English subtitles, that opens with Symphony mode on the real data.
- Seven slides, with the testing line matching `docs/evidence/results-note.md` word for word.
- The "Before sending" checklist in the script is ticked by a person, with the date, in a dated note.
- No NASA logo, patch or flag appears in the video or the slides.

## Checks

```bash
ffprobe -v error -show_entries format=duration -of csv=p=0 <video file>   # 30 or less
grep -n "not yet tested\|Not yet tested" docs/evidence/results-note.md docs/submission/demo-script.md
```

Compare the testing line in the slides with `docs/evidence/results-note.md` by eye and by copy. They must match.

## Guardrails

The video is made of the app's own sound. Do not add sound that the app does not make. No flashing: nothing in the video flashes more than 3 times a second.

## Out of scope

- Changing the app or any data for the video.
- The practice test (H03) and the final check (H08).
- Submitting the video anywhere. That is the team's decision.

## Result

Not started.
