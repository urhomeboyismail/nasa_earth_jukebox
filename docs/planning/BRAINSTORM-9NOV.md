# Brainstorm, 9 Nov 2026: what is built, what is missing, what to add

For the team and our coding agents. It compares [`docs/PLAN.md`](../PLAN.md) with the code on `main` (`d4fc1d9`), walks the user journey from the first visit, and lists new features as **independent cards** (F36 onward). To build one, ask your agent: *"Implement F37 following `.claude/rules/tickets.md`."* The loop is explained in [`docs/features/README.md`](../features/README.md).

How this was made: jcodemunch (repo outline and map), a code inventory of every feature folder, and an ECC-style review (product lens, accessibility architect, feasibility red team) against the judging criteria. Every "built" or "gap" claim below was checked in code, not in docs.

## 1. TL;DR

- The machinery is built, and it works for any data set: analysis, three sound styles, the explorer, time travel, story, Compare and test mode, Ask, the voice guide, demo mode, the phone layout.
- **The biggest gaps are not features:**
  - no real NASA data set is listed in `public/data/index.json`;
  - no tester has been through the protocol (n = 0);
  - `README.md` is still the Vite template.
- **A rule is broken.** Temperature words are written into `src/`, so on a sea-ice or vegetation data set the app would talk about "warmer water". `IDEAS-REVIEW-9NOV.md` §6 says "None in code", which is wrong. The fix (F36) comes first.
- The headline new experience is a **welcome mascot** (F37): a small astronaut who greets the listener, asks how they want to use the app and runs a sound check. It is scripted, works with the server off, and never talks over a screen reader.

## 2. Planned vs built

### 2.1 Gaps

| Area | Planned | In the code | Gap |
|---|---|---|---|
| Real data | A NASA data set with a baseline (T85) | `index.json` lists `fixture` and three `synthetic-*` sets. `public/data/rehearsal-sst/` (MUR sea temperature around Mauritius, 2023) is on disk but git-ignored, has `"comparisons": []`, and says its credit is "not yet checked" | **Critical** (T85) |
| Evidence | Testers, playlist, write-up, video (T87, F34) | Protocol and results note in `docs/evidence/`; n = 0; no `CREATIVE_PROCESS.md`, `PLAYLIST.md` or project README | **Critical** (T87) |
| Words come from the manifest | `phases.md`: no unit, label or value words in `src/` | "warmer water" in `src/features/home/index.tsx:24`, `src/features/player/index.tsx:265` and `src/features/compare/index.tsx:217`; "Trace the warm edge" in `src/features/player/index.tsx:248`; "There is no warm edge" in `src/features/player/usePlayer.ts:277`; `'warmer'` in `src/features/compare/judge.ts:39`; "Warmest:" in `src/describe/index.ts:177` | **Rule broken** → F36 |
| Change style (v2) | The default for data sets with a baseline if it passes the 13 Nov check | Plays only on `synthetic-change`; nobody has listened to it | Listening check on real data (T114 step 7) |
| Learn | Teaches every cue | No card for the change style, the warm-edge trace (`T`) or the lock key (`L`); the "Explore the map" card leaves out `L` (`src/features/learn/index.tsx`) | F38 |
| Demo caption | "Read out" | An `aria-live` region (`src/features/demo/DemoControl.tsx:77`), so screen readers hear it, but there is no audio for a room or for a listener without a screen reader. The comment at `src/features/demo/script.ts:8` says "read out", which is not true | F42 |
| Legend | Every sound has a text equivalent | The legend on Listen and About is visual only. Learn has "Play all, coolest to warmest" (`src/features/learn/index.tsx:176`) | F39 |
| Regions | `regions[]` in the manifest | Only `regions[0]` is used (`usePlayer.ts:50`, `compare/index.tsx:71`, `TestMode.tsx:64`, `about/index.tsx:18`, `ask/facts.ts:60`; the schema enforces it for comparisons) | F48 (T98) |
| Offline | Installable app | Manifest and icons, **no service worker**, so it needs the network | F51 |
| Deep links | Share the moment | The hash carries the page and `?data=` only (`src/route.ts`); `hashFor` already takes any parameters | F40 |
| Voice guide | Reads the screen, controls playback | 5 tools in `server/app/assistant/tools.py`: `navigate_to`, `explain_section`, `control_playback`, `set_date`, `get_screen_context`. It cannot see the explorer's cell or lock | F50 |
| Housekeeping | — | `src/components/index.ts` line 1 says "nothing else imports them yet"; every page imports them | One-line fix in any ticket that touches the file |

