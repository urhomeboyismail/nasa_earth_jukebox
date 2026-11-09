# Round 5 — The winner to stress-test

TL;DR: "One Story, Two Ears" (Option 1) with a gated Mauritius SST close. Human-approved at the Round 4 checkpoint (2026-11-06).
Read with: brainstorm/r4/scoreboard.md (§4 cross-breeds, §5 verified data, §7 ICE) and brainstorm/r4/council.md.

## One sentence

Hear one NASA Earth story twice, as music and as strict data, and find where it changed without seeing it. Where there is no data, you hear silence.

## Core features (must work with TalkBack/VoiceOver/NVDA on)

1. **Choose:** a small menu of 3 pre-tested GIBS layers (Arctic sea ice; global or Indian Ocean SST; one more), spoken and on screen. No free-text "any visualization".
2. **Side A / Side B switch** (`role=switch`, "Musical / Strict") on the same frames. A = scale-snapped, soft timbre, rounding step stated. B = unsnapped sine, one click per year, labelled "binned to N colours".
3. **Silence map:** no data = an audible rest, plus voice and text "no data, not zero" in an `aria-live` line. **This is the demo beat.**
4. **Reference tone on demand:** 2 s baseline tone before playback and on a button. No constant drone.
5. **Year slider** with spoken `aria-valuetext`; Play/Pause, "Where am I", "Replay" buttons; keyboard on all.
6. **Cited answers:** ~20–40 pre-written Q&A, each with a fact ID from the story file or fact sheet; uncited = not spoken. Live agent optional, never required.
7. **"What the sound hides" scene:** the same year under a preset mapping that hides the change, next to one that shows it.
8. **Sighted view:** the current GIBS frame with a moving marker showing what is being sonified (judges see frame → sound).

## Gated (day-1 kill tests, hours 0–6)

- **Test A, ice:** `MODIS_Terra_L3_Sea_Ice_Daily` (2000→, ice/not-ice classification) → count ice pixels per September frame → compare to NSIDC G02135 September extent. Pass = agreed tolerance (red team sets it before looking). Fail → SST becomes the main story; ice goes to the limits scene.
- **Test B, Mauritius:** `GHRSST_L4_MUR_Sea_Surface_Temperature` (2002→, 0.15 °C bins) tile covers Mauritius with a usable range. Pass → Mauritius SST time dial closes the story and the video. Fail → cut, no re-plan.

## Stretch / cut

Stretch: pick-from-menu live GIBS layer chosen by a judge; 20 s sequential medley; live ADK Narrator; quantised column-scan bar; sound postcards (QR). Cut: coast duet, free-text any-video live mode, Earth Symphony (overlapping), multi-finger gestures, Aim the Earth, five-voice system (→ one voice + earcons), haptic language as core.

## Verified data (do not re-derive; tags in scoreboard §5)

GIBS layer IDs and date ranges above [verified: https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/1.0.0/WMTSCapabilities.xml]; colormaps binned [verified: https://gibs.earthdata.nasa.gov/colormaps/v1.3/GHRSST_Sea_Surface_Temperature.xml]; NSIDC monthly CSV path [verified: https://noaadata.apps.nsidc.org/NOAA/G02135/north/monthly/data/] (contents unverified); GISTEMP v4 text tables [verified: https://data.giss.nasa.gov/gistemp/]; Arcand 2024 3,184 participants [verified: https://arxiv.org/abs/2403.18082].

## Open

No blind tester booked. Team skills unknown (CLAUDE.md table empty). Navigator's API unverified, so it is not on the critical path. The 2026 judging guide is due ~13 Nov 2026.
