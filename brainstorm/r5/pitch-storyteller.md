# R5 Pitch stress-test: One Story, Two Ears

TL;DR: The pitch is one beat: the sound goes quiet where nobody measured, and the listener says "that gap is not zero." Everything else supports it.
The hero is the listener, not the app. Without a real tester we say so on screen and sell the method, not a result.

Tags: [V] = in 00-winner.md's verified list. Everything else is [unverified] or [assumption].

## 1. One sentence, name, one-liner

**10-year-old repeats:** "You hear the same NASA Earth picture two ways, as music and as plain facts, and when the sound goes quiet it means nobody measured there."

**Names (no NASA branding):** 1. **Two Ears** (best) 2. **Listen Twice** 3. **The Quiet Map**

**One-liner:** "Two Ears turns one NASA Earth story into music and into strict data, so you can hear where the planet changed, and hear where we have no data at all."

## 2. 30-second video (English subtitles on every line)

No NASA logos. Frames are plain GIBS imagery with a text credit line.

| Time | Seen | Heard | Subtitle |
| --- | --- | --- | --- |
| 0-5 | Black. A hand resting on a phone. | 2 s reference tone, then pitch steps up year by year. Voice: "Listen." | "This is NASA satellite data. Listen for the year it changes." |
| 5-10 | Arctic sea ice frame, moving marker, year counter. | Side A: soft scale-snapped notes. Hand lifts as pitch leaves the tone. | "She cannot see this map. She found the change by ear." (If no tester: "A blindfolded volunteer.") |
| 10-15 | Toggle to "Strict". Same frames. | Plain sine, one click per year. | "Same data, no music added. Binned to N colours." (N from colormap [V], number to confirm) |
| 15-21 | **Silence map.** Grey no-data gap; marker enters it; large text "No data, not zero." | Sound stops dead for 2 s. Voice: "No data. Not zero." | "Silence means no data. We never invent a sound." |
| 21-26 | Branch (a) or (b) below. | See below. | See below. |
| 26-30 | Text-only end card: name, link, credits. | One clean tone. | "Data: NASA GIBS, NSIDC [V]. Sound built with AI help: see project page." |

**Ending (a), Mauritius test passed** (Test B [unverified until run]): a student's finger on the year slider over a Port Louis sea-surface frame; same rising steps; voice "Warmer sea, around our island." Subtitle: "Sea-surface temperature near Mauritius, 2002 to now. Hear it yourself." Name the variable: sea-surface temperature, not sea level.

**Ending (b), Mauritius test failed** (cut, no re-plan): "What the sound hides" scene, two mappings of one year, one flat and one rising; voice "Same year. One sound hides the change." Subtitle: "We show you when our own sound can mislead you." Mauritius drops to a text line on slide 7.

**Disclosure and credits:** on screen at 26-30 as one line; the full AI-use list and data list sit on slide 7 and the project page. Voice is human or labelled synthetic.

## 3. Seven slides (no NASA logos or patches)

1. **Title: "Two Ears."** "Hear the same Earth story as music and as strict data." Name, team, one credited GIBS frame.
2. **The problem.** "Earth science is mostly pictures." One image; any statistic must be sourced [unverified].
3. **How it sounds.** "Frame in, sound out." Marker on frame; colour-to-pitch rule with the rounding step stated.
4. **Side A / Side B.** "Musical or strict, same frames." The switch, two waveforms, "binned to N colours."
5. **Silence = no data.** "We never fake a sound." The map gap, the rest on the timeline, "No data, not zero." The memory slide.
6. **What the sound hides, and test results.** "We show where we can mislead you." Two mappings; tester or volunteer result with honest counts.
7. **Data, credits, AI disclosure, Mauritius.** GIBS layer IDs [V], NSIDC G02135 [V], GISTEMP [V] if used, all other credits, AI-use list (code, audio, images, voice), Mauritius line if Test B passed, no-login link.

## 4. Three-minute live demo

Speakers: **P1** presenter, **P2** operator, **Tester** (blind person if booked; else a sighted volunteer with eyes covered, introduced as exactly that).

| Min | Run order | Who | Fallback |
| --- | --- | --- | --- |
| 0:00-0:30 | Hook: Side A on the ice story, screen turned away. "Listen for the change." | P1, P2 | Pre-rendered local audio file. |
| 0:30-1:15 | Tester, screen reader on, finds the year of change with the year slider. | Tester | Tester reads aria-valuetext aloud; NVDA on laptop. |
| 1:15-1:45 | Flip Side A to Side B ("Musical / Strict"); P1 says what changed. | P1, Tester | Two preloaded buttons, no live switch. |
| 1:45-2:15 | **Silence map.** Tester enters a no-data area; sound stops; live line says "No data, not zero." Hold 3 s of silence. | Tester, P1 | Silence is baked into the story file; show the text line. |
| 2:15-2:45 | **Judge acts:** picks one of the 3 layers from the spoken and on-screen menu; play 10 s. | Judge, P2 | All 3 cached offline; pick from the other two. |
| 2:45-3:00 | Close: Mauritius SST (Test B passed) or "What the sound hides". Last line: "Silence is a fact, not a gap." | P1 | Jump to slide 7 and read credits and AI disclosure aloud. |

All audio is precomputed from story files. Live agent and live GIBS calls are never on the critical path.

## 5. Emotion vs evidence

- **Emotion:** 3 s of silence, and the listener's hand moving in the gap.
- **Evidence:** the ice cross-check against NSIDC G02135 (Test A). [Path V; contents and tolerance unverified.]
- **The one number to verify before the pitch:** the Test A result: "our ice-pixel September extent agrees with NSIDC's within X%," X set by the red team before looking. Without it, "strict data" is a claim.
- **If a judge asks "did a blind person test this?" and we have no tester:** "Not yet. Today's run used a sighted volunteer with eyes covered, and we label that because it is not the same thing. It is built for TalkBack, VoiceOver and NVDA, and we would rather say that than claim a result we do not have." Never say "tested with blind users" unless a blind person used it, with consent. If one did, give the number tested and the task, nothing more.

Weakest point of my own proposal: the story still leans on a human tester who may not exist by demo day; a labelled blindfolded volunteer is honest but far less moving, and 3 s of silence can read as "broken app" to a judge who missed the setup.
