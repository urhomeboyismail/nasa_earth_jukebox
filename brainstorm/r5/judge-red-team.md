# R5 Final mock judging: "One Story, Two Ears" + gated Mauritius close

TL;DR: Strong on Presentation, Validity and Accessibility by design. Pass case beats Round 3 on Influence (3 to 4); fail case equals Round 3 minus one Presentation point.
Fatal-flaw candidate: no blind tester booked, so the Accessibility and Presentation claims are self-scores. Fix: book one tester now, report an honest small-n result.

## Guide check
Search on 2026-11-06: no 2026 Judging & Awards Guide or Submission Guide found. A third-party listing says both are due 13 Nov 2026, submissions open 14 Nov, judging from 16 Nov `[unverified: third-party listing]`. The 2025 submission guide names the first criterion "Impact", not "Influence", and requires a Project Demo; max team size 6 `[unverified: search summary of https://www.spaceappschallenge.org/resources/project-submission-guide/]`. A 2024 guide note says "Create Your Own Challenge" projects are not eligible for Global Judging `[unverified]`; we answer an official challenge, so fine. Re-check on 13 Nov: demo length (30 s video or 7 slides), AI-use wording, criteria names.

## Scores

| Option | Influence | Creativity | Validity | Relevance | Presentation | Feasibility | Accessibility |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Winner (both tests pass) | 4 | 4 | 4 | 4 | 5 | 4 | 4 |
| Winner (Mauritius test fails) | 3 | 4 | 4 | 4 | 4 | 5 | 4 |

(Round 3 Option 1: 3 / 4 / 4 / 4 / 5 / 5 / 4.)

- **Influence:** Pass 4: a Mauritian hears her own sea, plus a general method (honest sound, silence for gaps) others can copy. Fail 3: one Arctic story, narrow.
- **Creativity:** 4 both. Audible silence for no-data and "what the sound hides" are fresh. Side A/B is craft, not a new idea.
- **Validity:** 4 both. Binned colormaps stated, cross-check vs NSIDC, limits scene. Not 5 because pixel-count extent is unproven.
- **Relevance:** 4 both. Frames to sound is literal; "selecting" is a 3-item menu (thin but present).
- **Presentation:** Pass 5: silence beat plus a local close. Fail 4: no emotional close; the beat still works. A 5 needs the tester result.
- **Feasibility:** Pass 4: two kill tests, QA of two layers, six students unknown. Fail 5.
- **Accessibility:** 4 both. Strong design (switch, live regions, text for everything). Capped at 4 until a real blind user tests it.

**Validity sub-scores (data/evidence, analysis, results, limitations):** Pass 4/3/3/5. Fail 4/3/3/5. Data is verified GIBS layers; analysis is 3 until the tolerance test runs; results are 3 because no outcome is measured yet; limitations are 5 (binned, 2000 start, gaps, "what the sound hides").

## Brief check
- Frames as foundation: yes, if Test A passes. Sighted view with moving marker shows frame to sound.
- Selecting a visualization: weak but real (3-layer menu).
- Musicality vs data: the core of the design (A musical, B strict).
- Accessibility: strong. Every gesture has a button; everything spoken is also text.

## Rule check
- NASA data documented: GIBS layer IDs `[verified: https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/1.0.0/WMTSCapabilities.xml]`; list every layer, NSIDC G02135 (NOAA/NSIDC, not NASA, so say so) and GISTEMP if used.
- No NASA branding: no logos, patches or "NASA-approved" wording. Do not use GIBS tiles with embedded logos.
- AI disclosure: code, any generated audio or text, Q&A drafting. Must be written, not implied.
- Demo: one beat (silence map) fits 30 s with English subtitles, but the audio-first demo must be captioned and described in text. 7-slide fallback is easy.
- Public link, no login: static host; Q&A must be pre-written (no API key or login). Check that no Earthdata login is needed at runtime (pre-computed JSON).

## The 10 hardest questions

1. **Why not just read the chart aloud?** A read-aloud gives numbers one by one. Sound lets you hear the shape of a decade in seconds and hear where data is missing. Honest limit: we do not claim it beats a good description; we offer both, and Side B is the strict version. Our tester result (if we have it) is the evidence; otherwise say we have not measured it `[assumption]`.
2. **Why only from 2000?** The MODIS ice layer starts 2000-02-24 `[verified: GIBS WMTS capabilities]`. Longer records (1979 on) exist in NSIDC, but they are not a frame in the EIC/GIBS layer. We say it on screen.
3. **What does binned mean?** GIBS colormaps map colours to value ranges. SST uses 0.15 °C bins; ice concentration 1 % bins `[verified: https://gibs.earthdata.nasa.gov/colormaps/v1.3/GHRSST_Sea_Surface_Temperature.xml]`. Two values in the same bin sound identical. Side B says "binned to N colours".
4. **Did a blind person test it?** Say exactly what happened: N people, what task, what they said. If none, say "not yet" and name the planned test. Never imply a result. Small n is fine; a made-up n is fatal.
5. **How are frames the foundation of the sound?** Every note comes from pixels of the displayed GIBS frame (ice pixel count, colour bin to pitch). The sighted view shows the marker on the frame. The Q&A text is separate and cited.
6. **How do you know ice pixel counts equal sea-ice extent?** We checked against NSIDC G02135 September extent within a tolerance set before looking. Report the actual error. Lat/lon grids distort polar area; we area-weight (or use a polar projection). If the check fails we say so and demote the claim `[assumption until Test A runs]`.
7. **What does the sound hide?** The "hides" scene: a preset mapping where the change is inaudible, next to one where it is clear. Also binning, cloud gaps and the 2000 start.
8. **What happens where there is no data?** Silence, plus "no data, not zero" in an `aria-live` line. We never fill gaps. Low confidence is announced.
9. **Is the Narrator an AI making things up?** No: ~20-40 pre-written answers, each tied to a fact ID; uncited means not spoken. Any live agent is optional and is disclosed.
10. **Why Mauritius, and is the sea there really warming?** The close shows MUR SST for our tile (2002-06-01 on, 1 km) `[verified: GIBS WMTS capabilities]`. We state only what the tile shows; one location is not a climate trend; we make no attribution claim. If the tile gives no usable range, we cut it (Test B).

## Fatal-flaw candidate and fix

**Flaw:** no blind or low-vision tester is booked. Without one, the strongest answer to Q1 and Q4 does not exist, Accessibility stays a self-score, and "Presentation 5" falls to 4.
**Fix:** by hour 0 of the build, book 1-3 testers (local blind association or university contacts; a booking task, not a build task). Write 3 tasks ("find the year with least ice", "find where data is missing", "tell binned from exact") and a one-line honest result with n. Runner-up risk: Test A failing on cloud gaps and polar-grid area distortion; the already agreed fallback (SST main story) covers it.

Weakest point of my own review: Scores for Validity and Presentation assume the kill tests pass and a tester is found, and I could not read the 2026 guides, so the criteria weights and demo rules are `[unverified]`.
