# R3 Critique: tech-architect

TL;DR: Only Options 1 and 2 clear the feasibility gate comfortably; Option 3 and 5 pass narrowly, Option 4 only if it drops Earthdata-login data, Option 0 fails.
Shared rule: pre-compute everything offline into small JSON; the browser plays it with Tone.js (static host, no required backend). Assumes six generic students, ~48 h, ~250 usable person-hours.

| Option | Influence | Creativity | Validity | Relevance | Presentation | Feasibility | Accessibility |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 Baseline | 4 | 4 | 2 | 4 | 4 | 1 | 4 |
| 1 One Story, Two Ears | 3 | 3 | 5 | 4 | 4 | 5 | 5 |
| 2 Frame Jukebox | 3 | 3 | 4 | 5 | 4 | 4 | 4 |
| 3 Time Under Your Finger | 4 | 5 | 3 | 4 | 4 | 3 | 4 |
| 4 Hold the Ocean | 4 | 4 | 3 | 4 | 5 | 3 | 3 |
| 5 Tune Your Own Earth | 3 | 4 | 3 | 4 | 3 | 3 | 5 |

## Per option

**0 Baseline.** ~600+ h (live CV, Navigator integration, ADK x2, touch, haptics, 5 voices, Symphony). Critical path: live mode reading legends from arbitrary video (SVS frames are often EXR/TIFF, some pages only MP4 [verified: https://svs.gsfc.nasa.gov/help/]) plus the unverified Navigator API [unverified]. Fatal flaw: scope is 2.5x capacity and the headline feature fails on stage if a judge picks an unprepared visualization. Fix: cut to GIBS-only live, no CV, no Composer LLM. Raises feasibility: a verified Navigator contract, or dropping Navigator.

**1 One Story, Two Ears.** ~130 h. Critical path: colormap-to-value lookup for one GIBS sea-ice layer and the home-pitch audio engine. Fatal flaw: GIBS colormaps give value ranges, not exact values [verified: https://nasa-gibs.github.io/gibs-api-docs/access-advanced-topics/], so "strict" mode is binned. Fix: label it "binned", and cross-check the headline numbers against NSIDC G02135 [verified: https://nsidc.org/data/g02135]. Raises feasibility: confirm the sea-ice GIBS layer ID on hour 1 [unverified]. Risk beyond tech: low wow factor; a booked blind tester is the real critical path.

**2 Frame Jukebox.** ~190 h. Critical path: column-scan engine (row to pitch, colour to loudness, no-data to rest) on GIBS tiles plus arrow-key stepping. Fatal flaw: fire frames from SVS 5113 are TIFF/EXR needing offline conversion, and per-frame scan of a 2D map is unmusical (raw pixel noise) [assumption]. Fix: GIBS-only layers, downsample to ~64 columns x 32 rows, quantise to a scale. Raises feasibility: drop the SVS fire frames and the crossfade for v1.

**3 Time Under Your Finger.** ~260 h. Critical path: a regional grid x years cube built from GIBS or gridded data, with a fact-ID-gated Narrator. Fatal flaw: GIBS gives imagery by date, not 40 years of values; reconstructing a time series per place means ~40 colormap-decoded tiles per layer, and a hole in any year is silence [assumption on layer date coverage]. Fix: use GISTEMP gridded or a coarse 12x6 grid, 5-year steps. Torch pointing needs device-orientation permissions; iOS requires a user gesture and Android heading is noisy [unverified]. Fix: make it a stretch goal; sliders are core. Raises feasibility: one verified gridded source with a date range, chosen on hour 2.

**4 Hold the Ocean.** ~170 h if GIBS-only, ~230 h with Earthdata login. Critical path: SST source. MUR starts in 2002 so "30 years" is false [unverified; date range needs checking]. Fatal flaw: Amber data plus the nearshore/offshore duet needs a pixel-level coast mask; Mauritius is a ~2000 km2 island, so coarse grids may have nearly no nearshore pixels. Fix: choose offshore boxes by hand, state the resolution aloud, say "24 years" until verified. QR postcards are cheap (static clips). Raises feasibility: confirm the data pull works on hour 1, with a fallback of a pre-cached JSON.

**5 Tune Your Own Earth.** ~220 h. Critical path: an accessible mapping editor (form controls, live A/B re-render). Fatal flaw: free choice of mapping lets users create misleading sonifications, and the validation burden moves to us; unusable defaults make the demo noise. Fix: 3 curated presets and 3 sliders, not a free editor, each with a text description. Raises feasibility: freeze the mapping schema as a small JSON in the first 6 h.

## Cross-cutting calls

- Stack: static PWA, Tone.js, Web Speech API TTS as a fallback. Drop ADK Composer (rules are deterministic). Narrator only if grounded by fact IDs; a pre-written text file is a safe fallback and meets rule 5 more easily.
- Vibration: Android Chrome only [verified: https://caniuse.com/mdn-api_navigator_vibrate]. Never core.
- Facilitator's laptop+NVDA idea: technically the safest. Keyboard and ARIA sliders avoid mobile gesture conflicts. Supports it.
- Hours 6/24/40 for the best pick (1 or 2): 6 = one layer decoded to JSON and one tone played; 24 = Side A/B and the keyboard flow work; 40 = tester feedback in and the video recorded.
- Stage failure: no internet means pre-cached JSON and bundled audio; no TTS means text live region only.

## Recommendation

Build Option 1's engine with Option 2's column scan as the "explore" mode. Both share the same GIBS-to-JSON pipeline, so the cost is about 200 h. Option 3 and 4 are stretch layers on top.

Weakest point of my own proposal: Feasibility numbers are estimates from the brief alone (I did not re-read plan.md or test any API), and my 5/5 for Option 1 may reward safety over winning.
