# Santa review C, round 1: FINAL.md

TL;DR: FAIL. The ice layer's own colormap makes "no data" and "not ice" the same transparent pixel, so the ice story's strict mode and its silence beat rest on a claim the verified source contradicts.
Other problems: the "3 pre-tested layers" core feature rests on an untested layer, Test A's day-1 data pull has no size estimate, and the screen-reader column gives no "how" for 3 features.

Spot-checked URLs (2026-11-06): NSIDC N_09_extent_v4.0.csv (48 rows, 2012 row matches, no units: confirmed), MODIS_L3_Sea_Ice.xml (see issue 1), GHRSST_Sea_Surface_Temperature.xml (0.15 °C bins, a single explicit nodata entry, 255,153,0 = [24.60,24.75): confirmed), Tone.js releases (15.1.22 marked Latest: confirmed).

```json
{
  "verdict": "FAIL",
  "checks": [
    {
      "criterion": "1. Facts tagged and verified",
      "result": "FAIL",
      "detail": "(a) The verified colormap https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_L3_Sea_Ice.xml marks Missing Data (nodata), No Decision, Night, Land, Inland Water, Ocean, Cloud, Land Mask, Ocean Mask and Fill ALL transparent=true. Only Sea Ice (255,100,100) is opaque. A PNG tile therefore cannot tell open ocean ('not ice') from cloud or missing data. FINAL still claims the opposite: §8 video 10-15 s says 'Ice or not ice, pixel by pixel'; §2 and §4 say gaps are written as null; feature 3 says 'gap = rest'. For the ice story the only nulls possible are whole missing dates, and every transparent pixel would be counted as 'not ice'. That treats cloud and missing data as zero, which breaks hard rule 4. FINAL's '(cloud, land, night transparent)' is true but incomplete: it leaves out that ocean and nodata are transparent too. (b) Core feature 1 says '3 pre-tested GIBS layers', but §4 tags the third layer (AOD) 'No tile fetched yet [unverified]', and open question 3 may replace it. The word 'pre-tested' is false as written. (c) 'The island itself is masked' (§4) is an inference from one transparent pixel (data-scout §3: 'fits the island being land-masked'). It carries no tag. (d) The 'no-data year' in the video silence beat (§8, 15-21 s) is not shown to exist. No source shows a missing September in the MODIS series, and multi-day composites make a whole-year gap less likely. The signature beat rests on an untagged assumption that is not labelled as a test. Otherwise tagging is good: NSIDC units are correctly marked [unverified] and kept out of any decision, the Test A thresholds are tagged [assumption] and framed as a test, and the 2026 guide dates are [unverified]."
    },
    {
      "criterion": "2. Space Apps rules met",
      "result": "PASS",
      "detail": "NASA data documented: §4 gives layer IDs, date ranges, colormap URLs and credit lines (GIBS/ESDIS, NSIDC DOI, MUR DOI, GISTEMP + Lenssen 2024). No NASA branding: text-only credits, GIBS tiles only, no logo frames. AI-use disclosure: present (§ AI-use disclosure, slide 7, end card). A ≤30 s video with subtitles and 7 slides are both scripted. Public no-login link: static host, no runtime API key. Minor gaps (see suggestions): no dataset citation for the MODIS AOD product if it ships; the host is not named; the disclosure is generic and only promises a build-time list."
    },
    {
      "criterion": "3. Feasibility >= 3 for every core feature (stated and credible)",
      "result": "FAIL",
      "detail": "All 8 features carry tech-architect scores of 3 or more. Two are not credible as written. (a) Feature 3 (silence map), score 4, assumes per-pixel or per-year nulls. For the ice story the colormap cannot produce spatial nulls (issue 1), so the feature works only on SST, or only if a real missing date exists. (b) The critical path starts with Test A in hours 0-6. It needs ice-pixel counts for every September 2000-2025 (about 26 years), across several days each, over the whole Arctic, from EPSG:4326 WMTS tiles. FINAL never states the zoom level, tile count, download time or GIBS rate limits (data-scout: 'No licence or rate-limit statement on the page'). 'Area-weighted (or polar-projected)' is left open, and no polar-projection endpoint is verified. At level 6 the Arctic north of 60°N is roughly 7 rows × 80 columns per day. At lower zoom, GIBS overview resampling may change pixel counts. The story choice rests on an untested and unsized 6-hour job. (c) Feature 1's 'menu of 3' depends on an untested AOD layer. The cut order (step 4, menu of two) is a fallback, but the scored feature as specified is not yet known to be buildable."
    },
    {
      "criterion": "4. Every core feature usable with a screen reader (stated per feature, with how)",
      "result": "FAIL",
      "detail": "The §3 table gives a verdict for all 8 features, but features 1, 4 and 6 say only 'yes' with no how (radio group read as '1 of N', Play/Test sound button, answers in the live region with citation ID). That detail exists only in r5/accessibility-lead.md, not in FINAL. FINAL also leaves out the mechanism that makes speech and sound coexist with the user's own screen reader. The rule 'fade sound out in 150 ms, write text, resume only on Play or Continue, never a timer' (accessibility-lead §0) is needed for hard rule 7 ('sonification pauses while the voice speaks'), because the app cannot detect when NVDA or TalkBack finishes speaking. Without it, feature 2 and the key moments will talk over the sound. Every verdict is a desk review, and several rest on [assumption]s: TalkBack and VoiceOver double-tap sending a real click, role=switch in Safari, and the iOS silent switch. The table shows 'yes' without saying it is untested."
    }
  ],
  "critical_issues": [
    "Ice colormap contradiction (rule 4 and Validity): in MODIS_L3_Sea_Ice.xml, Ocean, Cloud, Night and Missing Data are all transparent, so 'not ice' and 'no data' are the same pixel. Remove 'Ice or not ice, pixel by pixel' from the video and Side B text. Redefine the ice value as 'ice pixels seen' and announce coverage as unknown. Allow silence only for dates with no tile. Or make SST (which has an explicit nodata entry) carry Side B strictness and the silence beat. If a separate verified cloud or no-data product exists, cite it before relying on it; do not assume one.",
    "The silence beat (the demo's signature moment) has no verified real gap for the ice story. Add a day-1 check (Test C, hour 0-6): list the actual missing dates and years in the chosen series. Make the video's 15-21 s beat conditional on the result, falling back to the Mauritius land-mask rest only if Test B passes.",
    "Test A is not sized: no zoom level, tile count, request budget, or polar-versus-4326 choice, and the GIBS rate limit is unverified. Because Test A decides the main story by hour 6, specify the pull (level, bbox, days per September, number of tiles) and verify the rate limit, or use a verified single-request route. Otherwise set an earlier fallback trigger, such as 'no verdict by hour 6 = SST main'.",
    "Core feature 1 claims '3 pre-tested layers' while the third (AOD) has no tile fetched and is an open question. Either change the wording to '2 tested + 1 pending' or fetch and decode an AOD tile before calling it core.",
    "The FINAL spec leaves out the speech/sound pause rule and the per-feature screen-reader 'how' for features 1, 4 and 6. Copy the accessibility-lead §0 rule and a one-line 'how' per feature into §3, and mark all verdicts as untested desk review."
  ],
  "suggestions": [
    "Tag 'the island itself is masked' as [assumption] (inferred from one transparent pixel), or verify it against the MUR land mask.",
    "§4 says every note comes from 'the displayed GIBS frame', but the ice value comes from a multi-day September composite that the team builds itself. Say so, and show that composite (not a single GIBS day) as the sighted frame, with the composite method in alt text.",
    "Define how a multi-day composite is made: union, majority vote or per-day mean. A union of days inflates ice where ice drifts.",
    "Add a dataset citation for MODIS Terra AOD if it ships; the GIBS acknowledgement alone does not cite the product.",
    "Name the static host and confirm the public URL loads with no login before hour 40 (submission requirement).",
    "Make the AI-use disclosure specific at submission: tools and models used for code, audio and voice lines, not only 'Claude subagents'.",
    "The video opens on 'a hand on a phone', while the primary rig is laptop + NVDA. Make sure the filmed device is the rehearsed one, or say which.",
    "accessibility-lead's examples ('Years 1990-1992: no data', '3.6 million km2') fall outside the MODIS record or use NSIDC units that are not verified. Make sure they never reach story.json or aria-valuetext."
  ]
}
```

Weakest point of my own review: I did not compute the actual Arctic tile count or check whether GIBS offers a polar (EPSG:3413) endpoint for this layer, so the Test A sizing concern is a missing estimate, not a proven blocker. Issue 1 rests on the colormap alone. I did not check whether GIBS publishes a companion no-data or cloud layer for MODIS sea ice that could fix it.
