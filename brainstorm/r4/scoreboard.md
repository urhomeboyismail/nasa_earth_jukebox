# Round 4 — Scoreboard

TL;DR: Option 1 (One Story, Two Ears) wins every scorer's table (30.2/35). Option 4 (Hold the Ocean, SST only) is the second option that clears the feasibility gate; Option 3 scores higher but fails the gate (2.8).
Top 2 for the council: **Option 1** and **Option 4 (SST-only)**. Most valuable cross-breeds: Option 3's Year slider, Option 5's preset A/B scene, Option 0's pick-from-a-menu GIBS live moment.

## 1. Scores (five scorers: judge-red-team, accessibility-lead, sound-designer, tech-architect, pitch-storyteller)

Average of five, 1–5. Sum is out of 35.

| Option | Influence | Creativity | Validity | Relevance | Presentation | Feasibility | Accessibility | **Sum** | Data (data-scout) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 Baseline | 3.8 | 3.2 | 2.0 | 4.0 | 3.0 | **1.0** ✗ | 3.2 | 20.2 | Red |
| **1 One Story, Two Ears** | 3.4 | 3.6 | **4.6** | 4.2 | **4.8** | **4.8** | **4.8** | **30.2** | Amber → see §5 |
| 2 Frame Jukebox | 3.0 | 3.2 | 3.6 | **4.6** | 4.0 | 3.8 | 3.6 | 25.8 | Amber |
| 3 Time Under Your Finger | 4.2 | **5.0** | 3.0 | 4.2 | 3.8 | **2.8** ✗ | 4.0 | 27.0 | Amber |
| 4 Hold the Ocean | 4.2 | 4.0 | 2.8 | 3.8 | **4.8** | 3.0 | 3.6 | 26.2 | Red (as written) / Amber (SST only) |
| 5 Tune Your Own Earth | 3.0 | 4.0 | 3.0 | 3.2 | 2.8 | 3.4 | **4.8** | 24.2 | Amber |

✗ = fails the feasibility gate (< 3): stretch only.

**Disagreements of 2+ points:** only two, both on Option 0. Accessibility: the accessibility-lead gave 2 (headline gestures are captured by TalkBack) while the tech-architect and pitch-storyteller gave 4. Presentation: the tech-architect gave 4, the pitch-storyteller gave 2 (ten features, no single moment). Every other spread was ≤ 1, which is itself a groupthink signal (see §3).

## 2. Novelty (prior-art-scout) and data (data-scout), merged