### 2.2 Built: keep, and the one thing to improve on each

| Feature | Where | Improve |
|---|---|---|
| F1–F11 data, viewer, analysis worker, engine, player, Learn, Compare, About, a11y checks, guide context, test mode | `src/data`, `src/analysis`, `src/audio`, `src/features/*`, `server/app/study` | Real data and a real screen-reader tester |
| F12 music pauses for the guide | `src/assistant/ducking.ts` | Check on a phone |
| F13 stereo, F20 3D HRTF | `src/audio/pan.ts` | Headphone check: can north and south be told apart? Hide 3D if not |
| F14 WAV export | `renderToWav`, Download button | Make the playlist and the demo backup |
| F15 vibration | `src/features/player/vibration.ts` | Say on About that iOS has none |
| F18, F27, F28 change style, warm-edge trace | `src/analysis/{change,contour,score}.ts`, `src/audio/changeVoice.ts` | Listen to it on real data |
| F19 concise or rich descriptions | `src/describe/detail.ts` | A tester picks the default |
| F23 time travel | explorer, `L` | Teach it on Learn (F38) |
| F29 test sound, F30 both ways, F31 data table, F32 Ask, F33 what the sound hides | `src/features/player/`, `src/features/ask/`, `src/audio/coarse.ts` | A listener check before any claim about F33 |
| F35 demo mode | `src/features/demo/` | Run it on the real data set; speak it (F42) |
| Story | `src/features/story/` | Real chapters with sourced facts (data only) |
| T120 phone, PWA manifest | `public/manifest.webmanifest` | 360 px check on Learn, Compare and About |

## 3. The user journey, from the first visit

**Built** is on `main` today; **New** is a card below.

| # | Step | Built | New |
|---|---|---|---|
| 0 | **Arrive on Home** | Intro, "Start here" list, demo button | **F37** The mascot welcomes the listener and offers three paths: "I use a screen reader", "I can see the map", "Just play me something". The choice is remembered and sets the defaults |
| 1 | **Sound check** | F29 Test sound (one note) | **F37** Left, right, centre and a volume comfort step, in the mascot's words |
| 2 | **Learn the sounds** | Notes, chord, slide, bell, tick, hiss, "Play all" | **F38** Change style, `T`, `L`; **F36** the words come from the data set |
| 3 | **Pick a data set** | Data set picker | **F49** A shelf of cards with a picture, dates, and "real NASA data" or "practice data" |
| 4 | **Listen** | Play, both ways, styles, speed, volume, 3D, vibration, table, Ask | **F39** hear the legend; **F44** legend highlight; **F47** caption strip; **F41** `?` shortcuts |
| 5 | **Explore the map** | Keys, sweeps, sliders, touch, `L` time travel, `T` trace | **F43** jump to the extreme; **F52** two-date difference; **F48** region picker |
| 6 | **Story** | Chapters (synthetic-globe only) | Real chapters for each NASA data set (data, §5) |
| 7 | **Compare / practise** | Compare, reveal, test mode | **F53** ear-training game; **F36** wording |
| 8 | **Ask** | Offline rule-based answers | The mascot points to Ask when the server is off |
| 9 | **Take it with you** | WAV download | **F40** link to this exact moment; **F46** text transcript; **F55** postcards |
| 10 | **About and trust** | Source, method, limits, legend | **F45** "Sound recipe" card from the manifest |
| 11 | **Demo mode** | 6-step scripted tour, visual caption | **F42** spoken caption; **F37** the mascot hosts it |

## 4. Feature catalogue

Every card is meant to be built on its own, from `main` as it is today, by whoever claims it in [`docs/features/README.md`](../features/README.md). "Expected tickets" is the minimum; the rule in `.claude/rules/tickets.md` says to keep it there.

Common rules for every card: nothing specific to one data set in `src/` (`phases.md`); no model in `src/analysis`, `src/audio`, `src/describe` or `judge.ts` (`src/boundary.test.ts`); every control labelled and keyboard-usable, changes announced through `useAnnounce`; 44 px targets, checked at 360, 768 and 1280 px (`platform.md`); the app works with the server off.

### Now (before 12 Nov)

