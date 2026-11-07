# Tech-architect, Round 1

TL;DR: Plan for six generic roles. Make the story file a static contract, run one grounded agent behind it, and limit live mode to GIBS layers.
The radical version (no backend) probably wins on stage reliability; cut the Composer agent and arbitrary-video CV.

## 1. Upgrade: "Static core, one thin agent" (feasibility 4/5)

```
OFFLINE (Python):  GIBS/SVS frames -> Lab colormap match -> story.json (+facts.json)
STATIC PWA:        Tone.js score built IN BROWSER from story.json (deterministic, no LLM)
                   ARIA live text for all speech; buttons for every gesture
ONE BACKEND:       Cloud Run, one ADK "Narrator" agent
                   tools: get_value(region,year), get_moment(n), get_fact(id)
Navigator ->       POST /ask {story_id, question} -> {text, cited_fact_ids}
```

- Composer as an LLM agent is cut. Music rules are code (scale mapping, rests for no data).
- Grounding is structural: the Narrator answers only from tool results and returns `cited_fact_ids`. The frontend refuses to speak an answer with no citations.
- Live mode = GIBS layers only. The colormap file gives exact colour-to-value, so no legend OCR. Pre-test 6 layers; anything else offers the nearest gold story.
- Vibration API: unsupported on iOS Safari, supported on Chrome for Android, needs a tap and foreground page [verified: https://caniuse.com/mdn-api_navigator_vibrate].
- ADK Python supports Gemini Live streaming (FastAPI, WebSocket) and Cloud Run [verified: https://adk.dev/streaming/dev-guide/part1]. Other ADK languages: [unverified].
- Hours (~48 h): data 14, frames 14, sound 12, agent 10, frontend 20, red team 8. Hour 1: schema. Hour 6: mock story plays. Hour 24: one gold story with Q&A. Hour 40: three stories, frozen.
- Stage failures:
  - No internet: service worker holds story files and ~20 pre-rendered answers.
  - Slow API: 4 s timeout, then cached answer.
  - No vibration: earcon plus text.
  - Screen reader on: explicit "explore mode" toggle plus a button grid over regions [assumption: test under TalkBack by hour 12].
- Verify at hour 0-3: GIBS endpoints and layer IDs, Navigator's HTTP ability, Android speech recognition needing internet, and Web Audio start-on-tap [all unverified].

## 2. Radical alternative: "No backend at all" (feasibility 5/5)

A static site only. Story files, fact sheets and ~40 cited Q&A pairs are built offline (an LLM may draft them; the red team verifies). Voice is the browser's speech synthesis; answers come from fuzzy keyword retrieval. No ADK, no Cloud Run, no keys on stage. The Narrator cannot hallucinate by construction. Loss: no open-ended questions. Keep an optional "ask anything" agent button that can be dropped in one line.

## 3. Cut

Live mode for arbitrary EIC videos (legend CV, ffmpeg, fade detection) as the headline. It is the least reliable part and a judge can break it. Keep "refuse what cannot be read honestly" for everything that is not GIBS. Also cut Earth Symphony unless the gold stories finish by hour 36.

Weakest point of my own proposal: it leans on an unverified Navigator and on a custom touch surface surviving TalkBack; if either fails, it collapses into the radical version.
