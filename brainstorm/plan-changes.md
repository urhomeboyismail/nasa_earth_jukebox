# Proposed changes to docs/plan.md

TL;DR: Section-by-section edits that bring plan.md in line with FINAL.md. Format: replace X with Y because Z. Nothing here is applied until a human approves; docs/plan.md was not edited.

## Concept
- **Replace** the one-liner "Name any NASA Earth visualization, and we let you hear it, touch it and ask it questions" **with** "Hear one NASA Earth story twice, as music and as strict data, and find where it changed without seeing it. Where there is no data, you hear silence." **Because** live any-visualization was the least reliable feature (Feasibility 1 from all five scorers) and the core moved to Option 1 (r4/scoreboard.md).
- **Replace** "Scope: three curated gold stories (global temperature, Arctic sea ice, sea level) plus live mode" **with** "Arctic September sea ice from 2000 (GIBS MODIS) + gated Mauritius SST close from 2002; 3-layer choose menu" **because** of the verified layer date ranges and the missing sea-level data route (ADR-0004).
- **Replace** "Time under your finger … over 40 years" **with** the year slider over 2000–present. The touch differentiator moves to stretch **because** screen readers capture custom gestures.

## The jukebox: shelf, sides and playlist
- **Keep** Side A / Side B; **add** "Side B says 'binned to N colours' (SST) or 'ice or not ice, per pixel' (ice), never 'exact'" **because** GIBS colormaps are ranges [verified: https://gibs.earthdata.nasa.gov/colormaps/v1.3/GHRSST_Sea_Surface_Temperature.xml].
- **Replace** the five-theme shelf **with** a 3-item radio-group menu of pre-tested GIBS layers **because** a small fixed menu answers "select a visualization" without live risk (council, Skeptic).
- **Replace** level 3 "Touch the planet, listening radius, metal detector" **with** "Year slider, Where am I, data table" **because** of gesture conflicts (Round 1 accessibility evidence).

## Team and ownership
- **Add** "Red team books 1–3 blind/low-vision testers this week and writes the Test A tolerance before data is seen" **because** the missing tester is the top fatal-flaw candidate (r5/judge-red-team.md).
- **Replace** "Navigator is the single front door" **with** "Navigator is a link-out, off the critical path, until its API is verified" **because** its API is unverified (ADR-0003).

## Feature 1: Live mode for any EIC visualization
- **Replace** the whole section **with** "Stretch: a judge picks one of 3–6 pre-tested GIBS layers from a printed menu; no free text, no computer-vision legend reading" **because** the red team's case for live mode only survived in this form (r3/judge-red-team.md).

## Frame pipeline
- **Replace** step 1 "MP4 as last resort" **with** "GIBS tiles only for the core" **because** some SVS pages are MP4-only and compression breaks colour matching [verified: https://svs.gsfc.nasa.gov/5521/].
- **Replace** "exact" **with** "binned" **because** of the colormap check.
- **Add** "Ice: count ice pixels in an area-weighted multi-day September composite (cloud is transparent)" **because** the MODIS colormap marks cloud transparent [verified: https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_L3_Sea_Ice.xml].
- **Replace** "Frame-vs-NASA cross-check" **with** "Test A: frames vs NSIDC G02135 September extent, trend and rank, tolerance set first; NSIDC never drives the melody" **because** that keeps frames as the foundation.

## Building on MyEarthObserver
- **Replace** "Starter layers … These are themes, not verified layer names" **with** the verified IDs `MODIS_Terra_L3_Sea_Ice_Daily`, `GHRSST_L4_MUR_Sea_Surface_Temperature`, `MODIS_Terra_Aerosol_Optical_Depth_3km` (third layer still open) [verified: https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/1.0.0/WMTSCapabilities.xml].
- **Replace** "Confidence is 'exact'" **with** "Confidence is 'binned'" **because** of the colormap check.

## Ideas from NASA Openscapes
- **Move** Coast duet and Event mode to "cut" **because** contrast is unproven, the island is land-masked, and the 1981 record isn't MUR (council, r3/data-scout.md).
- **Keep** Honest silence and Common grid rule; Honest silence becomes the demo beat.

## Feature 2: Touch the planet
- **Move** the whole section to stretch **because** TalkBack remaps one-finger drags and multi-finger gestures [verified: https://support.google.com/accessibility/android/answer/6151827]. **Replace** it in the core **with** a year slider + `aria-valuetext` + Find-the-change button (screen-reader-native).

## Audio description system
- **Replace** "five voices" **with** "one `aria-live` text stream read by the user's own screen reader, plus 6 earcons; app TTS off by default" **because** our voice must never talk over the screen reader (r5/accessibility-lead.md).

## Sound design and haptic language
- **Replace** the multi-dataset sound grammar **with** the single-story mapping spec in r5/sound-designer.md (pitch C3–C5, Side A pentatonic, Side B sine + click, gaps = rest while the click continues).
- **Replace** "hear it against normal: a soft drone holds the long-term average" **with** "a 2 s reference tone on demand, only if a baseline is in the story file" **because** a constant drone bends the no-background-music rule (r3/sound-designer.md).
- **Move** the haptic language to stretch (Android only).

## Hearing what the eye misses
- **Keep** idea 4 (the proof moment) as the silence-map beat. **Add** "Never create a gap; use a real gap, the land mask, or a `qc_failed` frame announced as such."

## Earth Symphony finale
- **Replace** with "Cut. Stretch: a 20 s sequential medley with no overlapping layers" **because** overlap breaks the two-layer rule (red-team groupthink check).

## App walkthrough
- **Replace** with the TalkBack walkthrough in r5/accessibility-lead.md §1 (with the 2000+ dates, not 1979).

## Risks and mitigations
- **Replace** with the top 5 risks in FINAL.md §9 (tester, Test A, no natural gap, audio unlock, silence read as a crash).

## Build order, cut list, validation and demo
- **Replace** with FINAL.md §6–8 (hour 6/24/40 checkpoints, kill tests, cut order, 30 s video, 7 slides, 3-minute demo).
- **Replace** the 90 s demo opener "Black screen. The Earth Symphony plays" **with** "Black screen. Reference tone, then one story by ear, ending on the silence beat."

## Research basis and sources
- **Add** the second TouchingSpace paper, arXiv 2604.14637 [verified: https://arxiv.org/abs/2604.14637].
- **Replace** the Arcand link with the verified arXiv abstract [verified: https://arxiv.org/abs/2403.18082] (3,184 participants; self-reported learning gains).
- **Add** prior art: vOICe for column scanning [verified: https://www.seeingwithsound.com/voicover.htm].
- **Add** data credits (r5/data-scout.md §6).

Weakest point of this list: it rewrites most of the plan. The team may want to keep the old plan as a "vision" appendix rather than delete it.