#### F36 Manifest wording
- **Goal:** the app's comparison words ("warmer", "warm edge", "water") come from the manifest, so any data set reads correctly.
- **Helps:** every listener of a data set that isn't temperature (sea ice, vegetation, rain). A blind user hears words that match the data.
- **Scope:** a general optional field, for example `variable.words: { higher: "warmer", lower: "cooler", highest: "warmest", lowest: "coolest", edge: "warm edge", thing: "water" }`, defaulting to today's words so every data set sounds the same. Replace the strings listed in §2.1. Out of scope: new languages.
- **Touches:** `src/data/types.ts`, `src/data/schema.ts` (team leader and Dhruv); the callers in `home`, `player`, `compare`, `judge.ts` and `describe`; `docs/data-sources.md` → "Manifest fields".
- **Done when:** every existing manifest validates unchanged and every snapshot or golden text is unchanged; a test manifest with `higher: "more ice"` makes Compare, Listen, Home and `describeSequence` use it; a grep for "warmer" in `src/` finds only comments, tests and the default.
- **Size:** S–M. **Expected tickets:** 1 (one interface change, one PR, reviewed by the owners it touches). **Suggested owner:** Dhruv (schema), with Mohammad and Roni reviewing.

#### F37 Welcome mascot and onboarding
- **Goal:** a friendly astronaut mascot greets first-time visitors on Home, asks how they want to use the app, runs a sound check, and sets sensible defaults.
- **The look:** a small, round, yellow character with big goggles inside a white astronaut suit and a clear helmet.
  - **It must be our own original character, inspired by the idea, not a Minion.** Minions belong to Illumination and Universal, the submission is public, and our rules forbid other people's branding. Use our own name, shape and details, and none of the film's art or name.
  - Working name "Orbi"; the team agrees the final name on the board (R-20261109-F37-1).
  - Drawn as an inline SVG by the team, or generated with AI and disclosed in the README. No NASA logo, insignia or mission patch.
- **The flow:**
  1. On the first visit, a welcome section sits on Home after the heading: the mascot, one line of greeting, and three large buttons. "Skip" comes first in focus order.
  2. **"I use a screen reader":** concise descriptions on, no text-to-speech (the screen reader is the voice), go to Learn.
  3. **"I can see the map":** the mascot may talk (opt-in `speechSynthesis`), rich descriptions, go to Listen.
  4. **"Just play me something":** go to Listen and play the first data set, after the sound check.
  5. **Sound check:** F29's note, then left, right and centre using `src/audio/pan.ts` ("Did you hear it on your left?" Yes / No / Replay), then "Is this volume comfortable?" with the volume control.
  6. **Afterwards:** a small "Help from Orbi" button in the same place on every page (WCAG 3.2.6) gives one tip for that page, and it can bring the welcome back. A setting turns the mascot off.
  7. **With the server up:** "Talk to Orbi" opens the existing voice guide. The persona text (name and tone) is added to `server/app/assistant/knowledge.py`. The model only rewords, and the same 5 tools remain.
  8. The mascot hosts demo mode: its face sits next to the caption.
- **Accessibility:**
  - No sound or speech before a click or key press (WCAG 1.4.2).
  - No text-to-speech on the screen-reader path; everything goes through `useAnnounce`.
  - Inline, not a modal; focus is never hidden behind the voice panel or the bottom bar (WCAG 2.4.11).
  - The avatar is decorative (`alt=""`); animation only under `prefers-reduced-motion: no-preference`.
- **Rules:**
  - Not a new page, so `src/pages.ts` and `knowledge.py`'s page list stay in step.
  - Lines live in `src/features/welcome/` and name no data set; any fact about the data comes from `src/describe/`.
  - The choice is stored in `localStorage` under `earth-jukebox:welcome` with try/catch, like `src/audio/style.ts`.
  - The component is lazy-loaded, so the first load stays small.
- **Touches:** `src/features/welcome/` (new), `src/features/home/index.tsx`, one button in the app shell (`src/App.tsx`), `src/features/demo/DemoControl.tsx`, optionally `server/app/assistant/knowledge.py`.
- **Done when:** first visit shows the welcome and a second does not; each path sets its defaults and moves focus to the right heading; the sound check plays left and right through the fake engine with pans of -1 and +1; nothing plays before a gesture; "Help from Orbi" works by keyboard on every page; axe passes; checked at three widths and with reduced motion; with the server off everything but "Talk to Orbi" works.
- **Size:** M. **Expected tickets:** 2.
  1. Welcome, the paths and the sound check.
  2. Per-page help and demo hosting.
- **Suggested owner:** Roni (Home, components) with Mohammad (shell, demo).

