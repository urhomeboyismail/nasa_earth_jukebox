# 00 — Brief for every agent (Round 0)

TL;DR: Earth, Out Loud turns NASA EIC visuals into sound, touch and talk for blind users. The plan is oversized and partly unverified; make it smaller, truer, more surprising.

## Current concept in five lines

1. Voice-first web app (Android demo): "Name any NASA Earth visualization; hear it, touch it, ask it questions."
2. Jukebox shelf of records; each has Side A (Listen, musical) and Side B (Analyze, strict).
3. Three gold stories (temperature, Arctic ice, sea level or Indian Ocean upwelling) built from frames and cross-checked against NASA numbers, plus live mode for any EIC visualization.
4. Touch the planet: pitch under the finger, border ticks, Mauritius home beacon, metal detector mode finds the biggest change.
5. Navigator (existing voice assistant) fronts Google ADK agents; five audio-description voices, haptic language, Earth Symphony finale.

## Five biggest open questions

1. **Scope vs 48 h.** ~10 features, two agent systems, three data pipelines, six students. Smallest core that still wins? Team skills unknown.
2. **Live mode honesty.** Computer-vision legend reading of an arbitrary EIC video in under a minute, topic chosen live by a judge. Is the headline the least reliable feature?
3. **Screen readers vs custom touch.** With TalkBack/VoiceOver on, drags and double taps go to the screen reader. Does "touch the planet" work for our primary user in a web app?
4. **Frames as foundation.** Gold stories let NASA numbers drive the melody when frames match poorly. Will judges say we didn't sonify frames?
5. **Unverified ground.** GIBS colormaps, EIC frame sets, Navigator's real abilities, ADK latency, several plan sources; no blind tester booked.

## Constraints (CLAUDE.md)

- Tag claims `[verified: url]`, `[unverified]`, `[assumption]`. Never invent numbers, IDs, endpoints.
- NASA data required and documented; no NASA branding; disclose AI use.
- Missing data = silence. Narrator speaks only grounded facts.
- Every idea: how a blind user does it, with TalkBack/VoiceOver on; every gesture has a button/voice equivalent; all speech also as text.
- Audio: no music under data; pause sonification for voice; ≤ 2 layers; 3–5 key moments.
- Feasibility gate: 6 people, ~48 h, else stretch.
- Submission: ≤ 30 s video or ≤ 7 slides; public link, no login.
- Start with a 2-line TL;DR; end with "Weakest point of my own proposal:".

Primary user (PRODUCT-BRIEF.md): blind first-year environmental science student in Mauritius, TalkBack on Android `[assumption: persona]`.