| Option | Most novel part | Already done (or done better) |
| --- | --- | --- |
| 1 | Side A/B on the same frames; "no data" as an audible rest | Universe of Sound publishes multiple described versions; 3,184 participants [verified: https://arxiv.org/abs/2403.18082] |
| 2 | Frame crossfade (not searched) | Column scan is common: vOICe [verified: https://www.seeingwithsound.com/voicover.htm], Chandra scans [unverified] |
| 3 | Place × time on a slider | Static touch maps: TouchingSpace [verified: https://arxiv.org/abs/2609.36404]; phone-pointing common in nav apps [unverified] |
| 4 | Nearshore/offshore SST duet for Mauritius (nothing found) | ENSO/Niño 3.4 SST sonification exists [unverified] |
| 5 | Blind users author mappings on NASA frames | TwoTone, Sonification Sandbox [unverified] |

## 3. Groupthink checks (red team argued the opposite)

- **Live "any visualization" headline:** case partly survives, as a **pick-from-a-menu moment on pre-tested GIBS layers** (demo bonus, not headline). Free-text any-video CV reading is cut (Validity, Feasibility).
- **Earth Symphony:** case mostly fails. Survives only as a 20 s **sequential** medley (no overlap, keeps the two-layer rule) if stories finish early. Cut by default.
- **"Option 1 wins" (all five agreed):** case against partly survives. Option 1 is thin on Influence (3.4) and on "selecting a visualization". Fix: absorb Option 4's Mauritius close, *only if its data is verified on day 1*.

## 4. Cross-breeds (best feature from losing options)

| From | Feature | Where it fits | Condition |
| --- | --- | --- | --- |
| 3 | Year slider with spoken `aria-valuetext` + place picked from a list | Option 1's explore mode | Sliders only; Aim the Earth is a stretch |
| 5 | 3 named mapping presets, one of which hides the change | Option 1 scene: "what the sound hides" | Presets, not an editor |
| 0 | Judge picks a layer from a printed/spoken menu of 3–6 GIBS layers | Demo bonus | Only pre-tested layers |
| 2 | Column scan, **quantised** to 8–12 latitude bands, as the visible "frame drives sound" bar | Sighted view / Side B detail | Don't claim it as novel |
| 0 | Grounded answers that must cite fact IDs (static Q&A first, agent optional) | Narrator | Uncited answers are never spoken |
| R3 sound | Reference tone **on demand** (2 s), not a constant drone | Option 1 | Resolves the background-music conflict |

## 5. Verified data facts that change the options

- GIBS colormaps are **binned**: SST 0.15 °C bins; ice-concentration 1 % bins [verified: https://gibs.earthdata.nasa.gov/colormaps/v1.3/GHRSST_Sea_Surface_Temperature.xml]. Side B must say "binned", never "exact".
- GIBS sea ice: `MODIS_Terra_L3_Sea_Ice_Daily`, 2000-02-24 → 2026-11-04 with gaps, **ice / not-ice classification** [verified: https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/1.0.0/WMTSCapabilities.xml; facilitator re-checked locally]. So the ice story from frames starts in **2000, not 1979**, and extent = count of ice pixels (the brief's "pixel density").
- `AMSRU2_Sea_Ice_Concentration_12km`: percent, 2012-07-02 → 2025-09-01 only [verified: same].
- `GHRSST_L4_MUR_Sea_Surface_Temperature`: 2002-06-01 → 2026-11-04 with gaps, 1 km [verified: same]. Mauritius tile coverage: [unverified].
- NSIDC monthly September extent CSV exists at a no-login HTTPS path [verified: https://noaadata.apps.nsidc.org/NOAA/G02135/north/monthly/data/]; contents not opened [unverified].
- Sea level: no verified route → Red. Option 4 is considered **SST-only**.

## 6. Top 2

1. **Option 1: One Story, Two Ears** (30.2): highest on Validity, Presentation, Feasibility, Accessibility. Weak on Influence and "selecting a visualization".
2. **Option 4: Hold the Ocean (SST only)** (26.2): highest Influence and Presentation in a tie, the only clearly novel feature (coast duet), and the Local Impact award. Weak on Validity (2.8): duet contrast unproven, tile coverage unchecked.

Option 3 (27.0) is excluded by the gate (Feasibility 2.8); its Year slider is cross-bred instead.

## 7. ICE on the top-2 features (product-lens Mode 4: impact × confidence ÷ effort)

| # | Feature | From | I | C | E | ICE | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| a | Silence map: no data = rest + "no data, not zero" text | 1 | 4 | 4 | 1 | **16.0** | Carries |
| b | "What the sound hides" limits slide/scene | 1 | 3 | 5 | 1 | **15.0** | Carries |
| c | Side A / Side B on the same frames (switch) | 1 | 5 | 4 | 2 | **10.0** | Carries |
| d | Reference tone on demand | 1 | 3 | 3 | 1 | 9.0 | Carries |
| e | Year slider + spoken value (cross-breed) | 3→1 | 4 | 4 | 2 | 8.0 | Carries |
| f | Frame-pixel extent vs NSIDC cross-check number | 1 | 4 | 4 | 2 | 8.0 | Carries |
| g | Sound postcards (QR → clip + caption) | 4 | 2 | 4 | 1 | 8.0 | Cheap extra |
| h | Measured blind-user test result | 1 | 5 | 3 | 2 | 7.5 | Carries (tester not booked) |
| i | Mauritius SST time dial | 4 | 4 | 3 | 2 | 6.0 | Carries Option 4 |
| j | Mauritius close inside the same player | 4→1 | 4 | 3 | 2 | 6.0 | Carries the merge |
| k | Preset A/B scene (cross-breed) | 5→1 | 3 | 4 | 2 | 6.0 | Nice to have |
| l | Static cited Q&A (~20–40 answers) | 0→1 | 3 | 4 | 2 | 6.0 | Carries |
| m | Quantised column-scan bar | 2 | 3 | 3 | 3 | 3.0 | Padding unless cheap |
| n | Coast duet (nearshore vs offshore SST) | 4 | 4 | 2 | 3 | 2.7 | Padding until data shows contrast |
| o | Pick-from-menu GIBS live bonus | 0 | 4 | 2 | 4 | 2.0 | Stretch |
| p | 20 s sequential medley | 0 | 2 | 3 | 3 | 2.0 | Stretch |
| q | Live ADK Narrator (open questions) | 0 | 3 | 2 | 4 | 1.5 | Stretch |
| r | Aim the Earth (device orientation) | 3 | 3 | 1 | 4 | 0.75 | Cut |

Scores are the facilitator's, from the Round 3 critiques. **Option 1 is carried by a, b, c, f, h; Option 4 by i alone.** Its signature feature (n, the duet) is padding until real data shows the contrast.

## 8. Architect position (facilitator, written before the council voices)

**Position:** Build Option 1 as the core and merge Option 4 in as its closing "here" chapter, using the same player and pipeline with one Mauritius SST layer. Gate it on a day-1 data check; the coast duet is a stretch.
**Three reasons:** (1) Option 1 wins on four of seven criteria and passes every gate; (2) Option 4's strength (place, emotion, Local Impact) costs little on Option 1's engine, but its weakness (Validity) would sink it as the core; (3) both use the same GIBS→binned→JSON pipeline, so the merge adds one layer, not a second product.
**Main risk:** the ice story now starts in 2000 (MODIS classification), not 1979. That cuts the "45 years" drama and puts weight on a pixel-count extent that must match NSIDC. If the match is poor, Option 1's Validity lead shrinks, and frames stop being the foundation of the melody.
