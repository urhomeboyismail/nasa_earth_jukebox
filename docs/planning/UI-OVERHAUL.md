# UI overhaul: the Muninn look on Earth Jukebox

The team's UI overhaul (14 Nov 2026), rewritten from the six draft tickets and the master prompt so it fits this repo, and so it borrows as much as it can from the front end of [Muninn](https://github.com/Erebuzzz/Muninn) (MIT): dark glass panels, monospace telemetry labels and pills, a Night/Day switch, and physics-based motion. The work is six tickets in the queue, **UI01 to UI06** ([`TICKETS.md`](../TICKETS.md), band "P1: UI overhaul"). This page is the style guide they share.

## 1. Where the drafts and the repo differ

The tickets follow the repo.

| The drafts say | The repo does | So the tickets |
|---|---|---|
| Tailwind CSS for layout | Plain CSS on generated Material 3 tokens: `src/styles/tokens.css`, written by `scripts/make_tokens.mjs`, contrast checked by `src/styles/tokens.test.ts` | No Tailwind. Muninn's look becomes tokens and a few classes (`.ui-glass`, `.ui-pill`, `.ui-label`) |
| Anime.js | Not installed; motion is CSS and `requestAnimationFrame` (`src/features/mascot/MascotDock.tsx:149`, `TourOverlay.tsx:29`) | Anime.js is added in UI05, loaded on demand, behind one reduced-motion gate |
| Routes `/`, `/crate`, `/listen/:id`, `/remix`, `/compare` | Hash pages from `src/pages.ts` (home, learn, listen, compare, about), mirrored in `server/app/assistant/knowledge.py` | No new routes. The Crate is Home; Remix is Compare's "Two data sets" mode |
| Build the welcome, crate, stage, mixer, mascot engine, remix | Mostly built: Crate (`src/features/home/Crate.tsx`), mixer (`SoundPrefs`, `VoiceMixer`), Fusion (`src/features/compare/Fusion.tsx`), tour flight path (JB05), face states (`expressionFor.ts`), chat welcome (JB11, claimed by B) | Restyle and extend. New only: the 10-second preview, Loop, the dual-handle scrubber, the Night/Day switch, the server pill, the motion layer |
| Speed 0.5× to 2× | Slow / Normal / Fast, stored in `src/audio/prefs.ts` (blueprint §1.5) | Speed stays three steps |
| Styles Cinematic, 8-Bit Arcade, Nature Ambient, Heavy Bass | Five presets with kits (`STYLE_IDS`, `src/sonify/presets.ts`) | The chips use the existing style ids and labels |

Layout is still deferred to the end (`.claude/rules/platform.md`): no ticket adds breakpoint or width work.

## 2. The look: Muninn, adapted

From Muninn's `frontend/src/app/globals.css`, `tailwind.config.ts`, `lib/animations.ts`, `lib/themeContext.tsx` and `components/`.

