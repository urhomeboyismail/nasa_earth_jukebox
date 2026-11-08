# Round 3 — Sound-designer critique

TL;DR: Option 1 (Two Ears) and Option 4 (Ocean) sound best and stay honest; Option 0 and 3 promise more sound than six people can tune in 48 h.
The "home pitch" is not music, but a constant drone breaks the spirit of the no-background rule; make it a short reference tone. A raw column scan is noise unless quantised.

## Scores (sound lens; integers 1-5)

| Option | Influence | Creativity | Validity | Relevance | Presentation | Feasibility | Accessibility |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 Baseline | 4 | 3 | 2 | 4 | 3 | 1 | 3 |
| 1 One Story, Two Ears | 4 | 3 | 4 | 4 | 5 | 4 | 5 |
| 2 Frame Jukebox | 3 | 3 | 3 | 4 | 4 | 3 | 4 |
| 3 Time Under Your Finger | 4 | 5 | 3 | 4 | 4 | 2 | 4 |
| 4 Hold the Ocean | 5 | 4 | 3 | 4 | 5 | 3 | 4 |
| 5 Tune Your Own Earth | 3 | 4 | 3 | 3 | 3 | 3 | 5 |

## Two direct questions

**Does the home pitch drone break the no-background-music rule?**
- It is not music. It is a data-derived reference (the baseline value as a pitch), and it helps hearing change as an interval. Hearing intervals against a reference is how pitch perception works well [assumption: standard auditory-perception practice; no source checked].
- But a drone held for 60 s is a second layer, tires the ear, and masks the data layer. With "max two layers" it uses one slot. The rule's intent (nothing under the data that is not data) is bent.
- Verdict: allowed only as a **reference tone, not a drone**. Play it for 2 s before the story, and again on a key/button ("play baseline"). Optional hold-to-sound. Drop it while the voice speaks. Tag it in the spoken text: "this tone is the 1981-2010 average" only if that baseline is in the story file [unverified: baseline period for the chosen dataset].

**Is a column scan / groove sweep musical or noise?**
- Raw (row = pitch, colour value = loudness, 500+ rows): noise. Many simultaneous pitches, no melody. Image-to-sound systems like The vOICe exist and need long training [unverified: not re-checked this round].
- Also the mapping is backwards for honesty: loudness is a poor carrier of precise value; pitch is better.
- Musical version: collapse rows to 8-12 latitude bands, scale-quantise, hold each column 150-250 ms, **value -> pitch, band -> stereo/time**, no data -> rest. That is a short arpeggio per column, readable and honest if "scale-snapped" is disclosed on Side A and absent on Side B.

## Per option

**0 Baseline.** Fatal flaw: five voices, haptics, metal-detector, symphony and live CV legend reading mean no mapping gets tuned; "live any video" forces generic sound that cannot be checked for honesty. Fix: cut to one tuned mapping (see 1). 10-s moment: the metal detector ping rising as the finger nears the biggest change. It is cute but gesture-bound (conflicts with TalkBack).

**1 Two Ears.** Fatal flaw: Side A vs B can sound like the same thing with different EQ, and a constant home pitch tires. Fix: A = scale-snapped, soft timbre; B = unsnapped, plain sine, with clicks per year; reference tone on demand, not a drone. The honest "truth dial" is a good idea only if the endpoints are labelled. 10-s moment: ice extent falls over 40 years as a descending line; the 2012 low arrives as the lowest note; then a rest where data is missing, and the voice says "no data, not zero." [2012 low: unverified; check NSIDC G02135.]

**2 Frame Jukebox.** Fatal flaw: frames carry colour-ramp artefacts, not values; sound follows the colourbar, so GIBS colormap binning (ranges, not exact values) makes pitch steppy [verified in r2 pool: GIBS gives value ranges]. Fix: state "binned to N colours" in the Side B text; sound bin centres. 10-s moment: crossfade, one year gliding into another so a hole opens in the ice as a pitch slide.

**3 Time Under Your Finger.** Fatal flaw: two sliders (place and year) plus a find-change ping make two things change at once; ears cannot track both. Fix: sound only the year axis for a fixed place; place is picked by the screen reader list. Proximity hum borrowed from TouchingSpace adds a third cue; drop it [verified: https://arxiv.org/abs/2609.36404 for what it is]. 10-s moment: step a place (e.g. Mauritius) across 40 years in 8 s as one melody.

**4 Hold the Ocean.** Fatal flaw: the "duet" of nearshore and offshore SST is only two lines; if the data lack cold-water contrast, the voices stay together and there is nothing to hear. Data is Amber, so the best sound design cannot be validated before day 1. Fix: spike the SST data first; if no contrast in a month, fall back to the slower trend of one voice. 10-s moment: two voices close in a unison; a cold-water event pulls one down a minor third and a gap opens. Phone at the ear is a strong, honest presentation image.

**5 Tune Your Own Earth.** Fatal flaw: user-chosen mappings can hide data (a wrong range makes change vanish) and the sound is only as good as defaults. Fix: 3 presets plus one range slider, a warning when clipping, and a fixed Side B for reference. 10-s moment: the same frame heard under two mappings, one where the change disappears, which is itself the "what sound hides" lesson.

## Tooling note
Tone.js can do scale quantisation, stereo, ducking and rests live; no pre-rendering needed for a 40-step story.

Weakest point of my own proposal: I scored from description, not from hearing. I have not prototyped any mapping, so "sounds good" is a guess; a 2-hour Tone.js spike with a real NSIDC series should come before any score is trusted.
