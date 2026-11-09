# Round 5: Sound-designer mapping spec, Arctic September sea ice

TL;DR: One data voice, pitch = ice extent, one note per year. Side A is musical, Side B is a strict sine with a click per year. Missing years are silence while the year clock keeps ticking.
The demo beat is a 10 s clip that ends on a gap year and the voice "No data. Not zero." All values come from the story file; sonification claims are [assumption] (no sources searched).

## 1. Mapping table (Side B values; A differs in section 2)

| Feature | Sound | Reason |
| --- | --- | --- |
| Ice extent (MODIS ice-pixel count per September; NSIDC G02135 cross-check) | Pitch, higher = more ice. C3 (130.8 Hz) to C5 (523.3 Hz). Min/max from `story.range`, fixed, never auto-scaled | Pitch carries value best; "ice falls = pitch falls" is intuitive [assumption] |
| Year | Time: 0.5 s per year on A, 0.8 s on B | Time maps to time |
| Loudness | Fixed, not data | Poor, imprecise carrier |
| Timbre | A: soft mallet (low-index FM). B: pure sine | A pleasant; B adds nothing |
| Stereo | Centre | Pan carries nothing with one layer |
| Rhythm | Steady pulse; a year flagged `series_low` held 1.5x | Constant pulse makes rests stand out |
| Confidence | Timbre (section 3), never loudness | Quiet would read as "less ice" |
| Optional layer, B only | NSIDC right ear, MODIS left; unison = agree, beating = differ | Max two layers. Stretch |

## 2. Side A vs Side B

- **Scale:** A = C minor pentatonic, 11 notes C3 to C5; rounding step = range/10, stated. B = none, continuous.
- **Timbre:** A mallet; B sine.
- **Smoothing:** none on values in both (a 3-year mean would erase a record-low year). A has a 120 ms glide, presentation only. B has hard steps.
- **Per-year click:** A very quiet tick (keeps time in gaps). B clear 5 ms click.
- **Text A:** "Musical: snapped to 11 notes, one step is N pixels [file]. Gaps are silent." Minor key is an editorial choice, disclosed.
- **Text B:** "Strict: pitch follows ice-pixel count from L to H [file]. Ice/not-ice classification, pixel size P [file]."
- **Both:** live line (year, value, pitch, confidence) in `aria-live="polite"`, readable on braille displays.

## 3. Silence map

- **Missing year/frame:** no pitch. The tick keeps its beat. Frame shows a hatched cell. Voice and text: "20XX: no data. Not zero." Next valid year resumes with no glide.
- **Low confidence** (story-file flag, e.g. MODIS vs NSIDC beyond the red team's tolerance): note plays at its value, half-length, plus 25-cent vibrato at 6 Hz on A. Text states the reason from the file.
- **Extremes/clipping:** a value outside `story.range` sits at the range end and fires the range-limit earcon. A record low is not clipping: lowest note, held 1.5x, only if flagged.
- **Wrong conclusions and fixes:**
  1. Silence = zero ice. Voice and text say "not zero"; lowest pitch is stated as series minimum.
  2. Story ended at the gap. The tick continues.
  3. Big drop = collapse. Range is stated; reference tone gives scale.
  4. Snapping hides small changes (A). Step size stated; B is one switch away.
  5. Pixel count = NSIDC extent. Spoken once: "pixel count, cross-checked against NSIDC; differences from [file]".

## 4. Reference tone

- Encodes `story.baseline_value`: mean of the first 5 Septembers in the file [assumption: MODIS starts in 2000, so the 1981-2010 NSIDC convention cannot share units].
- Used only if the file holds `baseline_value`, `baseline_period` and `source_id`; otherwise the button is disabled: "no baseline in this story".
- 2 s sine before playback and on a button. Never a drone. Silent while the voice speaks. Voice: "This tone is the average of 20XX to 20YY."

## 5. The 10-second moment (Side B)

Window = 10 consecutive years from the file ending on flagged gap year G.

- **0.0-1.5 s:** reference tone. Text: "Baseline: average 20XX-20YY".
- **1.5-6.5 s:** ten years at 0.5 s (demo speed), falling line, click each year. Marker walks the GIBS frame.
- **6.5-7.5 s:** lowest note of the window held 1 s. Text "Lowest of this run" only if the file flags it.
- **7.5-8.5 s:** click only, no pitch. Frame hatched; "20GG: no data".
- **8.5-10.0 s:** voice "20GG: no data. Not zero." Then one beat of silence. End.

Fallback if no natural gap exists: use a frame the file marks `qc_failed` (cloud or classification fail) and announce it as "failed quality check", never as a natural gap.

## 6. Earcons (6) and ducking

1. Play: rising fifth.
2. Pause: falling fifth.
3. Side A on: warm mallet chime.
4. Side B on: two dry ticks.
5. Range limit: two high ticks.
6. End of story: low soft thump.

Ducking: voice start fades data, reference tone and earcons in 80 ms and pauses at the current year. Voice end: 300 ms silence, resume. Earcons never overlap voice except Pause. Gaps get no earcon, so silence stays pure.

## 7. Mauritius SST close (if Test B passes)

Value = SST colour-bin centre (0.15 C bins) at the Mauritius tile, same month each year from the file, 2002 on. Warmer = higher pitch, range from the file, same two sides. Land, cloud or masked pixels = rest. Text: "binned to N colours". The year slider steps the note; `aria-valuetext` gives year and value.

## 7b. If Test A fails (SST main story)

Series = Indian Ocean or global SST mean of bin centres per year. Sound layout unchanged; only the file and pitch range change. Ice becomes a limits scene: MODIS left, NSIDC right, beating where they disagree.

## 8. Tone.js feasibility

- Scale snap, pitch maths: direct.
- Mallet, sine, noise click: direct.
- Year clock, rests: direct (`Transport.schedule`).
- Vibrato, staccato: direct.
- Ducking, voice pause: direct (`Gain.rampTo`, Transport pause).
- Stereo layer: direct (`Panner`).
- Voice lines: pre-render MP3 for the fixed ~20-40 lines.
- Demo backup: pre-render the 10 s moment with `Tone.Offline`.
- iOS needs a user tap to start audio.

Weakest point of my own proposal: Nothing here has been heard. The 10 s moment needs a real gap next to a real low in one 10-year window, and I do not know the series has one; the `qc_failed` fallback is more contrived. The 5-year baseline is my own choice and shifts the reference tone.