| Muninn | Earth Jukebox | Ticket |
|---|---|---|
| `.glass-window`: gradient glass, `backdrop-filter: blur(28px)`, a lit top border, soft shadow, a caustic `::before` glow | `--glass-bg`, `--glass-border`, `--glass-border-lit`, `--glass-shadow`, `--glass-glow` and a `.ui-glass` class. **Solid fallback** under `prefers-contrast: more`, `prefers-reduced-transparency`, and where `backdrop-filter` is not supported | UI01 |
| Near-black `#05070c`, surface ramp `#11151c` / `#161b24` / `#1c2330`, border ramp | Dark first. Neutrals seeded from deep space blue `#0b132b` in `make_tokens.mjs`; all M3 surface roles regenerated | UI01 |
| Sun-orange and cyan glows; `nordic.*` accents | Four telemetry accents: Ocean Teal `#00ffcc`, Atmosphere Cyan `#00f0ff`, Forest Synth Green `#39ff14`, Fire Amber `#ff9f00` as `--accent-ocean`, `--accent-atmosphere`, `--accent-forest`, `--accent-fire`. A data set's own colour comes from its manifest (`mascot.accent`, `src/data/schema.ts:130`, chosen by `src/features/mascot/accent.ts`), never by name in `src/` | UI01, UI03 |
| Inter for text, JetBrains Mono for data; uppercase `tracking-widest` labels; rounded status pills at 9–10 px | Mono for data readouts, labels and pills (`--md-ref-typeface-mono`). **Never below 0.75 rem, always 4.5:1** | UI01 |
| Nyx / Helios theme orb with a sunrise / sunset sweep, stored in localStorage | **Night / Day switch**: Night by default, a stored choice (`useStoredValue`) sets `data-theme` on `<html>`. The sweep is skipped under reduced motion | UI01, UI05 |
| `BackendStatusPill` ("Edge API Online", Reconnect) | A server pill in the header: "Server ready", "Server waking" (Render's free tier), "Offline: the app still works". Reuses the voice guide's waking logic (`src/hooks/useVoiceAssistant.ts:127`) | UI01 |
| `elasticRecoil`, `slideInDrawer` / `slideOutDrawer`, `drawSvgPath`, sky and galaxy canvases | `src/motion/`: `reducedMotion()`, `pressRecoil`, `slideDrawer`, `drawPath`, `SkyBackdrop` (starfield and atmosphere glow; static under reduced motion, paused in a hidden tab) | UI05 |
| Glass cards with mono pills (`ResurfacingCard`), glass chat (`MemoryChat`) | Crate records, Echo's chat welcome, Ask answers | UI02, UI03 |
| Thin scrollbars, accent `::selection` | Same, on tokens | UI01 |

**Not taken:** `MythicCursor` (a custom cursor fights screen magnifiers), the Norse runes and `runeCipherDecode` (scrambled text is unreadable to a screen reader), `Waveform.tsx` (sine waves that look like data but are not), every Muninn animation as written (none checks `prefers-reduced-motion`), and 9–10 px text.

## 3. Components: what to use

- **House components first.** `src/components/` (Button, Dialog on native `<dialog>`, Slider on native range, Notice, Card, IconButton…) is the shadcn pattern already: we own the source. New components follow it: one file, their CSS on tokens in `src/styles/components.css`, and a test that calls `expectNoA11yViolations`.
- **Radix primitives** (`@radix-ui/react-*`), one package per primitive, only where no house component exists and the accessible version is hard to write: `react-slider` for the dual-handle scrubber (UI06), and `react-tabs`, `react-popover` or `react-tooltip` if a ticket needs one. Each is wrapped as a house component and styled through its `data-state` attributes with our tokens.
- **21st.dev** is a gallery to port from (vinyl cards, transport bars, glass toolbars). Porting rules:
  1. Tailwind classes become our tokens and classes; Framer Motion becomes `src/motion/`.
  2. Check the component's licence and put its source URL in a comment at the top of the file.
  3. Make it complete by keyboard and screen reader, with tests by role and name.
  4. A visualiser draws the real sound or the real data, never decoration.
- **NASA look**: deep space blue, telemetry accents and monospace readouts, as colours and feel only. No NASA insignia, logo or wording that suggests NASA made the app.

## 4. The checklist every UI ticket meets

- Text is at least 0.75 rem with 4.5:1 contrast on its glass; controls and focus rings 3:1 (WCAG 1.4.3, 1.4.11). `tokens.test.ts` checks the token pairs.
- Under `prefers-reduced-motion` nothing moves except the data's own frames; under `prefers-contrast: more` and `prefers-reduced-transparency` glass is solid.
- Nothing flashes more than 3 times a second. No sound before a click or key. Every sound has a text equivalent, announced through `useAnnounce`.
- Every control has a name and works by keyboard. Tests find things by role and name and call `expectNoA11yViolations`.
- Nothing specific to one data set in `src/`. Heavy code (Anime.js, Radix, Tone.js) loads on demand, off the first load of Home.

## 5. From the drafts to the queue

| Draft | Queue | Needs |
|---|---|---|
| 1. Design system and M3 tokens | [UI01](../tickets/UI01-dark-glass-tokens.md) | — |
| 2. Onboarding and manual welcome | [UI02](../tickets/UI02-welcome-glass.md) | UI01, JB11 |
| 3. Vinyl Crate | [UI03](../tickets/UI03-crate-records.md) | UI01 |
| 4. Jukebox stage and mixer | [UI04](../tickets/UI04-stage-transport.md) | UI01, JB10 |
| 5. Anime.js and mascot engine | [UI05](../tickets/UI05-motion-layer.md) | UI01, JB09 |
| 6. Remix and compare | [UI06](../tickets/UI06-compare-decks.md) | UI01 |

After UI01, UI02 to UI06 touch different files and can run at the same time.
