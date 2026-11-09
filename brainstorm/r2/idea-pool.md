# Round 2 — Idea pool (anonymised, merged, clustered)

TL;DR: 8 independent inputs collapse into 6 options. Option 0 is the plan; Options 1–5 are the real contenders. Near-consensus on cuts (live-any-video headline, Symphony, multi-finger gestures) is flagged for a red-team counter-argument in Round 3.

## What the inputs agreed on (to be challenged, not accepted)

| Signal | Inputs that raised it | Status |
| --- | --- | --- |
| Cut "judge names any EIC visualization live" as the headline | 5 of 8 | Groupthink flag: red team must argue for keeping it |
| Make live mode GIBS-only (colormap lookup, no CV legend reading, no MP4) | 3 | Data: colormaps verified, but they give **value ranges ("binned")**, not exact values |
| Cut the Earth Symphony | 4 | Groupthink flag |
| With TalkBack/VoiceOver on, free drags and multi-finger gestures don't reliably reach a web page | 3 | Partly verified (TalkBack gesture remap; WebKit role=application bug); Android hover events unverified → Day-1 spike |
| Drop the Composer LLM agent; music rules are deterministic code | 2 | — |
| Put a measured blind-user result at the centre of the pitch | 2 | No tester booked yet |

## Verified facts the options lean on

- GIBS colormap XMLs map RGB to value ranges; linked from GetCapabilities [verified: https://nasa-gibs.github.io/gibs-api-docs/access-advanced-topics/].
- NSIDC Sea Ice Index G02135: daily/monthly, 1978–present, CSV, no login stated [verified: https://nsidc.org/data/g02135]. **Green.**
- GISTEMP v4: monthly plain-text tables [verified: https://data.giss.nasa.gov/gistemp/]. **Green.**
- SVS frame sets exist for some pages (5113 fires) but not others (5521 sea ice: MP4 + one PNG); frames usually EXR/TIFF [verified: https://svs.gsfc.nasa.gov/help/]. **Amber.**
- Sea level and Indian Ocean SST: **Amber** (Earthdata login; sources only partly verified).
- TouchingSpace (arXiv 2609.36404 and 2604.14637) is real: proximity hum + boundary cue, static maps, no time dimension [verified: https://arxiv.org/abs/2609.36404].
- Vibration API: Android Chrome yes, iOS Safari no [verified: https://caniuse.com/mdn-api_navigator_vibrate]. ADK Python streaming deploys to Cloud Run [verified: https://adk.dev/streaming/dev-guide/part1].
- Still unverified: Navigator's real API; GIBS layer IDs for sea ice/SST; Android hover events under TalkBack; 2026 judging guide (due ~13 Nov 2026).

---

## Option 0 — Baseline: Earth, Out Loud (current plan)

**Pitch:** Name any NASA Earth visualization; hear it, touch it, ask it questions.
**Top 3 features:** live mode for any EIC visualization (CV legend reading); touch the planet with metal detector mode; Navigator + ADK Narrator/Composer with five voices.
**Data:** EIC MP4s/frames, GIBS layers, NSIDC, GISTEMP, sea level or Indian Ocean SST.

## Option 1 — One Story, Two Ears (deep single story)

**Pitch:** One NASA story, played two ways (musical and strict) side by side, and explored without sight until a blind student finds the change herself.
**Top 3 features:**
1. Side A / Side B on the same frames, with a **home pitch** (quiet baseline drone, so change is heard as an interval) and the judge asked "which would you trust?". Variant: a single "truth dial" morphing musical → strict.
2. **Silence map:** missing data is a rest the listener can hear against the drone; spoken and written "no data, not zero".
3. Measured blind-user test (X of Y found the change unaided) as slide 1, plus a "what the sound hides" limits slide.
**Data:** GIBS sea-ice layer by date + colormap (frames), cross-checked against NSIDC G02135.

## Option 2 — The Frame Jukebox (frame-literal playlist)

**Pitch:** Every NASA frame is a record groove: a playhead sweeps the picture and you hear it, then hear one year slide into another.
**Top 3 features:**
1. **Column scan / groove sweep:** a visible bar crosses the frame; row → pitch, colormap value → loudness, no-data → silence. Arrow keys step one column with spoken value.
2. **Frame crossfade:** two years played as one glide, so change is heard as a slide.
3. Static jukebox shelf (2–3 gold stories + GIBS-only "live" layers, incl. a daily "today's fires" record), with playlist export (audio + text).
**Data:** GIBS layers + colormaps (ice, SST, fires); SVS 5113 VIIRS fire frames (TIFF/EXR → offline convert); NSIDC, GISTEMP for cross-checks.

## Option 3 — Time Under Your Finger (place × time explorer)

**Pitch:** Pick any place on the planet and hear how it changed over 40 years — the one thing existing touch maps don't do.
**Top 3 features:**
1. **Planet Dial:** screen-reader-native Place and Year sliders (spoken `aria-valuetext`, live text line for braille), plus a Find-the-change button with warmer/colder pings. Optional free-touch canvas.
2. **Aim the Earth:** point the phone like a torch (heading = longitude, tilt = latitude); no gesture conflicts.
3. One grounded Narrator agent that must return cited fact IDs; anything uncited is not spoken. Borrow TouchingSpace's proximity hum + boundary cue, credited.
**Data:** GIBS gridded layer by date (temperature or SST) reduced to a coarse regional grid × years; NSIDC/GISTEMP for headline facts.

## Option 4 — Hold the Ocean to Your Ear (Mauritius local story)

**Pitch:** One dial, one place: turn it through 30 years and hear the Indian Ocean around Mauritius change.
**Top 3 features:**
1. Single time dial for the Mauritius coast; phone held to the ear like a shell.
2. **Coast duet:** nearshore vs offshore SST as two voices that pull apart when cold water rises (upwelling method credited to the 2021 Openscapes project).
3. Shareable sound postcards (QR on paper → 30 s clip + caption) for Mauritian classrooms; "Ice melts far away. The sea rises here."
**Data:** Indian Ocean SST (GIBS SST layer or PO.DAAC MUR, 2002+, Earthdata login) — **Amber**; sea level — **Amber**.

## Option 5 — Tune Your Own Earth (blind users author the mapping)

**Pitch:** The first tool where blind users choose how NASA's Earth data sounds, and hear one frame under two of their own mappings.
**Top 3 features:**
1. Mapping editor: pick which value is high, pitch range, scale on/off; hear the same frame A/B.
2. Two-layer mixing desk (left/right ears), labelled "together ≠ cause".
3. Save and share a mapping with its text description.
**Data:** any 1–2 GIBS layers + colormaps.

---

## Unclustered sparks (for cross-breeding in Round 4)

Earth Radio (sound-only station); braille/tactile sheet + sound; feature-phone hotline; pulse duet (your tapped tempo drives playback); orbit-surf game; scenario dial (observed → projection, must be labelled); class choir; sound poster.

**Facilitator idea (scored like any other):** make **laptop + NVDA/keyboard** the primary demo platform and the phone a second screen. It sidesteps mobile screen-reader gesture conflicts, keeps every interaction keyboard-operable, and is how many blind students study [assumption: needs tester confirmation].

## Cuts proposed (to be scored, not yet decided)

Live mode for arbitrary EIC videos as headline · Earth Symphony · all multi-finger gestures · Composer LLM agent · five-voice description (collapse to fewer) · sea-level gold story unless data works on day one · Your Year / share / haptic language.

Weakest point of this synthesis: Options 1–3 share most of their parts, so Round 3 scores may not separate them; the differences are emphasis (sound vs frames vs place×time), not architecture.
