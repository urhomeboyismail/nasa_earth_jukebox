# Demo video (30 s) and slides (7): scripts

Status: **Video and deck are BUILT** (`submission/demo-30s.mp4`, built by `bash submission/build_video.sh`; `submission/slides.html`, prints to PDF). The video is made of real screenshots of the running app, the real audio rendered from the real story, and burned-in English subtitles. **It has no voice and no person in it**, so it makes no claim about a listener. If the team wants a human listener or a voice-over, record that and swap it in. Subtitles are in `submission/demo-30s.srt`. The end card says "Not yet tested with blind users." All text is English. No NASA logos or insignia anywhere.

## Rules (from CLAUDE.md and the 2025 guide; re-check against 2026)
- Video: at most 30 seconds, with English subtitles. Or at most 7 slides. We prepare both.
- Voice: pre-recorded human voice or a clearly labelled synthetic voice, plus subtitles. The app itself does not speak.
- Say truthfully who is using the app. If no blind tester took part, the subtitle says "a volunteer with eyes covered", and the result is not counted as a tester result.
- Use only numbers that appear in the app or in `app/stories/mur-sst-mauritius-2023.*.json`. The only numbers in the script are 0.15 and the story's own values.

## 30-second video: shot list
| Time | Picture | Sound | Subtitle (same as the .srt) |
| --- | --- | --- | --- |
| 0:00 to 0:05 | Black screen, a hand on the phone or laptop | Reference tone, then pitch steps | This is NASA satellite data. Listen for the change. |
| 0:05 to 0:10 | The app, Play on the Mauritius story, picture beside the controls | Musical mode | Sea temperature around Mauritius, played as sound. Higher pitch means warmer water. |
| 0:10 to 0:15 | Press the Strict data mode switch, press Play | Plain tone with clicks | Strict mode: same data, no music added. Each value is only known to within 0.15 degrees. |
| 0:15 to 0:21 | The silence beat: the gap at step 2, message on screen | The click continues, the pitch stops | One date has no map. The pitch stops. The click keeps time. No data, not zero. |
| 0:21 to 0:26 | The Ask section: one answer with its source, then a refusal | None | Every sound is also written, with its source. Ask something the record cannot say: "Not in this record." |
| 0:26 to 0:30 | End card, text only | None | Data: NASA GIBS, JPL MUR. Built with AI help: see project page. |

Notes for the recorder
- Record with the screen reader on if a tester takes part, and show its speech as a caption.
- The silence beat must be the real gap (step 2, 2023-02-02). Never edit in silence.
- Check the audio levels: the voice must never cover the data sound.
- Export with burned-in or attached English subtitles, whichever the portal accepts [check 2026 guide].
- If the Ask section is not in the final build, replace the 0:21 to 0:26 shot with "What the sound hides" and change the subtitle to match what is on screen.

## 7 slides
1. **Title.** Earth, Out Loud [name pending]. One line: "Hear a NASA Earth data story. Know when there is no data."
2. **The problem.** Earth data is told with pictures. People who cannot see the picture are left out. Sound that ignores gaps or invents notes is worse than none.
3. **Frame in, sound out.** One map in, one pitch out. Show the Mauritius sea temperature map and the pitch line. Include the line: "No matching EIC visualization verified. The maps come from NASA GIBS."
4. **Two sides.** Musical mode (notes snapped to a scale, rounding stated) and Strict data mode (plain tone, coarseness stated: 0.15 °C per map point).
5. **Silence means no data.** The real gap on 2 February 2023: the date list skips it, the server's image is empty, the app stays silent and says so.
6. **What the sound hides, and the honest test result.** The coarse and honest versions side by side. The test line is exactly one of: "Not yet tested with blind users", or the real n and tasks passed from `proof/results-note.md`.
7. **Data, credits, AI use, code.** NASA data and how it was used; the credit lines; the AI-use list; third-party code; the public no-login link.

## Before sending
- [ ] Every number on a slide matches the app.
- [ ] Slide 6 matches `proof/results-note.md` word for word.
- [ ] No NASA logo, patch or flag.
- [ ] Link opens logged-out on a fresh device.
