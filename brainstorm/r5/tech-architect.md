# R5 Tech-architect: stress test of "One Story, Two Ears"

TL;DR: Buildable in 48 h; ~150 h of work for ~250 available. The risk is data decoding (Test A/B) and the blind-tester gap, not code.
Team table is empty: I plan against six generic roles (data engineer DE, frame analyst FA, sound designer SD, agent/voice AV, frontend/accessibility FE, red team RT).

## 1. Architecture

Offline (Python): GIBS tiles + colormap XML -> nearest-colour decode (Lab) to bin index -> per-year grid (e.g. 64x32) -> `story.json`. NSIDC CSV / GISTEMP tables -> `facts.json`. Pre-rendered frame PNGs. Raw grids never ship.
Static PWA (no required backend): loads cached JSON and PNGs. Live in browser: Tone.js, TTS, ARIA text, sliders, Side A/B re-mapping. Precomputed: values, Q&A, alt text, marker positions. Optional: ADK Narrator, Navigator link.

Story-file schema (fields only):
- `meta`: id, title, layer_id, source_urls[], date_range, colormap_url, bins_n, ai_disclosure
- `frames[]`: year, date, png, grid[rows][cols] (bin or null), coverage_pct, confidence
- `colormap`: bin -> value_low, value_high, unit
- `mappings{A,B}`: scale, pitch_range, timbre, rounding_note, spoken_label
- `moments[]` (3-5): year, text, fact_id
- `silence`: rule, spoken_text, text
- `reference_tone`: hz, duration_s
- `facts[]` (facts.json): id, text, source, tag
- `qa[]`: question, aliases[], answer, fact_ids[] (empty = not spoken)
- `hidden_scene`: year, mapping_hides, mapping_shows
- `a11y`: valuetext_template, scene_description

## 2. 48-hour plan (~150 h build, ~30 h test/video)

| Role | 0-6 | 6-24 | 24-40 | 40-48 |
| --- | --- | --- | --- | --- |
| DE | Test A, tile decode | Layers 2-3 to JSON, facts.json | Mauritius tile, data docs | Credits |
| FA | Test B, colormap bins | Frame PNGs, marker coords | "Hides" scene data | Spot checks |
| SD | One tone, rest, 2 s reference | Side A/B mappings | Hidden-scene mapping, earcons | Levels |
| AV | Q&A skeleton, fact IDs | 20-40 cited answers; TTS wrapper | Optional ADK | Subtitles |
| FE | Shell, slider, ARIA, switch | Controls, marker view | TalkBack/NVDA, offline PWA | Deploy, rehearse |
| RT | Set Test A tolerance first | Review fact tags | Blind tester, axe | Video, AI disclosure |

**Critical path:** Test A/B -> colormap decode -> story.json frozen (schema h6, data h12) -> Side A/B engine + silence rest -> keyboard/screen-reader flow -> tester feedback -> video.

## 3. Checkpoints and kill tests

- **Test A (0-6 h; DE runs, RT sets tolerance):** count ice pixels per September frame of `MODIS_Terra_L3_Sea_Ice_Daily` vs NSIDC G02135 September extent. Compare trend and year rank, not absolute km2 (cloud and polar-night gaps [assumption]). Pass = rank correlation >= 0.9 and slope within 15% (RT may change this before looking). Fail = SST main story, ice to limits scene.
- **Test B (0-6 h; FA):** MUR tile over Mauritius at 3 dates. Pass = >= 90% non-null offshore pixels and >= 4 distinct bins across the year. Fail = cut Mauritius, no re-plan.
- **Hour 6:** schema frozen; one layer decodes; a JSON value plays a tone; a null plays a rest; A/B verdicts logged.
- **Hour 24:** A/B switch, valuetext slider, silence line, reference tone work by keyboard on one story; TalkBack smoke pass; PWA installs.
- **Hour 40:** all 8 features on 3 layers; airplane-mode run passes; one blind or low-vision tester used it; feature freeze. Then video, slides, disclosure only.

