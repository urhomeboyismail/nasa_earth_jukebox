# Santa review C, round 2: FINAL.md

TL;DR: The facts, rules and feasibility hold up. I checked the GIBS capabilities, two colormaps and the NSIDC CSV myself. One material contradiction remains: the global pause rule clashes with the silence beat and continuous playback, so the screen-reader behaviour of core feature 3 is undefined. Verdict: FAIL on criterion 4 only.

```json
{
  "verdict": "FAIL",
  "checks": [
    {
      "criterion": "1. Facts tagged and verified",
      "result": "PASS",
      "detail": "Independently re-checked: (a) Local GIBS capabilities XML. MODIS_Terra_L3_Sea_Ice_Daily is 1km, PNG, 2000-02-24 to 2026-11-04. Its gaps are 2000-08-06..17, 2001-06-16..07-02, 2002-03-20..27, 2002-04-15, 2003-12-17..23, 2008-12-21..22, 2016-02-19..27, 2022-10-11..22 and 2026-02-09, so none falls in September, as claimed. GHRSST_L4_MUR_Sea_Surface_Temperature gaps are exactly 2021-02-20..21, 2022-11-09, 2023-02-02..03, 2023-04-22 and 2024-07-02, from a 2002-06-01 start, as claimed. AOD starts 2000-02-24 with gaps, as claimed. (b) TileMatrixSet 1km, level 3, is 10 x 5 tiles of 512 px. 27954113 x 0.00028 / 111319.5 gives 0.0703 deg per pixel and 36 deg tiles, so the top row is 54-90 N. 10 x 7 x 27 = 1,890. Level-6 tile 24/52 spans 18-22.5 S, 54-58.5 E, which covers Mauritius. (c) MODIS_L3_Sea_Ice.xml: only ref 7 (255,100,100, value 200, 'Sea Ice') is transparent=false. Missing Data, Cloud, Night, Ocean and Fill are all transparent, so the 'ice seen = lower bound' claim is correct. (d) GHRSST colormap: 0.15 deg C bins plus an explicit nodata entry (ref 0, legend 'No Data'). (e) The NSIDC N_09 CSV has 48 rows, 1979-2026, no gaps. The 2012 row reads '2012,9,NSIDC-0051,N,3.57,2.41' and the 2025-26 rows come from NSIDC-0803, all as claimed. Unverified items (rate limit, NSIDC units, host, iOS silent switch, 2026 guide date, Navigator API, Test A thresholds) are tagged, and no core decision rests on them; the main-story choice rests on Test A, which is allowed. Only minor tagging gaps remain (see suggestions)."
    },
    {
      "criterion": "2. Space Apps rules met",
      "result": "PASS",
      "detail": "NASA data is documented with layer IDs, date ranges, colormap URLs and credit lines (GIBS acknowledgement, MUR DOI, GISTEMP with Lenssen 2024; the NSIDC citation is required and present). The AOD citation is deferred only if that layer ships. No branding: text credits only, GIBS tiles without embedded logos. An AI-use disclosure is present and promises a build-time list on slide 7 and the project page. The 30 s video shot list has subtitles on every line and fits 30 s. The 7-slide outline is given. The public link is a static host with a 'confirm logged-out before hour 40' step and no runtime API key."
    },
    {
      "criterion": "3. Feasibility >= 3 for every core feature",
      "result": "PASS",
      "detail": "All 8 core features score 3-5, and features 7 and 8 sit at the gate, first in the cut order. The claim is credible: no runtime LLM, a static app, a single Tone.js voice and a pre-computed JSON. Test A is about 1,890 small tiles, which finishes in minutes even when throttled. There is a hard hour-6 fallback to SST and a ~150 h build against ~250 h available (tagged assumption, team table empty). The never-cut set is small."
    },
    {
      "criterion": "4. Every core feature usable with a screen reader on",
      "result": "FAIL",
      "detail": "Each feature has a screen-reader column, but the 'how' for the centrepiece contradicts itself. Section 2 makes the pause rule apply to all features: 'Before any text message: fade sound out in 150 ms ... resume only when the user presses Play or Continue.' Section 2 also says 'Every sound has a text twin in one aria-live region.' Feature 3 then says 'Pause rule applies; the live line is written at the gap. The continuing click ... signals \"not crashed\".' Taken literally, (a) playback stops after every note, because every note has a text twin and every text message pauses, and (b) at a gap, sound fades out and waits for Continue, so a screen-reader user never hears the click continue through the gap. That click is the very cue Risk 5 and video 15-21 s rely on. Sighted viewers of the video would get the continuing click while the blind user in the product gets a stopped app. The source spec (r5/accessibility-lead.md, lines 10 and 20) used 'sound stops + earcon', which FINAL replaced with 'click continues' without reconciling it with the pause rule. The never-cut items (silence rest + text, pause rule) are therefore not implementable as written for the core audience."
    }
  ],
  "critical_issues": [
    "Pause rule vs silence beat and playback (sections 2 and 3, feature 3; Risk 5; video 15-21 s): define which text triggers the pause. Proposed fix: (1) Per-step text twins are NOT written to the live region during Play. They are available on demand via 'Where am I', the slider valuetext and the data table, so playback runs continuously. (2) At a gap, the click plays through the whole missing run. When the gap ends, sound fades, one message is written ('2023-02-02 to 03: no data, not zero'), and Continue resumes. Alternatively, write the message at gap start without pausing, because there is no data voice to collide with, only the click. Pick one, and state it in the pause rule and in the feature 3 row. (3) The pause rule then applies to user-initiated text (answers, Where am I, reference-tone explanation) and to gap messages only. Add the chosen behaviour to tester task 5."
  ],
  "suggestions": [
    "The AI disclosure says 'All facts were checked against the tagged sources'. That overclaims, because several facts are tagged [unverified]/[assumption]. Reword to 'Facts marked verified were checked against the cited sources; unverified items are labelled.' Also confirm that the model list (Opus / Sonnet / Haiku) matches what was actually run.",
    "Section 4 SST row: 'Tile 2020-06-15/1km/6/24/52 has valid ocean pixels near Mauritius' is untagged in FINAL. Add [verified: by download, r5/data-scout.md section 2]. Also note that data-scout found only 49% opaque pixels in a 60x60 window centred on the island, which is why Test B must centre on an offshore point.",
    "The GHRSST bins are 0.15 deg C except the last finite bin [31.80, 32.00), which is 0.20, plus the open-ended bins below 0 and above 32 deg C. This is harmless for Mauritius (about 22-28 deg C), but the Side B line 'binned to 0.15 deg C' should be computed from the colormap per value, not hard-coded.",
    "Test A 'slope within 15%' compares a pixel-area series with NSIDC extent, whose units are [unverified], and the 'ice seen' lower bound will be systematically smaller. Specify the slope as a relative trend (% of the series mean per decade), or rely on rank correlation alone, so the test is unit-free and is fixed before data is seen.",
    "The 3-minute live demo at 2:15 says 'judge picks one of the cached layers'. A judge-picked layer is listed as a Stretch feature. Either relabel this step as 'judge picks from the story radio group (feature 1)' or mark it as stretch-only with a fallback.",
    "Rule 7 asks for 3-5 key moments per story. story.json lists 'key moments', but FINAL never states the count or how they are chosen. Add one line.",
    "The GIBS PNGs may be palette-indexed. If the palette indices survive in the tile (only the alpha is transparent), Cloud, Night and Ocean could still be told apart, which would remove the lower-bound limitation. Add a 5-minute check to Test A: read the PNG mode and palette index of the transparent pixels.",
    "vOICe [verified] URL and GISTEMP column 'J-D' were not re-checked by this reviewer; they are not decision-bearing."
  ]
}
```

Weakest point of my own review: I failed criterion 4 on a spec contradiction rather than on a missing feature. A charitable reader could take 'text message' to exclude per-step twins. However, the silence beat is the never-cut centrepiece, and FINAL explicitly says the pause rule applies at the gap, so I treated it as material.