#### F38 Learn fills
- **Goal:** Learn teaches every cue that Listen can make.
- **Scope:** a card "Change from normal" (play the five change steps in order; shown only when the data set has a baseline); a card "The warm edge" (`T`, trace one line, then its description); add `L` and "Play this place across the dates" to the "Explore the map" card. Words come from F36 once it is merged, and from today's strings until then.
- **Touches:** `src/features/learn/`. **Done when:** the cards call the engine with the expected steps (fake engine), are hidden without a baseline, and axe passes. **Size:** S. **Expected tickets:** 1. **Suggested owner:** Roni.

#### F39 Hear the legend on Listen
- **Goal:** one button next to the legend on Listen plays the categories coolest to warmest and announces each label as it sounds.
- **Scope:** reuse Learn's "Play all" logic; move it into a shared helper rather than copying it. **Touches:** `src/features/player/`, `src/features/learn/` (the helper). **Done when:** it plays one step per category in order and announces each label; Stop works; axe passes. **Size:** S. **Expected tickets:** 1. **Suggested owner:** Mohammad.

#### F40 Deep links and Share
- **Goal:** a link opens the exact moment: data set, date, explorer cell and sound style.
- **Scope:** read `date`, `cell` (`col,row`) and `style` from the hash; write them with `hashFor` when they change (replace, not push, so Back still works); a "Copy link to this moment" button that announces "Link copied". Unknown values are ignored, never a crash. **Touches:** `src/route.ts`, `src/features/player/`, `src/features/explore/`. **Done when:** route tests cover parsing and the bad values; opening a link sets the date and the cell; axe passes. **Size:** S. **Expected tickets:** 1. **Suggested owner:** Mohammad.

#### F41 Shortcuts dialog
- **Goal:** `?`, or a "Keyboard shortcuts" button, lists every key on the page.
- **Scope:** a native `<dialog>` with a table generated from one list of shortcuts, which the keyboard handlers also read, so the list never drifts. Check WCAG 2.1.4: the single-letter keys `T` and `L` work only while the map or player has focus; say so in the dialog. **Touches:** `src/components/` (dialog), `src/features/player/`, `src/features/explore/useExplorer.ts`. **Done when:** the dialog opens and closes by keyboard, returns focus, and lists the same keys the handlers use (one test). **Size:** S. **Expected tickets:** 1. **Suggested owner:** Roni.

#### F42 Spoken demo caption
- **Goal:** in a room, the demo can be heard as well as read.
- **Scope:** an opt-in "Read the demo aloud" switch, off by default and off on the screen-reader path (F37); `speechSynthesis` speaks each caption, and the music pauses while it talks (reuse the ducking idea in `src/assistant/ducking.ts`). Fix the `script.ts:8` comment. **Touches:** `src/features/demo/`. **Done when:** with the switch on, each step calls `speak` (mocked) and the player pauses; off, nothing is spoken; axe passes. **Size:** S. **Expected tickets:** 1. **Suggested owner:** Mohammad.

### Next (13–14 Nov, alongside the real data)

| ID | Feature | Goal and scope | Touches | Size, tickets |
|---|---|---|---|---|
| F43 | Jump to the extreme | In the explorer, `W`/`C` (and buttons) move to the warmest or coolest readable cell, and in the change style the most-changed cell; ties go to the first in reading order. Uses F36 words for the button labels | `src/features/explore/` | S, 1 |
| F44 | Legend highlight | While a note plays, its band on the visual legend is outlined, so a low-vision or sighted listener links colour and pitch. `aria-hidden`, because the announcer already speaks | `src/components/Legend.tsx`, `src/features/player/` | S, 1 |
| F45 | Sound recipe card | On About, a table made from the manifest: each category's range, note and label; change steps and contour notes when present; the noise floor and the missing-data cue | `src/features/about/` | S, 1 |
| F46 | Text transcript | "Download the description (text)" next to the WAV: `describeSequence`, then one line per date from `describeFrame`, with the source and credit. Pure text, made by the rules | `src/features/player/` | S, 1 |
| F47 | Caption strip | A visual line under the map showing what is sounding ("♪ warm · east · slide up"). `aria-hidden` so it isn't read twice; helps deaf, hard-of-hearing and sighted judges | `src/features/player/` | S–M, 1 |
| F48 | Region picker | Choose any manifest region on Listen and Compare; comparisons keep their own `regionId`. Lifts the `regions[0]` limit (T98) | `src/features/player/`, `src/features/compare/`, `src/data/schema.ts` | M, 2 (player; compare and schema) |
| F49 | Jukebox shelf | Home shows a card per data set: optional manifest `cover` image, date span, "Real NASA data" or "Practice data". Start once there are two real data sets | `src/features/home/`, `src/data/schema.ts` | M, 1 |
| F50 | Guide sees the explorer | `get_screen_context` also reports the explorer's cell, lock and style. Read-only: no new action reaches the app | `src/assistant/context.ts`, `server/app/api/assistant.py` `CONTEXT_KEYS`, `docs/PLAN.md` §5.4 | S, 1 |

