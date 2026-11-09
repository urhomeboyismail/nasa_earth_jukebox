# Santa review C, round 3 (independent)

TL;DR: The data facts I checked are accurate, and the rules, feasibility and screen-reader columns hold up. One material gap fails the review: FINAL never ties its GIBS frames to an EIC visualization, but the challenge is built on EIC frames.

```json
{
  "verdict": "FAIL",
  "checks": [
    {
      "criterion": "1. Facts tagged and verified",
      "result": "FAIL",
      "detail": "The spot-checked facts are correct. GIBS time dimensions in the local capabilities file match FINAL. Ice gaps: 2000-08-06..17, 2001-06-16..07-02, 2002-03-20..27, 2002-04-15, 2003-12-17..23, 2008-12-21..22, 2016-02-19..27, 2022-10-11..22, 2026-02-09. None falls in a September. MUR gaps are exactly 2021-02-20/21, 2022-11-09, 2023-02-02/03, 2023-04-22, 2024-07-02. Both layers end 2026-11-04 and use TileMatrixSet 1km. Level 3 is 10x5 tiles of 512 px (0.0703 deg per pixel). Level 6 tile 24/52 covers 18-22.5 S and 54-58.5 E. MODIS_L3_Sea_Ice.xml: only Sea Ice (255,100,100, value 200) is opaque. GHRSST colormap: 0.15 C bins, last finite bin [31.80,32.00) = 0.20 C, both ends open. The NSIDC CSV has 48 rows, no missing values, row 2012 = 3.57/2.41, and 2025-26 come from NSIDC-0803. The NSIDC citation matches nsidc.org/data/g02135. FAIL reason: the central data decision (§4, 'What frames are the foundation means here'; §2 'fetches NASA GIBS map frames') rests on an untagged, unverified implied claim: that GIBS daily tiles count as the 'EIC visual frames' / 'specific EIC visualization' the challenge requires (challenge.md lines 6, 16, 28; CLAUDE.md 'challenge in five lines' #1). FINAL mentions EIC only in the Cut list. No r5 file or ADR mentions EIC, earth.gov or SVS. Nothing shows that an EIC visualization exists for Arctic sea ice or MUR SST, or that one uses these layers."
    },
    {
      "criterion": "2. Space Apps rules met",
      "result": "PASS",
      "detail": "NASA data is documented with layer IDs, date ranges, colormap URLs and credit lines (§4). It says 'Text only, no NASA logos' and 'never frames with embedded logos'. An AI-use disclosure is present. The 30 s video has subtitles on every line, and a 7-slide deck is outlined. Static hosting with no login and no runtime API key is stated, and the frontend/a11y owner checks the logged-out load before hour 40. Minor: the 'GitHub Pages or similar [assumption]' tag is overcautious. Credits for third-party code are missing (see suggestions)."
    },
    {
      "criterion": "3. Feasibility >= 3 for every core feature",
      "result": "PASS",
      "detail": "All 8 core features score 3-5. The scores match r5/tech-architect.md §6. The plan has an hour-6/24/40 critical path, a cut order that keeps a working demo at each step, and a SST fallback if Test A gives no verdict by hour 6. The about 1,900-tile Test A fetch is sized. The rate limit is honestly [unverified]. The 150 h vs 250 h budget rests on an [assumption] because the team table is empty. That is acceptable but should be re-checked once the table is filled."
    },
    {
      "criterion": "4. Every core feature usable with a screen reader on",
      "result": "PASS",
      "detail": "Every core row has a screen-reader column with native controls (radio, role=switch with a constant label, range + aria-valuetext, buttons, data table as the marker equivalent). The desk-review status and the assumptions are disclosed. §2 rules match features 3 and 6 and the demo: gaps fade, then one message, then Continue. Small inconsistency, not a fail: feature 5 says 'audio and speech debounced 400 ms' on scrub, while §2 says scrubbing never pauses and only updates aria-valuetext. So a scrub tone may sound over the screen reader reading the valuetext. That is in tension with CLAUDE.md rule 7, 'sonification pauses while the voice speaks'."
    }
  ],
  "critical_issues": [
    "EIC link missing (fails criterion 1; Relevance risk). The challenge asks for sonification of 'NASA's EIC visual frames' and for a user who 'selects a specific EIC visualization'. FINAL swaps in GIBS map tiles and never says which EIC visualization each story pairs with, or whether one exists. It does not justify the swap either. Fix: for each story (ice, SST, Mauritius), name the matching EIC (earth.gov) or SVS visualization with a [verified: url], or add a one-line tagged rationale that GIBS imagery is the source data behind an EIC visualization. Then state it on slide 3 and the project page. If no EIC match can be verified, say so plainly and log the decision with its dissent."
  ],
  "suggestions": [
    "Hard rule 4 for the ice story. In the composite, cloud, night and missing pixels are transparent, so they count as 'not ice'. Unseen data therefore lowers the pitch instead of becoming a rest. The rule 'null only where GIBS publishes no frame' means a fully clouded week still plays a confident note. Add a per-step coverage_pct (tech-architect §6 already proposes it) with a written threshold: below it, the step is a rest, or a low-confidence reading announced in its text twin. Late-September polar night makes this worse, so name the 7 days.",
    "Feature 5 vs §2: say whether a scrub plays a tone. If it does, either delay the tone until after the valuetext change or state that rule 7 has a deliberate exception for user-triggered single notes.",
    "Credits: CLAUDE.md asks that all other code be credited. Add Tone.js (MIT) and the Python libraries to the credit lines and slide 7, not only the data sources.",
    "Video 15-21 s says 'the voice and text say No data. Not zero.' App TTS is off by default. State whether that voice is a pre-recorded WAV, the screen reader, or a narration overlay, so the video does not show a mode the default app lacks.",
    "Feature 1: if Test A fails, say whether ice stays in the radio menu (as the limits example) or the menu has one item. The '1 of 2' announcement depends on it.",
    "Rule 7 'natural sounds for rare events' is not addressed anywhere. Either say gaps and key moments use earcons on purpose, or add the rule's exception to §2.",
    "The AI disclosure names 'Sonnet and Haiku subagents'. Confirm the models actually used before submission, because the disclosure is a factual claim."
  ]
}
```

Weakest point of my own review: I checked four web sources and the local capabilities file. I did not check the GISTEMP, MUR or vOICe citations, Tone.js 15.1.22, or the caniuse claim. My EIC finding rests on the challenge wording. It could be softened if the 2026 judging guide accepts any NASA Earth imagery as 'EIC frames' [unverified].
