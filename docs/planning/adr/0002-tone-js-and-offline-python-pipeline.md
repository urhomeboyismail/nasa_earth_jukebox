# ADR-0002: Tone.js in the browser + offline Python pipeline, no runtime LLM

**Date**: 2026-11-06
**Status**: proposed
**Deciders**: brainstorm team (tech-architect draft, facilitator)

## Context

The brief wants frames to be the foundation of the audio, and our rules say "never fake data in sound". GIBS colormaps map colours to value **ranges**, not exact values (SST bins are 0.15 °C) [verified: https://gibs.earthdata.nasa.gov/colormaps/v1.3/GHRSST_Sea_Surface_Temperature.xml]. Live computer-vision reading of arbitrary EIC videos was judged unreliable (Rounds 1–3).

## Decision

An offline Python pipeline fetches GIBS tiles by date, decodes pixels against the layer's colormap XML (nearest colour in Lab space, giving a bin), and writes a small `story.json` with gaps as `null` plus a `facts.json`. The browser plays it with pinned Tone.js 15.x (latest release 15.1.22 [verified: https://github.com/Tonejs/Tone.js/releases]). Sound rules (scale snapping, rests, ducking) are deterministic code. No LLM sits in the audio path.

## Alternatives Considered

### Alternative 1: Live frame analysis in the app (CV legend reading, MP4 frame extraction)
- **Pros**: "any visualization".
- **Cons**: some EIC/SVS pages offer only MP4 [verified: https://svs.gsfc.nasa.gov/5521/]; compression breaks colour matching; slow and fragile on stage.
- **Why not**: fails Validity and Feasibility.

### Alternative 2: LLM "Composer" agent generating the score
- **Pros**: flexible, impressive-sounding.
- **Cons**: not auditable; latency; hallucination risk against rule 4.
- **Why not**: mapping rules are better as testable code.

## Consequences

### Positive
- Every note is traceable to a pixel bin; Side B can truthfully say "binned".
- No API keys or network at runtime.

### Negative
- Adding a layer means re-running the pipeline.
- "Exact" can never be claimed for continuous layers.

### Risks
- Colour decode errors: the frame analyst spot-checks bins against the legend; coverage is shown per frame.