### Later, or the "what's next" slide

| ID | Feature | Why later | Size, tickets |
|---|---|---|---|
| F51 | Service worker (offline app and data) | A stale cache on demo day is worse than no cache; the WAV playlist is the offline backup | M, 1 |
| F52 | Two-date difference in the explorer | Strong, but overlaps the change style | M, 1 |
| F53 | Ear-training game | Overlaps Learn and Compare; scoring must stay in `judge.ts` | M, 1 |
| F54 | Earth Symphony | A 20 s sequential medley of each real data set, made with WAV export, for the video only (parked idea, revive condition met once two real data sets exist) | M, 1 |
| F55 | Sound postcards | A printable card with a QR code to an F40 deep link, for Mauritius classrooms (Local Impact) | S, 1 (after F40) |

### Cut, with the reason

| Idea | Why |
|---|---|
| Listening-test results page | n = 0; empty statistics hurt. Report n and the caveats in the README |
| Settings panel (contrast, text size) | The browser already does it. Support `prefers-contrast`, `forced-colors`, `prefers-reduced-motion`, and check reflow at 200% and 400% |
| MIDI export | No audience for it in this challenge |
| New voice-guide action tools | They extend what a model can do just when data and evidence are the gaps; F50's read-only context is enough |
| F21, F22, F24, F25, ADK, live-model Q&A | Still cut. None meets its revive condition (`FEATURE-REVIEW.md`, `brainstorm/parked-ideas.md`) |

## 5. Data refinement (manifests only, through `DATASET-PLAYBOOK.md`)

No code. Each is one data set's folder and its `index.json` entry.

- **Sea temperature around Mauritius (MUR, from `rehearsal-sst`).** Choose the baseline kind (same-month climatology if one can be fetched, otherwise `reference-date` labelled "change since <date>"), check the credit and licence against the source page, write 3 to 5 comparisons, including two where the absolute answer and the change answer differ, and 3 to 5 story chapters with every fact sourced. This is the **Local Impact** and **Best Storytelling** entry.
- **Sea ice:** two categories ("open water" and "ice"), with F36 words such as `higher: "more ice"`. It proves the design is general.
- **Global temperature anomaly:** `baseline.kind: "anomaly-product"`, so the change style plays without subtraction. This is the **Best Use of Data** entry.
- For each: `mapArea` that leaves out legends and logos, checked in the explorer on two dates; `npm run check-data` passes.

## 6. Demo and judging polish

| Criterion or award | What shows it | Source |
|---|---|---|
| Influence, Most Inspirational | The mascot welcome on the screen-reader path; a blind tester's quote, with permission | F37, T87 |
| Creativity, Art & Technology | The warm-edge trace on headphones; Earth Symphony in the video | F18, F54 |
| Validity, Best Use of Data | "What the sound hides"; the sound recipe card; a real baseline and comparisons with known answers | F33, F45, §5 |
| Relevance | The full journey in §3 working with the server off | — |
| Presentation, Best Storytelling | Demo mode hosted by the mascot, read aloud; the Mauritius story | F35, F37, F42, §5 |
| Local Impact | Mauritius sea temperature; postcards for classrooms | §5, F55 |

- **30 s video:** mascot welcome (5 s) → Mauritius story playing (8 s) → explore by keyboard to the warmest place (7 s) → trace the warm edge on headphones (5 s) → "what the sound hides" and the credit (5 s). Subtitled in English.
- **7 slides:** problem; who it is for; the journey; how sight becomes sound (the recipe card); evidence (n, honestly); limits; what's next (the Later list).
- **README:** what it is, the live link, how to run it, the creative process (link), the playlist (link), NASA data and credits, the AI disclosure (including the mascot art if AI-made), limits.

## 7. Open questions (ask on `docs/AGENT-BOARD.md`)

- The mascot's final name and who draws it (R-20261109-F37-1).
- Whether the "screen reader" path should also choose the Simple sound style, or leave the style alone until the 12 Nov practice test decides.
- Which NASA data sets are chosen on 13 Nov, and each one's baseline kind.