## 4. Kill list (cut order) and the demo left

1. Live ADK, QR postcards, medley. Demo unchanged.
2. Mauritius close. Demo: ice + global story.
3. "What the sound hides". A/B + silence still carry the core.
4. Third layer. Menu of two.
5. Moving marker becomes a static frame (loses frame-to-sound link).
6. Q&A shrinks to 10 answers.
Never cut: A/B switch, silence rest, reference tone, slider, keyboard/ARIA.

## 5. On-stage fallbacks

- No internet: installed PWA, cached JSON/PNG; rehearsed in airplane mode.
- Slow device: 64x32 grids, one Tone.js voice, no reverb; test on the cheapest phone.
- No TTS: `aria-live` text is primary anyway; 5 pre-recorded WAV lines.
- Screen reader on: sonification pauses on focus change or speech; Play is a button, no autoplay; visible Start button for the audio-unlock tap [assumption].
- GIBS down: nothing calls GIBS at runtime; frames are bundled.
- Primary rig laptop+NVDA, phone second.

## 6. Feasibility (1-5) and what raises it

1. Choose menu: 4. Lock layer IDs and dates by h6.
2. Side A/B: 4. Freeze mapping JSON at h6.
3. Silence map: 4. Check nulls are gaps, not zero; show `coverage_pct`.
4. Reference tone: 5. Trivial.
5. Slider/controls: 4. Native range input + valuetext; early TalkBack test.
6. Cited Q&A: 4. Cut to 15 answers if late.
7. "What the sound hides": 3. RT confirms it is not a strawman.
8. Sighted marker: 3. Use EPSG:4326 tiles only.
None below 3. Features 7 and 8 are at the gate.

## 7. Verification

- Tone.js latest 15.1.22 [verified: https://github.com/Tonejs/Tone.js/releases]; year and feature fit [unverified]. Adopt, pin.
- Offline TTS: `localService` flags on-device voices [verified: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService]; Android Chrome offline voice [unverified], test on demo phone by h6.
- PWA audio: Range-request caching not covered by sources checked [unverified]; synthesis needs no files, WAV backups load via fetch + `decodeAudioData`.

## ADR drafts

**ADR-1 Platform: static PWA, not native.** Decision: ship an installable static PWA. Why: one codebase, no store review, runs on laptop+NVDA and Android TalkBack, works offline via service worker. Native would double work. Cost: no iOS haptics; Vibration API is Android Chrome only [verified: https://caniuse.com/mdn-api_navigator_vibrate], so haptics are never core. Revisit if the demo phone cannot install the PWA or lacks a required API. Consequence: a rehearsed, offline-first rig.

**ADR-2 Stack: Tone.js plus offline Python pipeline, no runtime LLM.** Decision: Python turns GIBS tiles into small story.json; the browser plays it with pinned Tone.js 15.x. Why: mapping is deterministic, auditable, immune to API outages and hallucination; "never fake data" is easy to prove. GIBS colormaps give bin ranges, so Side B is labelled "binned to N colours". Rejected: live frame analysis, streaming raw grids, a Composer LLM. Consequence: every dataset sits in `meta.source_urls`; changing a layer means re-running the pipeline.

**ADR-3 Agent design: static cited Q&A first.** Decision: answers are pre-written with fact IDs; text without a fact ID is never spoken. An ADK Narrator on Cloud Run is optional, grounded in facts.json, choosing only among cited facts. Navigator is a link-out, off the critical path; its API is unverified. Why: grounding (rule 5), stage reliability, 48 h limit. Consequence: the demo works with zero network. Revisit if Navigator's contract is verified before hour 24 and costs under 6 h.

Weakest point of my own proposal: Test A's tolerance and the ice-pixel approach are guesses; MODIS gaps could make pass/fail meaningless, and I never ran either data pull. Hour estimates are unmeasured, and the blind-tester gap is not something architecture fixes.
