# Sound Mappings: which sound for which visual

Research notes and a ready-to-use list for choosing how each kind of NASA EIC visual should sound. Use it when writing a dataset's `mapping` block (`src/data/types.ts`, `SoundMapping`) and when building the sound engine (`src/audio/`, T03/T04).

## 1. What the research says

| Finding | What it means for us | Source |
|---|---|---|
| Pitch goes with "up", "more", "brighter" and "lighter" for almost everyone. Pitch-to-brightness is the oldest and most reliable cross-sense match. | Higher value = higher pitch is the safest default. Light colours on a map should sound higher than dark ones. | Sun et al. 2018; Reymore & Lindsey 2025 |
| Listeners expect a direction (polarity) for each kind of data. For temperature most people expect hotter = higher. For sizes and amounts the preference is weaker and sometimes reversed (bigger = lower, like a big drum). | Temperature, rain intensity and heat use rising pitch. For sizes such as ice extent or area burned, check the direction in the practice test before fixing it. | Walker & Mauney 2010; Walker PhD research |
| Blind and sighted listeners mostly prefer the same mappings (polarity correlation r = 0.82). | One mapping can serve everyone. We don't need a separate "accessible mode". | Walker & Mauney 2010 |
| Listeners bring their own idea of how a variable "should" sound, and unexpected mappings slow them down. | Explain each mapping once on the Learn page with a short example, then keep it the same everywhere. | Walker et al. |
| A sound's brightness, roughness and sharpness also match colour, not only its pitch. Warm or saturated colours go with brighter, sharper sounds. | Use timbre (how "bright" the instrument sounds) as a second cue that backs up pitch. | Sun et al. 2018 |
| Timbre-to-colour matches are weak and differ between people. | Never let timbre alone carry a value. Use it to say *what* you're hearing (water, ice, fire), not *how much*. | Reymore & Lindsey 2025 |
| NASA's own sonifications scan the image over time, set pitch by value or vertical position, set loudness by brightness, and use stereo for left and right. Point sources are short bell-like notes and diffuse areas are sustained tones or drones. | Points and events should be short plucks or bells, and fields or areas should be pads or drones. Following NASA's conventions makes our app feel familiar. | NASA Chandra sonification project |
| Music-to-colour matches are partly driven by emotion (bright and fast = happy, dark and slow = sad). | Mood can colour the soundscape (major or minor, tempo), but it shouldn't carry data people need for the test. | Palmer et al. 2013 (cited in Sun et al. 2018) |

**Rule of thumb:** one variable goes to one main sound parameter (usually pitch), backed up by one secondary cue (loudness or timbre brightness). More than that becomes noise.

## 2. The master list: visual feature → sound

Confidence: **High** = strong research and convention. **Med** = sensible, but test it. **Low** = an artistic choice, so explain it on the Learn page.

| Visual feature | Sound parameter | Direction | Confidence | Notes |
|---|---|---|---|---|
| Data value (temperature, amount) | **Pitch** on a scale | higher value = higher note | High | The main channel. A musical scale (pentatonic) keeps any sequence pleasant. |
| Colour brightness / lightness | Pitch or timbre brightness | lighter = higher / brighter | High | Matches how people already link light and sound. |
| Colour warmth (blue → red) | Timbre brightness (filter cutoff, more harmonics) | red = brighter, buzzier; blue = softer, rounder | Med | A good backup cue on temperature maps. |
| Colour saturation / intensity | Loudness or roughness | more saturated = louder or rougher | Med | Keep loudness changes moderate (about ±6 dB). Users set their own volume. |
| Share of the region covered (pixel density, area) | Number of voices (chord density) or rhythm density | more coverage = more notes per beat | Med | The challenge brief itself suggests "pixel density into rhythm". |
| Horizontal position (left/right) | Stereo pan | left = left ear | High | Never the only cue: many people use one earbud or a phone speaker. |
| Vertical position (north/south) | Pitch, only if the value isn't already on pitch | up = higher | High | For scans across an image. Don't combine it with value-on-pitch. |
| Time / date order | Playback order + tempo | one step per frame | High | A soft tick marks each new frame (`mapping.tick`). |
| Rate of change between frames | Tempo, or a glide (portamento) between notes | faster change = faster or steeper glide | Med | Helps listeners hear *when* the change happened. |
| Threshold crossed (record high, ice minimum) | Short accent sound (bell, chime) | — | Med | An earcon, meaning a short sound symbol people learn. Use sparingly, at most one kind per view. |
| Anomaly (difference from average, diverging colour scale) | Pitch around a **reference note** that keeps playing quietly | above average = above the reference | Med | Listeners hear "higher or lower than normal" against a drone. That works better than absolute pitch for anomaly maps. |
| Uncertainty / noisy data | Added noise, or a less steady tone (vibrato, detune) | more uncertain = fuzzier | Low | Optional. Explain it if you use it. |
| No data / land / clouds | A distinct non-musical cue (short filtered noise) | — | High | Must never sound like a low value (PLAN §5.2: "insufficient", never "cold"). Already `missingCue: noise`. |
| Kind of thing (water, ice, fire, plants, air) | Instrument / timbre family | see §3 | Low–Med | Tells you *what* you're hearing, not *how much*. |
| Texture (smooth gradient vs patchy) | Smooth pad vs short, scattered plucks | patchier = more broken-up rhythm | Low | An artistic layer that helps with "musically pleasing". |

