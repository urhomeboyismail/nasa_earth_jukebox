# ADK ideas (idea-sparker, independent)

TL;DR: Fifteen ways an ADK agent team could earn its place: five build the story file from unfamiliar frames, five narrate and teach at runtime, five are wild.
Two are auditors that refuse ungrounded speech; the rest keep every spoken line tied to story.json or facts.json.

## Offline: agents that build the story file

1. **Colormap Auditor**: checks each decoded colour against the layer's published colormap and rejects any colour it cannot name. *Wow:* a live "rejected colours" count. *Blind user:* rejected pixels become spoken rests, announced once.
2. **Story Builder**: turns an unfamiliar frame series into story.json with 3-5 key moments, each checked against the data. *Wow:* a new layer becomes playable in one run. *Blind user:* hears the key moments as text before playback.
3. **Fact Harvester**: keeps only cited sentences from the source's own docs in facts.json and drops any sentence without a URL. *Wow:* every spoken line has a footnote. *Blind user:* asks "where is this from?" and hears the source name.
4. **★ Honesty Auditor**: a second agent reads every Q&A draft and blocks any answer it cannot trace to facts.json. *Wow:* the blocked-answer log is on screen. *Blind user:* never hears an answer that failed the check.
5. **Pre-registration Agent**: writes the Test A and Test B thresholds into a dated file before any data is pulled. *Wow:* judges see the rules dated before the data. *Blind user:* hears the threshold behind each pass or fail.

## Runtime: narrate, teach, guide

6. **Navigator Front Door**: Navigator routes spoken questions to one ADK Narrator that answers only from facts.json. *Wow:* a spoken question gets a cited answer in one breath. *Blind user:* asks by voice and gets the answer as speech and text.
7. **★ Ask-Back Tutor**: asks "what changed between these two dates?", then checks the answer against story.json. *Wow:* a quiz that teaches the pattern. *Blind user:* answers by voice or with two buttons.
8. **Describe-Then-Hear Guide**: before playback, speaks a short grounded summary of the story's shape (rests, peaks) from story.json. *Wow:* context before sound. *Blind user:* skips it with one button.
9. **Plain-Language Translator**: rewrites a cited fact for another reading level and checks that every number is unchanged. *Wow:* one fact at three levels. *Blind user:* picks the level by voice.
10. **Gap Explainer**: answers "why is it quiet?" using the story's own list of missing dates. *Wow:* the silence beat explains itself on demand. *Blind user:* hears the exact date range.

## Wild

11. **Two Narrators Argue**: one agent argues the change is real, the other argues it is noise, and both cite facts.json. *Wow:* an audio debate about uncertainty. *Blind user:* hears two voices, each with its citation.
12. **★ Narrator Blocker**: at runtime, a second agent checks each Narrator sentence and forces silence if a sentence has no citation. *Wow:* a visible "blocked sentence" count. *Blind user:* hears a gap, never an invented line.
13. **Listener Persona Simulator**: scripted agents run the app with a screen reader on and no sight, then report friction. *Wow:* a generated friction report before any human tests. *Blind user:* gains nothing directly; it only reduces bugs before real testers arrive (it does not replace them).
14. **Mauritius Local Guide**: answers local questions about the Mauritius close only from a cited fact sheet [unverified: no Mauritius fact sheet exists yet]. *Wow:* a local angle for the judges. *Blind user:* asks in English and hears a cited answer.
15. **Braille Writer**: converts the data table into a braille-ready text file [unverified: braille tooling not checked]. *Wow:* a real braille output on stage. *Blind user:* sends the file to their own display.

## Bets

- **Honesty Auditor (4):** trust is the product, and an auditor is the easiest way to show it on screen.
- **Ask-Back Tutor (7):** it turns a blind user from listener into questioner, which the challenge's teaching goal needs.
- **Narrator Blocker (12):** it proves at runtime what idea 4 proves offline, and silence is already our rule.

Weakest point of my own proposal: the ADK layer is optional and adds latency and cost; two LLM auditors can share the same blind spot, so judges may see them as decoration unless the audit results are shown on screen.
