# Earth, Out Loud: project page (draft for the submission)

Status: **DRAFT.** Name still open (see `brainstorm/t0-lockin.md` §C, question 1). Anything in [square brackets] must be filled in or checked before submitting. Re-check every rule against the 2026 submission guide when it is published (expected about 13 November 2026 [unverified]).

## Summary (one paragraph)
Earth, Out Loud lets you hear a NASA Earth data story as sound, and read or ask about every sound. The same series plays two ways: Musical mode, which snaps notes to a scale, and Strict data mode, which plays a plain tone and states how coarse the data is. When there is no data, you hear silence and are told so: "no data, not zero". It works with a screen reader, a keyboard and a braille display, and everything you hear is also written on the page.

## The challenge we answered
The Earth Information Jukebox: pair NASA Earth visuals with sonifications generated from the images, with accessibility for blind and low-vision users as a core theme.

## What it does
- **Choose a story** from a radio group.
- **Play** the story as sound. It stops at key moments and at gaps, shows one message, and waits for Continue. It never talks over your screen reader.
- **Musical / Strict data mode** switch. The switch changes mode silently and leaves playback paused.
- **Silence means no data.** At a date with no published map, the pitch stops, a click keeps time, and one message says "no data, not zero".
- **Reference tone** (the story's starting level) and **Test sound**.
- **Step slider** with the reading for each step as text, and **Hear this step both ways**.
- **The picture and a data table** for sighted users, and as the braille-friendly equivalent. (built; checked in desktop Chrome, not with a screen reader)
- **Cited answers** to questions. Every answer shows the fact it comes from. If the record does not say, the answer is "Not in this record". (built; the answers come from a fixed fact sheet. The optional AI picker has never run against a real model, so the shipped answers use plain matching)
- **What the sound hides**: the same series with a coarse mapping next to the honest one, so you can hear what a careless mapping loses. (built; nobody has run the listener test yet)
- Works offline once installed. (checked in desktop Chrome with the server stopped; phones not tested)

## NASA data used, and how
| Data | Where from | What we did with it |
| --- | --- | --- |
| Sea surface temperature, GHRSST Level 4 MUR Global Foundation SST Analysis v4.1, daily map layer `GHRSST_L4_MUR_Sea_Surface_Temperature` | NASA GIBS (Global Imagery Browse Services), data from NASA JPL PO.DAAC | For 20 dates (every 10 days from 2023-01-23 to 2023-08-01) we fetched the map for a box around Mauritius (longitude 56.8 to 58.4, latitude -21.0 to -19.4). Each pixel's colour was matched exactly to NASA's published colour map for the layer, giving a temperature range of 0.15 °C. Each reading is the average of the sea pixels in the box. |
| The layer's date list | NASA GIBS WMTS capabilities | The date list says which dates have a map. 2023-02-02 is not on the list, and the server returns an empty image for it, so that step is a real gap and is silent. |
| The layer's colour map | NASA GIBS colour map XML | Used to turn colours into temperature ranges. |

Nothing is invented. A date with no map is a rest, never a made-up number. The pipeline stops if the date list and the image disagree. Details: `pipeline/build_story.py`, `pipeline/day1-report-mur-mauritius.json`.

**Not done / limits we state openly**
- No matching NASA Earth Information Center (EIC) visualization has been verified for this story. The app says so on the page.
- There was no independent cross-check series for this layer, so we did not claim one.
- The data shows what the maps say. It does not say why the sea temperature changed.
- The dataset was chosen by us as a prepared example; the event's own data was not available when we built this. [update if the event provides data]

## Credits (text only, no NASA logos or insignia)
- JPL MUR MEaSUREs Project. 2015. GHRSST Level 4 MUR Global Foundation Sea Surface Temperature Analysis (v4.1). PO.DAAC, CA, USA. doi:10.5067/GHGMR-4FJ04.
- "We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS)."
- Colour map: NASA GIBS (https://gibs.earthdata.nasa.gov/colormaps/v1.3/GHRSST_Sea_Surface_Temperature.xml).

## Third-party code
| Software | Use | Licence (checked in package metadata) |
| --- | --- | --- |
| Tone.js 15.1.22 | Sound synthesis in the browser | MIT |
| jsdom 31.0.0 | Tests only | MIT |
| axe-core 4.14.0 | Accessibility checks in tests only | MPL-2.0 |
| numpy 2.5.4, Pillow 13.0.0 | Data pipeline (build time only) | BSD-3-Clause and others / MIT-CMU |
| jsonschema 4.26.0 | Story file validator (build time only) | MIT |
| Google Agent Development Kit 2.13.0 (optional, `agent/`) | Optional answer-picking agent. Not part of the shipped static app, and never run against a real Gemini model | [verify licence before mentioning in the submission] |

## AI-use disclosure
AI helped us plan, write code, tests and documents. It did not create any data value, pitch or sound.
- **Every value comes from NASA map images decoded by a script.** The sentences in the app are built from those numbers by code templates, and a code checker rejects any number not in the data files. [A person must read and sign off every sentence before submission; sign-off status: NOT YET DONE.]
- **Tools:** Claude (Anthropic) via Claude Code, for planning, code, tests and documents. Google ADK with Gemini: code written and tested with a fake model only; **not used in the shipped app**, and no Gemini output appears anywhere in it.
- **Code written with AI help:** the whole repository was written with AI assistance and reviewed by the team [confirm and name who reviewed what].
- **AI-made audio or images:** none. All sound is synthesised in the browser from the data; the pre-rendered backup clip is rendered by our own script from the same data. The app icon is generated by a short script from simple shapes.

## Status of testing (honest)
**Not yet tested with blind or low-vision users.** [Replace only with the real numbers from `proof/results-note.md`.] Automated checks and a real-browser run have been done; they are listed in `proof/automated-checks.md`.

## Links
- Public link (no login): [fill in after deploying; see `app/DEPLOY.md`]
- Source code: [fill in]
- 30-second video: `submission/demo-30s.mp4` [upload and put the link here]
- Slides: `submission/slides.html` [export to PDF or host, then put the link here]
