```json
{
  "reviewer": "B (judge-red-team lens)",
  "verdict": "FAIL",
  "checks": [
    {
      "criterion": "1. Facts tagged and verified",
      "result": "FAIL",
      "detail": "Most data facts are tagged and match r5/data-scout.md (GIBS layer IDs, colormap, NSIDC row, GISTEMP, credits, Tone 15.1.22). Problems: (a) Core feature 1 says 'menu of 3 pre-tested GIBS layers', but the third layer (MODIS_Terra_Aerosol_Optical_Depth_3km) has no tile fetched and FINAL itself tags it [unverified]. A core feature is described with a claim its own table contradicts. (b) Risk 3 fallback relies on 'a frame flagged qc_failed'. No GIBS or NSIDC source in the verified set shows such a flag. It appears only in r5/sound-designer.md, untagged. It is a mechanism that is invented or unverified, offered as a fallback for core feature 3. (c) Untagged claims: 'iOS silent switch' (risk 4), 'Round 3 to Round 5 the top score did not improve (29 to 29)', Safari role=switch behaviour (marked 'test Safari', acceptable). (d) 'Same month each year from 2002' for MUR is impossible for months before June, because the MUR record starts 2002-06-01 per FINAL's own table. The month must be named (June or later). (e) The sentence 'every Side A/B note comes from decoded pixels' is a design claim whose basis (Test A) is not yet run. This is allowed as a labelled day-1 test, and Test A is labelled. (f) The ice story's SST fallback says 'colour bin at the location', but data-scout shows the exact Mauritius pixel is transparent (land-masked). The location must be offshore, and FINAL does not say so."
    },
    {
      "criterion": "2. Space Apps rules met",
      "result": "PASS",
      "detail": "NASA data is documented with layer IDs, tile templates (in the scout file), colormap URLs and credit lines. No NASA logos, and GIBS tiles only. AI-use disclosure is present, though thin ('any code, audio, voice lines or images ... will be listed'). 30 s video and 7-slide plans both exist, and the public no-login static link is stated. Minor: exact credit text lives only in r5/data-scout.md, so FINAL.md is not self-contained. The 2026 guides are acknowledged as unseen and labelled [unverified]."
    },
    {
      "criterion": "3. Feasibility >= 3 for every core feature",
      "result": "PASS",
      "detail": "All 8 core features are scored >= 3, and features 7 and 8 are at the gate. Credible in scope: no runtime LLM, static app, pre-computed JSON. Weak spots that do not break the gate but need fixing. (1) Feature 7 ('what the sound hides') has no named data source or mapping, and its Hour-24/40 task is vague. (2) Feature 3 (silence map) depends on a real gap existing. Risk 3 admits it may not, and every fallback is either gated (Mauritius), cut-order item 2, or relies on the unverified qc_failed flag. (3) The team table in CLAUDE.md is empty and the ~250 h capacity is an [assumption]. FINAL labels this."
    },
    {
      "criterion": "4. Every core feature usable with a screen reader on",
      "result": "FAIL",
      "detail": "The table states 'yes' for all 8, with fixes for some. That is formally stated, but the 'how' is one word for features 1, 4, 6 and 8 (e.g. 'Reference tone: yes'). Substantive gap: sonification plays while the user's own screen reader speaks the aria-live text. FINAL says every sound has a text twin in one aria-live region and that app TTS is off, but it never states the rule that sound fades or pauses when the screen reader speaks, or that playback resumes only on user action. That rule exists only in r5/accessibility-lead.md and r5/tech-architect.md. CLAUDE.md hard rule 7 requires it. Without it, features 3 and 5 (silence line, year slider with debounce) talk over the audio and the stated TalkBack/NVDA behaviour is incomplete. FINAL also says a 300 ms earcon plays before every gap, while r5/sound-designer.md says gaps get no earcon so silence stays pure. This conflict is unresolved for feature 3."
    }
  ],
  "critical_issues": [
    "Feature 1 says '3 pre-tested GIBS layers' but the third layer (AOD) has no tile fetched and is tagged [unverified] in section 4. Reword to 'two pre-tested layers (ice, SST); third optional until a tile is fetched', and make the menu count in feature 1, the cut order and the live demo step consistent.",
    "Risk 3 fallback uses 'a frame flagged qc_failed' with no verified source for such a flag in GIBS or NSIDC. Tag it [unverified], or remove it. Core feature 3 (silence beat) must not rest on it. Name one verified, real gap (e.g. dates missing from the GIBS time dimension) or state that the silence beat depends on the Mauritius land mask and is therefore gated.",
    "Screen-reader behaviour is incomplete. FINAL.md omits the rule that sound pauses/fades when the screen reader speaks and resumes only on user action (required by CLAUDE.md rule 7; present only in r5 files). Add it to section 2 or the feature table, and resolve the earcon-before-gap vs 'gaps get no earcon' conflict with r5/sound-designer.md."
  ],
  "suggestions": [
    "Say which month the MUR series uses (June or later, since the record starts 2002-06-01) and that the sampled pixel is offshore, because the island pixel is masked.",
    "Give feature 7 a named data source and mapping pair, or move it to stretch.",
    "Tag the 'iOS silent switch' and '29 to 29' claims as [assumption]/internal.",
    "Copy the four credit lines into FINAL.md so slide 7 does not depend on another file. Expand the AI-use disclosure to name the models and what each did.",
    "Expand the screen-reader column beyond 'yes' with one concrete sentence per feature (control type, what is announced).",
    "Test A pass thresholds (rank correlation >= 0.9, slope within 15%) are labelled assumptions and owned by the red team. Good. Record the numbers in decisions.md before the data is seen."
  ]
}
```