## 3. Timbre palette: instrument → what it suggests

Use these the same way in every visualization, so the instrument itself tells the listener the topic.

| Topic | Suggested timbre | Why |
|---|---|---|
| Ocean / sea temperature | Soft marimba or vibraphone, a little reverb | Round, wet and flowing. Mallet notes are easy to tell apart by pitch. |
| Air temperature / heat | Warm saw-wave synth with a low-pass filter that opens as it gets hotter | Rising brightness backs up rising pitch. |
| Ice / snow / cold regions | Glass, celesta or sine bells | Clear, crisp, "cold". Matches the high-and-light association. |
| Rain / precipitation | Plucked string or pizzicato; more rain = more plucks | Rhythm density is like drops. |
| Vegetation / land greenness | Woody tones (kalimba, nylon guitar) | Organic and natural. |
| Fire / burned area | Crackly noise bursts + low drum | Rough texture suits fire. Avoid alarm-like sirens. |
| CO₂ / atmosphere / gases | Slow pad or drone that thickens (more voices) as levels rise | Something you can't see, building up slowly. |
| Clouds / aerosols | Breathy, filtered noise pad | Soft and diffuse. |
| City lights / human activity | Electric piano or digital blips | Clearly human-made. |
| Single events (a storm, a record) | Bell or chime | NASA's convention: point sources are bells. |

## 4. Ready-to-use mappings by EIC visualization type

Each entry fits the `SoundMapping` shape. Categories are listed coolest or lowest first. The notes span about 1.5 octaves, because wider steps are easier to tell apart than neighbouring scale notes.

### 4.1 Sea surface temperature (current fixture)
- Polarity: warmer = higher. Timbre: marimba. Backup cue: the filter opens slightly as it warms.
- Suggested notes (C major pentatonic, wider spacing): cold `C4`, cool `E4`, mild `G4`, warm `C5`, hot `E5`.
- The fixture currently uses `C4 D4 E4 G4 A4`. Those steps are only 2 to 3 semitones apart, which untrained listeners find hard to separate when the notes come one after another. Try the wider set in the practice test.

### 4.2 Air temperature anomaly (diverging blue–white–red)
- A quiet reference drone on `G4` means average. Categories: much cooler `C4`, cooler `E4`, near average `G4`, warmer `C5`, much warmer `E5`.
- Timbre gets brighter above average and softer below it.

### 4.3 Sea ice / snow extent
- Timbre: glass or celesta. **Test the polarity:** "more ice = higher" (more = up) and "more ice = lower" (bigger = heavier) are both defensible.
- Recommended start: more ice = more notes in the chord (density), less ice = a thinner chord. This sidesteps the polarity question.

### 4.4 Precipitation / rainfall
- More rain = more plucks per beat (rhythm density), with slightly higher pitch for heavier rain. Dry areas get a slow, sparse pulse, not silence (silence sounds like an error).

### 4.5 Vegetation (NDVI, greenness)
- Greener = higher pitch, woody timbre. A seasonal cycle becomes a melody that rises in spring and falls in autumn.

