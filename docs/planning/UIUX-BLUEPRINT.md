# Earth Information Jukebox: UI/UX blueprint

Page layouts, the welcome page's audio preferences, and how translated data is stored, reopened and fused. This is a reference and a proposal, not a ticket. It builds on [`PLAN.md`](../PLAN.md) §6.3 and the queue in [`TICKETS.md`](../TICKETS.md). Where a ticket already covers something, it is named, so nothing is built twice. Animations, 3D assets and icon libraries are out of scope.

## As built (13 Nov 2026, branch `feature/uiux-blueprint`)

What was built, and where it differs from the proposal below:

| Part | Built | Differs from the proposal |
|---|---|---|
| Styles (§1.3) | Five presets with instrument kits (`src/sonify/presets.ts`, `STYLE_IDS`), kit and Bass in the graph (`buildGraph`, `ensemble.setBass`) | Kits are waveforms for melody, bass and rhythm, not samplers |
| Preferences (§1.5) | `src/audio/prefs.ts`, key `earth-jukebox:audio-prefs`, zod `storedAudioPrefs` | Tempo is the existing Slow / Normal / Fast speed, not a 0.5–2× slider. No per-data-set override yet |
| Welcome (§1.2) | Style, Bass, speed, instruments and "Play sample" in the sound-check step (`SoundPrefs`) | — |
| Listen mixer (§2.2) | `SoundPrefs` in Symphony; mutes, speed, style and bass persist. Melody can be muted for the moment but is never stored muted | — |
| Library (§3.1) | Crate on Home: search, "Saved on this device" filter, recent row, save / remove (`src/data/offline.ts`, `public/sw.js`) | **No `tracks.json` and no IndexedDB tier**: a frame's features are ~40 KB as JSON, bigger than its PNG, and extraction is fast. The service worker is network-first, so there is no "out of date" state. No "Play 10 seconds" button |
| Fusion (§3.2) | Compare → "Two data sets" (`Fusion.tsx`, `fuseFrames`), `pairsWith` in the schema and checked by `check-data`; the synthetic globe and change sets are paired | No per-deck mute (the crossfader's ends do it) |

## 0. Read this first: where the brief and the repo differ

The brief assumes some things the repo has already decided otherwise. The blueprint follows the repo.

| The brief says | The repo does | Consequence for this blueprint |
|---|---|---|
| Heavy NASA videos are batch-processed offline into intermediate JSON time series | Offline work today is `scripts/eic_ingest.py`: it writes frames, the colour scale and `manifest.json`. Frames are then read **live in the browser** by a Web Worker (`src/analysis/`) into `FrameFeatures`. A pure ruleset (`src/sonify/`) turns those into a `MusicFrame`. Extraction contains **no model** (`src/boundary.test.ts`, PLAN §3) | The "translated JSON" is `manifest.json` + frames + a proposed **`tracks.json`** (§3.1): the same analysis code run once at ingest, deterministic, never written by a language model. `src/sonify/sidecar.ts` (SN12) already defines a stable per-frame JSON to copy the shape from |
| Music styles: Cinematic, 8-Bit, Lo-Fi, Heavy Bass, Nature | Three presets exist: `major`, `dorian`, `pentatonic` (`src/sonify/presets.ts`: tonic, scale, bpm, brightness) | Each style becomes **a preset plus an instrument kit**. Styles are artistic and never carry data; the app says so (PLAN §6.3) |
| Instrument stems, mute and solo | Seven voices with Mute and Solo already exist: `melody`, `harmony`, `bass`, `hotspots`, `rhythm`, `motion`, `time` (`VOICE_IDS` in `src/data/sonification.ts`, `VoiceMixer.tsx`) | The welcome page and the mixer edit the same state |
| Gesture gate / "Power on" | The welcome (F37, `src/features/welcome/Welcome.tsx`) already waits for a click, offers three paths (`screen-reader`, `map`, `play`) and has a volume check | The style and tuning steps are **added to** that welcome, not a new page |
| Preferences in `localStorage` | The pattern exists: `src/features/welcome/storage.ts` (key `earth-jukebox:welcome`, zod `storedWelcome` in `src/data/boundaries.ts`, guarded access, `useSyncExternalStore`) and `src/audio/style.ts` (`earth-jukebox:sound-style`) | The new preference store copies that pattern exactly |
| Combine two data sets (cyclones + rainfall) | Not built. One data set plays at a time; Compare plays two dates | Fusion is proposed as a second mode of Compare (§3.2), driven by a manifest field |
| Example data sets (Mauritius rainfall, Pacific currents) | Allowed in docs and data only. Nothing specific to one data set goes in `src/` (`.claude/rules/phases.md`) | Examples below are examples; code reads everything from manifests |

Layout is deferred to the end (`.claude/rules/platform.md`). This document gives regions in priority order, not breakpoints or widths. Wireframes show the wide layout; the narrow version stacks the regions in the order listed.

---

## 1. Welcome page: audio preferences and onboarding

### 1.1 Purpose

Arrive, say how you like to listen, and hear the first sound within about 10 seconds. Every step can be skipped, and skipping gives exactly today's sound.

### 1.2 Flow

| Step | What the person sees and does | Time | Exists? |
|---|---|---|---|
| 1. Power on | One large button, "Turn on the sound". Browsers block audio until a gesture; this click unlocks the `AudioContext` and plays a short start chime | ~1 s | Yes (F37 waits for a click) |
| 2. How will you use it? | Three choices: "I use a screen reader", "I can see the map", "Just play". Sets detail and speech defaults | ~2 s | Yes (F37 paths) |
| 3. What do you love listening to? | Five large radio cards (§1.3). Focusing or tapping a card plays a 3 s preview of the **real ensemble** on a synthetic data set in that style. Default: no choice, which uses the data set's own preset | ~4 s | New |
| 4. Tune it | Three controls: **Bass** (−6 to +6 dB), **Tempo** (0.5× to 2×), **Instruments** (seven checkboxes). A "Play sample" button repeats the preview with the new settings | ~3 s (optional) | New |
| 5. Volume check | The existing volume slider | ~1 s | Yes (F37) |
| 6. Done | "Start listening" goes to Listen (or Learn on the screen-reader path), with the preferences applied | — | Yes |

"Skip the welcome" stays visible at every step (it exists). Esc also skips. Steps 3 and 4 sit on one screen so the whole flow is at most three screens.

```
┌───────────────────────────────────────────────────────────┐
│  Earth Jukebox                          [Skip the welcome] │
├───────────────────────────────────────────────────────────┤
│  What do you love listening to?                            │
│  ( ) Cinematic   ( ) 8-Bit    ( ) Lo-Fi   ( ) Heavy  ( ) Nature
│      orchestral      arcade       ambient     bass       sounds
│  "Strings and brass, slow and wide."   ← text of the focused card
│                                                            │
│  Tune it                                                   │
│  Bass   ──────●──────  +2 dB                               │
│  Tempo  ────●────────  0.8×                                │
│  Instruments  [x] melody [x] harmony [x] bass [x] hot spots│
│               [x] rhythm [x] motion  [x] time              │
│                                    [Play sample] [Next →]  │
└───────────────────────────────────────────────────────────┘
```

### 1.3 Styles: what each one changes

A style is a preset (key, scale, tempo, brightness) plus an instrument kit (which Tone.js synth or sampler plays each voice). It never changes which data drives which voice, or how. That is the rule that keeps every style honest.

| Style | Scale and key | Base bpm | Brightness | Kit (melody / bass / rhythm) | One-line description (shown and spoken) |
|---|---|---|---|---|---|
| Cinematic Orchestral | Dorian | 72 | 0.4 | Strings / low brass / timpani | "Strings and brass, slow and wide." |
| 8-Bit Arcade | Major | 120 | 0.8 | Square lead / triangle bass / noise drums | "Bright chip sounds, like an old game." |
| Lo-Fi Ambient | Major (soft) | 76 | 0.3 | Electric piano / round sub / brushed kit | "Soft keys and a slow beat." |
| Heavy Bass Electronic | Minor pentatonic | 110 | 0.6 | Saw lead / wide sub bass / electronic kit | "Deep bass and a steady electronic pulse." |
| Organic Nature | Pentatonic | 64 | 0.5 | Marimba / bowed low drone / wood and shaker | "Wood, water and gentle percussion." |

These are starting values for a listening check, not final ones. The kits are samplers or Tone.js synths, loaded on demand like Tone.js itself (`frontend.md`: heavy libraries load on demand).

### 1.4 Controls and accessibility

| Control | Element | Keyboard | Screen reader hears | Notes |
|---|---|---|---|---|
| Style | `radiogroup` of `Card`s, each with a real radio | Arrows move and preview; Space selects | "Cinematic Orchestral, radio, 1 of 5. Strings and brass, slow and wide." | The preview stops when focus leaves. No autoplay before step 1 |
| Bass | `Slider` (`src/components/Slider.tsx`) | Arrows ±1 dB, Page ±3 dB | "Bass, plus 2 decibels" | Applied as a low shelf on the master bus, plus the bass voice gain. Labelled "the bass follows the long-term shift" |
| Tempo | `Slider` | Arrows ±0.1× | "Tempo, 0.8 times" | Changes playback speed only, never pitch |
| Instruments | Seven checkboxes in a `fieldset` | Tab, Space | "Melody, checkbox, checked" | Melody can't be switched off (the core value voice); its checkbox is disabled with the reason as its description |
| Play sample | `Button` | Enter | The sample's one-line text through `useAnnounce` | Every sound has a text equivalent |

### 1.5 State persistence

**Key:** `earth-jukebox:audio-prefs` (proposed). **Shape:**

```ts
type AudioPrefs = {
  v: 1                                   // schema version, so a later shape can migrate or reset
  style?: 'cinematic' | 'chiptune' | 'lofi' | 'bass' | 'nature'   // absent = use the data set's preset
  bassDb: number                         // -6..6, default 0
  tempo: number                          // 0.5..2, default 1
  stems: Partial<Record<VoiceId, boolean>> // absent voice = on
}
```

| Rule | How |
|---|---|
| Copy the existing pattern | Same structure as `src/features/welcome/storage.ts`: `readAudioPrefs`, `saveAudioPrefs(change)`, `resetAudioPrefs`, `useAudioPrefs()` via `useSyncExternalStore` |
| Trust nothing stored | Parse with a zod schema added next to `storedWelcome` in `src/data/boundaries.ts`. Bad or unknown fields fall back to defaults; an unknown `v` resets |
| Storage can fail | Every access in try/catch. A copy kept in memory holds the choice for this visit (private windows) |
| One source of truth | The welcome, the Listen mixer and Compare all read and write this one store. A change in the mixer is the same as a change in the welcome |
| Precedence | Per-data-set override (`earth-jukebox:audio-prefs:<id>`, only written when the person changes something while that data set plays) → global preferences → the manifest's `sonification.preset` → app defaults |
| Way back | "Reset to this data set's sound" in the mixer clears the override. "Show the welcome again" already exists (`resetWelcome`) and also offers "Forget my sound preferences" |
| Existing keys stay | `earth-jukebox:sound-style` (Full / Simple / Change) and detail stay where they are. They are not merged into the new key, so nothing existing migrates |

---

## 2. Page-by-page layouts

Pages today (`src/pages.ts`): Home, Learn, Listen, Compare, About. This blueprint **adds no page**; fusion lives inside Compare, so `src/pages.ts` and `server/app/assistant/knowledge.py` stay in step without changes.

### 2.1 Home / Crate

| | |
|---|---|
| **Purpose** | Find a data set and start it in one action; return to one played before. |
| **Regions (priority order)** | 1. Header: site name, navigation, a mute-everything button. 2. Search box. 3. "Continue where you left off" row (the last three data sets opened, from local storage). 4. The crate: a grid of sleeves. 5. Footer: credit. |
| **Sleeve** | A `Card`, one per `index.json` entry: poster frame (with `alt` from the manifest), title, source line, a tag line (theme, date range), a **saved badge** ("Saved on this device ✓", §3.1), and two buttons: "Play 10 seconds" and "Open". |
| **Search and filter** | One text box that filters by title, tags and source as you type; the result count is announced ("4 data sets"). Filter chips: "Saved on this device", and one chip per theme tag in `index.json`. |
| **Data and audio** | Reads `public/data/index.json` (zod-validated). "Play 10 seconds" loads that data set's manifest and first frames only, and plays through the ensemble with the person's preferences. |
| **Accessibility** | The crate is a `list` of `listitem`s; each sleeve's heading is its title. Buttons are real buttons with the title in their name ("Play 10 seconds of <title>"). |

```
┌───────────────────────────────────────────────────────────┐
│ Earth Jukebox   Home Learn Listen Compare About    [Mute]  │
├───────────────────────────────────────────────────────────┤
│ [Search data sets…                    ]  (Saved) (Ocean)…  │
│ Continue: ▸ <last 1>  ▸ <last 2>  ▸ <last 3>               │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                │
│ │ poster │ │ poster │ │ poster │ │ poster │                │
│ │ Title  │ │ Title  │ │ Title  │ │ Title  │                │
│ │ Saved ✓│ │        │ │ Saved ✓│ │        │                │
│ │[Play10][Open]       │ …        │ …        │               │
│ └────────┘ └────────┘ └────────┘ └────────┘                │
└───────────────────────────────────────────────────────────┘
```

### 2.2 Listen / Jukebox stage

| | |
|---|---|
| **Purpose** | Hear one data set: play, scrub, explore, and shape the sound. |
| **Regions (priority order)** | 1. **Stage**: the map or video, `role="application"`, with the caption strip under it. 2. **Transport bar**: Play/Pause, timeline scrubber with date labels (IX06), a date selector (a native date input limited to the data set's dates), speed. 3. **Mixer panel** (right rail; a collapsible section on narrow screens). 4. **Moments** panel (marked events, IX08). |
| **Mixer panel** | **Style** (the five styles plus "Data set default"; the same radio group as the welcome, compact). **Voices**: the existing `VoiceMixer` (Mute and Solo per voice). **Bass** and **Tempo** sliders. **Detail** (Calm / Standard / Full, exists). "Reset to this data set's sound". Every control reads and writes `useAudioPrefs`. |
| **Data and audio** | `Frame → Worker → FrameFeatures → ruleset → MusicFrame → Tone.js ensemble`. If `FrameFeatures` are cached or in `tracks.json` (§3.1), the Worker step is skipped. A style change applies at the next frame without a reload; every change ramps and never jumps. The master compressor and limiter always sit last. |
| **Accessibility** | Transport keys come from the input layer (IX01). A style or tuning change is announced once ("Style: Lo-Fi Ambient"). The data table stays available as an alternative view. |

```
┌───────────────────────────────────────────┬───────────────┐
│                                           │ Style         │
│              STAGE (map / video)          │ (•) Data set  │
│                                           │ ( ) Cinematic │
│                                           │ …             │
├───────────────────────────────────────────┤ Voices        │
│ caption: "Warmer in the east; one hot spot"│ melody [M][S] │
├───────────────────────────────────────────┤ harmony[M][S] │
│ [▶] ──────●─────────────  2024-03-14 [📅] │ …             │
│     Jan        Mar        May       Jul   │ Bass  ──●──   │
│ Speed 1×                                  │ Tempo ──●──   │
├───────────────────────────────────────────┤ Detail Std    │
│ Moments: ▸ 03-14 new hot spot ▸ …         │ [Reset]       │
└───────────────────────────────────────────┴───────────────┘
```

### 2.3 Compare

| | |
|---|---|
| **Purpose** | Hear a difference: between two dates of one data set, or between two data sets. |
| **Mode switch** | A two-option `ButtonGroup` at the top: **"Two dates"** (today's Compare) and **"Two data sets"** (fusion, §3.2). |
| **Regions, two dates** | 1. Two stages, A and B, side by side (stacked when narrow). 2. A shared scrubber with handles A and B. 3. The "A in the left ear, B in the right" toggle (IX07). 4. A difference summary in words, from the change field (`field.ts`, `change.ts`). |
| **Regions, two data sets** | 1. Two deck panels, A and B, each with a picker and a stage. 2. A linked timeline (the overlap of both date ranges). 3. A crossfader between A and B. 4. A combined caption that names the deck behind each voice. |
| **Data and audio** | Two dates: dated frames from one manifest. Two data sets: two pipelines into one ensemble (§3.2). |

```
 [ Two dates | Two data sets ]
┌──────────────────────┐ ┌──────────────────────┐
│ Deck A: <title A> [▼]│ │ Deck B: <title B> [▼]│
│      STAGE A         │ │      STAGE B         │
└──────────────────────┘ └──────────────────────┘
 Linked time: 2024-01 ────●──────── 2024-06  (overlap only)
 A ◀──────────●──────────▶ B    crossfader
 Caption: "Melody and harmony follow A's rainfall; bass and rhythm follow B's storm track."
```

### 2.4 Pages that stay as they are

| Page | Change from this blueprint |
|---|---|
| Learn the sounds | None to layout. Lessons play in the person's chosen style, so what they learn sounds like what they will hear |
| About the data | Adds one line per style: "Styles are a choice of taste. They change the instruments, never what the data says." |
| Jukebox studio (G10, behind `JUKEBOX_ENABLED`) | None. It plays the orchestrator's `AudioPayload`; it may later read the style as a hint |

---

## 3. Translated data: storage and retrieval

### 3.1 The Jukebox Library: reopening a data set instantly

Three tiers, from the server to the device. Each one only makes things faster. If any of them fails, the app falls back to the tier before it and finally to live analysis, which always works.

| Tier | What is stored | Where | Written when | Read when |
|---|---|---|---|---|
| **A. Published** | `public/data/<id>/manifest.json`, frames, and a proposed `tracks.json` | Static files on Vercel, with HTTP caching | At ingest (`scripts/eic_ingest.py` plus a proposed Node step that runs `src/analysis/` over the frames) | First open on any device |
| **B. Saved files** | That data set's manifest, frames and `tracks.json` | Cache Storage in the browser (a service worker is not needed for this; there isn't one today, T120 added only the manifest and icons) | When the person turns on "Save for offline" on a sleeve, or automatically after a full play (a setting) | Every later open, also offline |
| **C. Analysed frames** | Per-frame `FrameFeatures`, keyed by data set id + a hash of the manifest | IndexedDB | After the first live analysis of a data set without `tracks.json` | Later plays skip the Worker |

**`tracks.json` (proposed).** One entry per frame: `frameId`, `date`, and the `FrameFeatures` the Worker would produce, plus the manifest hash it was made from. It is made by the same pure code as the browser, so the browser and the file agree by construction. It is optional; without it the app analyses live as it does today. `npm run check-data` should check that it matches the manifest hash.

**What the person sees**

| State | Sleeve badge | Action offered | Announced |
|---|---|---|---|
| Not saved | none | "Save for offline" | — |
| Saving | "Saving… 40%" (a `progressbar`) | "Cancel" | "Saving <title>" at the start, and "Saved" at the end |
| Saved | "Saved on this device ✓" | "Remove from this device" | — |
| Out of date | "Update available" | "Update" (the manifest hash changed on the server) | Once, on Home |
| Storage full or blocked | "Couldn't save" with the reason | "Try again" | The reason, once |

**Library view.** The "Saved on this device" chip on Home filters the crate to tiers B and C. A small line under the chips shows the space used ("3 data sets, 42 MB on this device") and offers "Remove all".

**Why the replay is instant.** On open, the player looks up tier C, then `tracks.json` from tier B or A, and only then starts the Worker. With features in hand, the ruleset and Tone.js start in well under a second, and switching style re-renders the same `MusicFrame` with a new preset: nothing is fetched or analysed again.

### 3.2 Data fusion: two data sets, one piece of music

Fusion is Compare's "Two data sets" mode. It has one rule: **every voice must stay attributable to one data set**, or the result is decoration, not data.

**Which pairs are allowed.** A proposed general manifest field, with a default of none:

```json
"pairsWith": [{ "id": "<other data set id>", "note": "Both show the same season over the same region." }]
```

Deck B only lists data sets that A's manifest pairs with. A pair is a decision about data, so it lives in the data (`phases.md`), never in `src/`. The `note` is shown and spoken as the reason the pair makes sense.

**Flow**

| Step | Person does | App does |
|---|---|---|
| 1 | Picks deck A | Loads it as on Listen (cache tiers apply) |
| 2 | Picks deck B from the allowed pairs | Shows the pair's `note` |
| 3 | Keeps "Link time" on (default) | Plays only the overlapping dates; each step plays both frames for the same date. Without an overlap, mode 2 is unavailable and the reason is shown |
| 4 | Listens | Splits the voices (below), one key (A's style or preset), one master bus with one limiter |
| 5 | Moves the crossfader | Ramps the gain of A's voices against B's |
| 6 | Mutes a deck or a voice | The same `VoiceMixer`, grouped under "Deck A" and "Deck B" |

**Voice split (default)**

| Voice | Follows | Why |
|---|---|---|
| Melody, harmony | Deck A | The main value stays with the data set chosen first |
| Bass, rhythm | Deck B | B's level and its long-term shift, in a different register, so the two don't mask each other |
| Hot spots | Both, panned: A left of centre, B right | Events from both stay audible and placeable |
| Motion, time | Deck A | One clock and one sense of motion |

A "Swap decks" button swaps the roles. At Calm detail, only melody (A) and bass (B) play.

**Words.** The combined caption names the deck for every phrase ("A: wetter in the south. B: a storm moves west."). Fusion never says or implies cause ("the storm caused the rain"); it says what each data set shows.

**Not allowed**

| Case | Behaviour |
|---|---|
| No `pairsWith` entry | Deck B lists nothing, with "No data sets are paired with this one yet." |
| No date overlap | Mode unavailable, with the two date ranges shown |
| More than two decks | Not offered; more voices than people can tell apart |

---

## 4. Accessibility across all of it

Sound first, then touch, then words on request. Words are never required to use the app, and sound is never the only channel.

| Need | What happens |
|---|---|
| Blind or low vision | Every control above is a native control with a label. Style previews have a spoken line. Explore mode plays the value under the finger or cursor; "What's here?" (IX02) gives words. Announcements go through `useAnnounce`, rate-limited, and only for changes the person did not cause |
| Text agrees with the sound | Captions come from the same `MusicFrame` as the music, so a style change can't make the words disagree |
| Screen reader and audio clash | The guide ducks the music while speaking (`src/assistant/ducking.ts`); "words only" and "sound only" exist |
| Deaf or hard of hearing | Captions, the scan line, hot-spot markers, haptics where supported (IX10; iOS has none) |
| Motor | Every action is a key, a tap or a gamepad button through one input layer (IX01). The crossfader and sliders work with arrow keys; nothing needs dragging |
| Cognitive load | Few choices per screen in the welcome, skip everywhere, Detail from Calm to Full, and a reset in the mixer |
| Hearing comfort | Bass is capped at +6 dB, and the master limiter always sits last, so no preference can make the output clip or jump |

---

## 5. Suggested tickets

Not in the queue yet. One ticket each, as `.claude/rules/tickets.md` says. All are general (no data-set names in `src/`).

| Idea | Touches | Hotspots | Needs |
|---|---|---|---|
| Five styles: presets + instrument kits, with a listening check | `src/sonify/presets.ts`, `src/data/sonification.ts` (`PresetId`), audio kits, goldens | sonify, schema | — |
| Audio preference store and the welcome's style and tuning step | `src/features/welcome/`, `src/data/boundaries.ts` | welcome, schema | Styles |
| Mixer: style, bass, tempo and reset, bound to the store | `src/features/player/` | player | Store |
| `tracks.json` at ingest, checked by `check-data` | `scripts/`, `src/analysis/` (run in Node), `docs/data-sources.md` | data scripts | — |
| Library: Cache Storage + IndexedDB, badges and the "Saved" filter | `src/data/`, `src/features/home/`, player loader | home, player | `tracks.json` (optional) |
| Compare "Two data sets" with `pairsWith` | `src/features/compare/`, `src/data/schema.ts`, `docs/data-sources.md` | compare, schema | — |

F48 (claimed) holds the player, compare and schema hotspots, so the mixer, Library and fusion tickets wait for it.

## 6. Open questions for the team

1. Ship all five styles, or three first (Cinematic, 8-Bit, Nature) and add Lo-Fi and Heavy Bass after a listening check?
2. Is fusion worth building before the deadline, or is Compare with two dates enough for the demo?
3. Is IndexedDB caching (tier C) worth the code, or do `tracks.json` and the HTTP cache already make replays fast enough?
4. Should the per-data-set override be on by default, or only when the person asks for it?

---

## Appendix A: the mascot (from the earlier draft, condensed)

The mascot is **Echo** (`src/components/Mascot.tsx`, `src/features/mascot/`; decision H05). The dock, jet trails, scroll boosters, chest equaliser and per-data-set accent exist (JB01–JB04).

- **Scroll physics** (`useScrollVelocity.ts`): tilts and boosts with scroll velocity and settles when scrolling stops. Visual only, and off under `prefers-reduced-motion`. The mascot never covers the transport bar and is `aria-hidden` except its dock button and speech bubble.
- **Theme families** come from the manifest, not `src/`: the accent and trail from `manifest.mascot`, otherwise from the colour scale with at least 3:1 contrast (`src/features/mascot/accent.ts`). Proposed trail styles per science family (water, atmosphere, land, ice, fire) would be general additions to `MascotTrail` with defaults.
- **Tips**: deterministic rules over `FrameFeatures` and `MusicFrame` (no model), rate-limited, dismissable, and never causal. The voice guide may suggest a fusion pair only if `pairsWith` lists it.
