# W3: The sound parameters were never chosen by ear

TL;DR: 220 Hz base, 2 octaves, 0.5 s per step, pentatonic scale, click at −18 dB and note level at −8 dB are all my guesses. Nobody has listened to them.
Status: **open**. Found in: T3 (`app/sound/plan.js` `DEFAULTS`, `app/sound/engine.js`). Owner: sound designer.

## Why it matters
- The product is the sound. The challenge asks us to balance data fidelity with musicality (CLAUDE.md, point 4). Wrong values can make it noise, or make real changes inaudible.
- Step size matters for blind users: too fast and a change is missed; too slow and the story drags past the 30 s video.
- The 2-octave range and pentatonic rounding (about 10% of the range per note on the fixture) decide how small a change can be heard. That limit is stated to users, so it must be real.

## Values to tune
| Setting | Now | Question |
| --- | --- | --- |
| `baseHz` | 220 | Comfortable on phone speakers and laptop speakers? |
| `octaves` | 2 | Wide enough that a small change is audible, narrow enough not to sound shrill? |
| `scaleSemitones` | major pentatonic | Is a scale needed, or does it hide real change? (See "What the sound hides", T8.) |
| `stepSeconds` | 0.5 | Can a listener follow 20 steps? What about 40? |
| `noteFraction` | 0.8 | Notes joined or separate? |
| click level | −18 dB | Audible as a "not crashed" cue without annoying? |
| fade | 150 ms | Does the fade at stops feel smooth? |

## How to fix
1. Open `app/sound/listen.html` on a laptop and on a phone, with headphones and with the speaker.
2. Play the fixture in both modes. Change one value at a time in `DEFAULTS`; note what changed.
3. Test with at least one blind or low-vision listener (T10), not only the sound designer.
4. Write the chosen values and the reasons in `decisions.md`. If `octaves` or the scale changes, update the story text for Side A rounding. A test checks that the text matches the engine.

## Done when
The sound designer and one listener who does not know the data have signed off on the values, and the reasons are logged.