### 4.6 Wildfires / burned area
- Number of active fires = density of crackle bursts. Bigger burned area = a lower, louder drum (size → lower).
- Keep it musical and skip sirens. The app should inform, not alarm.

### 4.7 CO₂ / greenhouse gases
- Rising levels = a drone that slowly rises in pitch and adds voices. Suits long time series (decades) where steady growth is the story.

### 4.8 Ocean currents / wind (motion)
- Speed = tempo or note rate. Direction = stereo pan (east = right), used only as an extra cue.

### 4.9 Sea level
- Higher = higher pitch, plus a low, slow swell in loudness so it reads as water.

## 5. Special cues (keep these the same everywhere)

| Cue | Sound | Length |
|---|---|---|
| New frame tick | Very short, quiet high click (`C6`) | 40–60 ms |
| Missing / insufficient data | Short filtered noise burst | 300 ms |
| Start of a sequence | Rising two-note chime | ~400 ms |
| End of a sequence | Falling two-note chime | ~400 ms |
| Threshold / record crossed | A single bell above the melody | ~500 ms |
| Compare: frame A vs frame B | A first in the left ear, then B in the right, each introduced by a label or earcon | — |

## 6. Rules for accessibility and musicality

1. **Five categories at most** per view. People reliably remember only about 4 to 7 pitch levels.
2. **Notes between `C3` and `C6`** (fundamentals of about 130 Hz to 1 kHz). Very high tones are hard to hear with age-related hearing loss, and very low ones vanish on phone speakers.
3. **Each note at least 250 ms long**, with a small gap after it. Very short notes are hard to judge for pitch.
4. **Stay on one scale** (pentatonic) so any data sequence sounds pleasant. This answers the brief's warning about "chaotic noise".
5. **Back up pitch with a second cue** (timbre brightness or a little loudness). Some listeners are weak at judging pitch, and the extra cue helps them.
6. **Never rely on stereo alone.** Mono earbuds and phone speakers are common.
7. **Missing data must sound different from low values.** Use noise, not a low note.
8. **Don't play over the screen reader or the voice guide.** Duck (pause), as `duck()` already does.
9. **Keep each mapping the same** on Learn, Listen and Compare. Change it only after the practice test shows a problem.
10. **Let users replay single notes** (Learn page) so they can build their own reference.

## 7. What to test in the listening study (F11)

- Wide vs narrow note spacing for SST: which gives more correct answers in Compare?
- Polarity for ice extent: more ice = higher vs more ice = lower.
- Does the timbre backup cue (filter brightness) help listeners who are weak at pitch?
- Can listeners tell the missing-data cue apart from the coldest category?

## Sources

- Walker, B. N. & Mauney, L. M. (2010). [Universal Design of Auditory Graphs: A Comparison of Sonification Mappings for Visually Impaired and Sighted Listeners](https://wirelessrerc.gatech.edu/node/341.html). *ACM Transactions on Accessible Computing.*
- Walker et al. [A comparison of sonification mappings (PDF)](https://wirelessrerc.gatech.edu/sites/default/files/publications/walker_et_al_-_a_comparison_of_sonification_mappings.pdf)
- [Bruce Walker's PhD research on polarity and scaling](https://sonify.psych.gatech.edu/walkerb/research/phd/index.html)
- [Psychophysical scaling of sonification mappings: visually impaired and sighted listeners](https://repository.gatech.edu/entities/publication/c4f76dee-4c38-4876-b031-110b0ee212e0)
- Sun et al. (2018). [An extended research of crossmodal correspondence between color and sound](https://pmc.ncbi.nlm.nih.gov/articles/PMC5835347/). *PeerJ.*
- Reymore & Lindsey (2025). [Timbre, pitch register and colour](https://www.frontiersin.org/articles/10.3389/fpsyg.2024.1520131/full). *Frontiers in Psychology.*
- NASA Chandra X-ray Center. [Sonification project notes](https://chandra.harvard.edu/blog/node/785) and [how the sonifications work (PDF)](https://chandra.harvard.edu/sound/images/sound2.pdf)
- Perkins School for the Blind. [Sonification of Chandra space images](https://www.perkins.org/technology/blog/sonification-chandra-space-images)
