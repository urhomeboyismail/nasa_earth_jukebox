# Demo script: 30 s video, 7 slides and the live demo (T88b / F34)

**Status: script only.** The video and the deck have **not** been recorded or built for the React app. The older ones in `docs/planning/prototype/submission/` show the first prototype, not this app, and must not be submitted as if they did. Recording, the voice and the final edit need people; this page is what they record from.

## Rules we hold ourselves to

- At most 30 seconds, with English subtitles; or at most 7 slides. Prepare both. Re-check the limits against the 2026 guide when it is out.
- **Every number on screen or in a subtitle must appear in the app.** The only numbers used below are the ones the Mauritius story and its comparisons already say.
- **Say truthfully who tested it.** Until a real session has been run (`docs/evidence/results-note.md`, n = 0), the video and slides say "not yet tested with blind users". A volunteer with eyes covered is not counted as a tester, and the subtitle says so.
- Voice: a pre-recorded human voice, or a clearly labelled synthetic voice, plus subtitles. The app itself does not narrate.
- No NASA logo, patch or flag. Credit NASA exactly as in `README.md`.
- Do not show a feature that has not had its check as if it were proven. The "change from normal" sound has not had its listening check (`docs/tests/t114-listening-check.md`), so it is shown, if at all, as "experimental".

## Before recording

- [ ] The real data set is merged and listed (`mur-sst-mauritius`), and the demo opens on it (board entry R-20261109-T85-2).
- [ ] The server is awake (open its health URL a minute before) if the voice guide is shown.
- [ ] Headphones on, volume set once with "Test sound".
- [ ] The credit and licence wording in the manifest has been confirmed by a person (`docs/data-sources.md`).
- [ ] Record the real 2 February gap. Never edit in silence.

## 30-second video: shot list

| Time | Picture | Sound | Subtitle |
|---|---|---|---|
| 0:00 to 0:05 | Home. Echo, our guide, offers three ways in; pick "Just play me something". | A soft note from the sound check. | NASA Earth data you can hear. |
| 0:05 to 0:13 | Listen on Mauritius, Play. The picture changes date by date. | Notes rise to the warmest weeks in early April, then fall to the coolest in late July. | Sea temperature around Mauritius, January to August 2023. Higher note, warmer sea. |
| 0:13 to 0:18 | One date with no picture (2 February): the screen says there is no data. | A short hiss, not a low note. | No data is a hiss, never "cold". |
| 0:18 to 0:25 | The sound map: arrow keys move over the map, each place plays; the cursor reaches the warmest place. | Notes from each place, left and right in the headphones. | Move over the map with the keyboard and hear each place. |
| 0:25 to 0:30 | End card, text only. | None. | Data: NASA GIBS, MUR. Not yet tested with blind users. |

Notes for the recorder:
- The 0:13 shot must be the real 2 February picture (all grey), not an edit.
- If "Trace the warm edge" is shown instead of the map shot, it is labelled "experimental".
- Keep the voice below the data sound.

## 7 slides

1. **Title.** Earth Jukebox. One line: "Hear a NASA Earth data story."
2. **The problem.** Earth data is told with pictures. People who cannot see them get a caption at best, and a sound that hides gaps or invents notes is worse than none.
3. **Who it is for, and how it is meant to be used.** Blind and low-vision listeners first; also anyone listening on a phone. The welcome asks how you want to use it, and sets the defaults.
4. **How sight becomes sound.** One map in, one note out: the colour of each place is matched to a value, the value to one of five notes, the place to left and right. Show the Mauritius map beside its notes. Credit `docs/CREATIVE_PROCESS.md`.
5. **What the sound hides, and what we checked.** The coarse and the strict version side by side. The testing line is exactly one of: "Not yet tested with blind users", or the real n and tasks passed from `docs/evidence/results-note.md`, word for word.
6. **Limits.** Values are read from NASA's rendered maps and are approximate; one real data set so far; the change sound has not been checked by listeners; vibration does not work on iPhones.
7. **Data, credits, AI use, what is next.** NASA data and its credit line; Google Gemini Live for the optional voice guide; coding assistants helped write code and the team reviewed every change. Next: more real data sets, a listening check with blind testers, a second baseline kind (same-month normals).

## The live demo (T87 step 7)

Pick a data set, then: story, then explore by keyboard, then compare two dates by ear, then the reveal, then a playlist track (once the playlist exists), then the results, then the limits. Keep the server off for the first pass to show that everything but the voice guide works without it.

## Before sending

- [ ] Every number on a slide matches the app.
- [ ] The testing line matches `docs/evidence/results-note.md` word for word.
- [ ] No NASA logo, patch or flag, and the credit line is exactly the README's.
- [ ] The video is at most 30 seconds and has English subtitles.
