# R1 Sound Designer

TL;DR: Add one quiet fixed "home pitch" (the baseline) under the data voice, so change is heard as an interval.
Radical alternative: sweep each frame like a record groove. Cut: the Earth Symphony finale.

## 1. Upgrade: the Home Pitch

A very quiet steady drone plays the baseline (e.g. anomaly zero). The data voice plays against it. Same = unison; away = a growing interval, then rough beating. [assumption: intervals are easier to judge than absolute pitch; untested]

Only two layers: drone + one data voice.

| Data | Sound | Why |
| --- | --- | --- |
| Value vs baseline | Pitch vs drone; more/warmer = higher | Polarity varies by data type, so we test it [verified: https://pubmed.ncbi.nlm.nih.gov/12570096/] |
| Magnitude | Log pitch, fixed semitone step per story | Pitch is roughly logarithmic [verified: https://arxiv.org/html/2508.06872v2] |
| Rate of change | Tempo | One mapping per property |
| Place | Stereo pan | As plan |
| Missing data | Data voice stops, drone continues | Silence is audible against a drone |
| Low confidence | Soft static | As plan |

**Side A (Listen):** pentatonic snap above the drone, warm pad, rounding at most 1 semitone, never across a record threshold.
**Side B (Analyze):** no snap, plain sine glide. Near tones beat, so tiny gaps are audible (tests plan idea 2).

**Honesty:** the legend states the rounding step and says "the drone is the baseline, not a target". Extremes clip with a "ceiling" tick, never a wrong high note.

**10-second moment (Arctic ice, September 2012):** the pad sits near the drone for years. In 2012 it falls a fifth below, beating turns harsh, one ice-crack sample lands, then 1.5 s of silence with only the drone. [assumption: 2012 is the key moment; confirm in data]

**Tooling:** Tone.js live; only the ice-crack is a pre-rendered sample (disclosed).

## 2. Radical alternative: Frame as a record groove

A sweep line crosses each frame left to right in 8 s. Row = pitch, legend value = loudness, no-data = silence. It works on any frame without a story file, the most literal "frames are the foundation". Use as Side B for live mode. [assumption: similar to existing image-sonification tools; unverified]

## 3. Cut

The Earth Symphony finale: it breaks the two-layer rule, costs the most sound hours, and adds no discovery.

## Evidence
- Walker & Mauney 2010 (blind n=45, sighted n=435, polarity mostly agreed): [unverified]; from search summaries only.
- Pitch JND depends on range and level; pure-tone figures may not hold for complex timbres [verified: https://www.sfu.ca/sonic-studio-webdav/cmns/Handbook5/handbook/Differential_Threshold.html].

Weakest point of my own proposal: a drone under the data could be heard as banned "background music", and a blind tester may tire of it within a minute. Neither is tested.
