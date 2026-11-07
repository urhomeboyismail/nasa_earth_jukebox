# Earth, Out Loud — NASA Space Apps 2026 (Port Louis, Mauritius)

Challenge: **The Earth Information Jukebox**. Full brief: `docs/challenge.md`.
Current project plan (long; read the sections you need, not all of it): `docs/plan.md`.

## The challenge in five lines

1. Build an "Earth Jukebox": pair NASA Earth Information Center (EIC) visual frames with sonifications generated in real time.
2. A user selects or experiences a specific EIC visualization alongside its soundscape. Interactive tool or curated playlist of generated audio: both are allowed.
3. Frames are the foundation of the audio (colour, brightness, shape, pixel density → pitch, rhythm, tempo, volume, instrument).
4. Balance strict data translation with musicality. Raw pixel-to-sound is noise.
5. Accessibility for blind and low-vision users is a core theme (screen readers, tactile feedback, rich descriptive text).

## Current concept (baseline to beat, not to defend)

"Name any NASA Earth visualization, and we let you hear it, touch it and ask it questions, even if you can't see it."
Voice-first, touch-first web app. Navigator (the team's existing voice assistant that navigates websites) is the front door; Google ADK agents (Narrator, Composer) behind it. One shared **story file** per story. Gold stories (Arctic ice, global temperature, sea level or Indian Ocean upwelling) plus live mode for any EIC visualization. Jukebox shelf with Side A (Listen) / Side B (Analyze), touch-the-planet, haptic language, five-voice audio description, Earth Symphony finale.

## Phase

**Brainstorm phase. No application code.** Agents write ideas, critiques, scores and specs as markdown under `brainstorm/`. Small throwaway snippets to explain an idea are fine; building is not.

## Hard rules (every agent)

1. **Truth first.** Never invent numbers, dataset names, API endpoints, layer IDs, dates or study results. Tag claims: `[verified: <url>]`, `[unverified]`, or `[assumption]`. A decision may not rest on an `[unverified]` claim.
2. **NASA data is required** for Global Award eligibility, and every dataset used must be documented. Prefer NASA sources (EIC/earth.gov, SVS, GIBS, NSIDC, GISTEMP, PO.DAAC, POWER).
3. **No NASA branding** (logos, insignia, mission patches, flags) in anything generated. Disclose all AI use (code, audio, images) in the submission.
4. **Never fake data in sound.** Missing data is silence (a rest), not an invented value. Low-confidence readings are announced as such.
5. **Narrator is grounded.** Anything spoken as fact must exist in the story file or a cited fact sheet.
6. **Accessibility is the product, not a feature.** Every idea must say how a blind user does it without sight, and how it behaves with TalkBack/VoiceOver on. Every gesture needs a button or voice equivalent. Everything spoken also exists as text (braille displays, deaf-blind users).
7. **Audio rules from research (see plan):** no background music or lofi under data — the sonification is the music; sonification pauses while the voice speaks; at most two data layers at once; 3–5 key moments per story; earcons for frequent feedback, natural sounds for rare events.
8. **Feasibility gate.** Six people, one hackathon weekend (~48 h). If an idea cannot be demoed end to end by six students in that time, it is a stretch goal, not the core.
9. **Disagree on purpose.** Agreeing with the plan or another agent without a reason is a failed contribution. Name the weakest point of every idea you touch, and propose a better alternative.
10. **Short and plain.** Plain English, short sentences. Respect the word limits the facilitator sets.

## How the work is judged (verify against the 2026 guides before the event)

Judging criteria (Space Apps judging guide, 2024 edition): **Influence** (size and quality of impact), **Creativity** (novel vs incremental), **Validity** (scientifically sound, would work in the real world), **Relevance** (answers the challenge, complete, feasible, user-friendly), **Presentation** (tells the story of the challenge, the solution and why it matters).

Award categories worth targeting: Art & Technology, Best Use of Data, Best Storytelling, Galactic Impact, Most Inspirational, Local Impact (Mauritius).

Submission (2025 guide): project summary; **demo = a video of at most 30 seconds (English subtitles) or at most 7 slides**; public final project link with no login; detailed description; NASA data used and how; all other data/code/images credited; AI-use disclosure. Everything in English.

Our own scoring rubric for brainstorming: the five judging criteria (1–5 each) + **Feasibility in 48 h** (1–5, a gate: below 3 = stretch only) + **Accessibility depth** (1–5).

## Team (humans) — fill this in, agents plan against it

| Person | Role in plan | Strongest skills | Hours available |
| --- | --- | --- | --- |
| Raghav | | | |
| 6 persons team, everyone will be usimg claude code and codex
| | | | |
| | | | |
| | | | |
| | | | |

Plan roles: data engineer, frame analyst, sound designer, agent/voice (Navigator + ADK), frontend/accessibility, red team.

## Tech stack candidates (the tech-architect must challenge and verify these)

- **Frontend:** installable web app (PWA). Web Audio API + Tone.js for synthesis; Web Speech API or a cloud TTS/STT for voice; Vibration API (Android Chrome only — iOS web cannot vibrate); ARIA live regions; target WCAG 2.2 AA.
- **Agents:** Google Agent Development Kit (ADK) with Gemini models for Narrator and Composer; the existing Navigator voice assistant as the single front door (it calls ADK agents, never the reverse). Evaluate Gemini Live / streaming for low-latency voice.
- **Data pipeline (offline, pre-computed):** Python — xarray, earthaccess (Earthdata login), rioxarray, OpenCV / scikit-image (frames, Lab colour matching), ffmpeg (frame extraction), Pillow. Output: small JSON story files. Never stream raw grids into the app.
- **Imagery:** NASA GIBS (date-based layers + colormap XML for exact colour→value), NASA SVS API (EIC visualization metadata, frame sets where offered).
- **Hosting:** static frontend host + one small backend (e.g. Cloud Run) for ADK agents.
- **Testing:** TalkBack (Android), VoiceOver (iOS), NVDA (Windows), axe accessibility checks, and at least one real blind or low-vision tester.

## Skills (from ECC, in `.claude/skills/`)

Nine skills copied unchanged from ECC (github.com/affaan-m/ECC, MIT, commit b38be6a, 2026-10-29). Only these nine are installed on purpose: the full ECC bundle has 300+ skills plus hooks, which would flood every agent's context and run hooks we have not reviewed. Do not install the full `ecc@ecc` plugin in this repo.

| Skill | Used by | When |
| --- | --- | --- |
| `product-lens` | facilitator | Round 0 (Mode 1, product diagnostic → `brainstorm/PRODUCT-BRIEF.md`); Round 4 (Mode 4, ICE scoring to cut features). Skip Mode 2 (revenue/PMF signals do not apply). |
| `council` | facilitator | Round 4: the top-2 decision. Facilitator = Architect voice; Skeptic, Pragmatist, Critic = fresh subagents given only the question and the scoreboard. |
| `santa-method` | facilitator | Round 6: two independent reviewers must both pass `FINAL.md` (facts verified, rules met, feasible) before it ships; max 2 fix loops, then escalate to the human. |
| `research-ops` | prior-art-scout, data-scout | Every research task: fact vs inference vs recommendation, lightest evidence path first. |
| `search-first` | tech-architect | Before proposing custom tech: adopt / extend / build. |
| `architecture-decision-records` | tech-architect, facilitator | Round 6: one ADR in `docs/adr/` per hard-to-reverse decision (platform, stack, agent design, gold stories). |
| `accessibility` | accessibility-lead | WCAG 2.2 AA checklist applied to designs and flows. |
| `scientific-thinking-literature-review` | sound-designer | When a design choice rests on research. |
| `scientific-thinking-scholar-evaluation` | judge-red-team | Sub-scores for the Validity criterion. |

Notes: `research-ops` mentions Exa and Firecrawl; they are optional — without them, use WebSearch/WebFetch. Some skills mention other ECC skills or commands (e.g. `knowledge-ops`, `/save-session`) that are not installed here: ignore those steps and write to `brainstorm/` instead.

For the build phase later (not installed yet): `blueprint` (construction plan), `intent-driven-development` (acceptance criteria), `frontend-slides` (the 7-slide deck), `ui-demo` (recording the demo video). Add them from ECC when the brainstorm is done.

## Repo layout

```
CLAUDE.md
docs/challenge.md        # verbatim challenge brief
docs/plan.md             # Earth, Out Loud: Project Plan (source of truth until FINAL.md replaces parts of it)
.claude/agents/          # brainstorm team
.claude/skills/          # nine ECC skills (see Skills)
docs/adr/                # architecture decision records (Round 6)
brainstorm/              # all brainstorm output, one folder per round
  PRODUCT-BRIEF.md       # Round 0 product diagnostic
  decisions.md           # facilitator's running decision log (what, why, who dissented)
  FINAL.md               # final concept
  plan-changes.md        # proposed edits to docs/plan.md — applied only after a human approves
```

## Collaboration protocol

- The main session (Opus) is the **facilitator**: it runs rounds, assigns lenses, synthesizes, scores and decides. It does not pitch its own ideas in the first divergent round.
- Subagents cannot see each other's work unless the facilitator tells them which files to read. Round 1 is always independent (no peeking) to avoid groupthink.
- Every agent output starts with a 2-line TL;DR and ends with "Weakest point of my own proposal:".
- Do not edit `docs/plan.md` or `docs/challenge.md`. Propose changes in `brainstorm/plan-changes.md`.
