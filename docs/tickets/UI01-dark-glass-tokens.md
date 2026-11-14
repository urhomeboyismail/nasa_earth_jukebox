# UI01 Dark-glass tokens, telemetry accents, mono type, Night/Day switch and server pill

| | |
|---|---|
| **Priority** | P0 |
| **Size** | L (more than a day) |
| **Who** | agent+👤 (an agent builds it, a person signs off the look) |
| **Needs** | — |
| **Hotspots** | theme, app |
| **Branch** | `feature/UI01-dark-glass-tokens` |

## Goal

The whole app wears Muninn's dark-glass look on our own Material 3 tokens: deep-space surfaces, four telemetry accents, monospace labels and pills, glass panels with solid fallbacks, a Night/Day switch, and a server status pill. Every other UI ticket builds on these tokens and classes.

## Why

- The palette is purple on black (`src/styles/tokens.css:5`, seed `#8a1fe0`); the overhaul wants dark glass with science accents (`docs/planning/UI-OVERHAUL.md` §2).
- Muninn's glass is one class on CSS variables (`frontend/src/app/globals.css`, `.glass-window`: blur 28 px, lit top border, shadow, caustic `::before`). It ports to tokens without Tailwind.
- Light is the default today and dark follows the system (`tokens.css:183`); the drafts ask for dark by default, and Muninn offers a Night/Day switch (`lib/themeContext.tsx`).
- The only server status is the voice guide's "Waking Echo up" line (`src/VoiceAssistant.tsx:124`); Muninn shows a status pill everywhere (`BackendStatusPill.tsx`). Render's free tier sleeps (AGENTS.md "Before any demo").

## Design

- **Seed:** `scripts/make_tokens.mjs` seeds the neutral palette from deep space blue `#0b132b` and the primary from Atmosphere Cyan. Regenerate `tokens.css`; never edit it by hand (`tokens.css:3`).
- **Night first:** `:root` holds the dark scheme. `[data-theme="day"]` holds the light one. `prefers-contrast: more` keeps its own blocks (`tokens.css:271`).
- **New tokens:**
  - `--accent-ocean: #00ffcc`, `--accent-atmosphere: #00f0ff`, `--accent-forest: #39ff14`, `--accent-fire: #ff9f00`, each with an `--on-accent-*` pair;
  - `--glass-bg`, `--glass-border`, `--glass-border-lit`, `--glass-shadow`, `--glass-glow`, `--glass-blur: 24px`;
  - `--md-ref-typeface-mono: 'JetBrains Mono', ui-monospace, monospace`;
  - `--md-sys-typescale-label-mono-*`, minimum `0.75rem`.
- **Classes** in `src/styles/components.css`:
  - `.ui-glass`: background, blur, a lit top edge, shadow, and a `::before` glow with `pointer-events: none`;
  - `.ui-label`: mono, uppercase, letter-spacing 0.08em;
  - `.ui-pill`: mono, rounded, border, with `--pill-accent`.
  - Under `prefers-contrast: more`, `prefers-reduced-transparency: reduce` and `@supports not (backdrop-filter: blur(1px))`, `.ui-glass` becomes a solid `surface-container-high` with a 2 px outline.
- **Night/Day switch:** `ThemeSwitch` in `src/components/`, a `Button` with `pressed`. It stores `night` or `day` under `earth-jukebox:theme` with `useStoredValue` (`src/hooks/useStoredValue.ts`), sets `document.documentElement.dataset.theme`, and announces "Day theme" or "Night theme". It is placed in the header in `src/App.tsx`. No animated sweep yet (UI05).
- **Server pill:** `ServerPill` in `src/components/`, in the header, showing one of:
  - "Server ready";
  - "Server waking" (a health check slower than the guide's `WAKING_AFTER_MS`, `src/hooks/useVoiceAssistant.ts:127`);
  - "Offline: the app still works", with a "Check again" button.
  - It checks `GET /api/v1/health` once on load and on "Check again", and never polls. Changes are announced politely.
- **Global:** a thin scrollbar on tokens and an accent `::selection`, in `src/index.css`.

## Reuse

- `scripts/make_tokens.mjs` and `@material/material-color-utilities`, already used to generate the tokens.
- `src/styles/tokens.test.ts`: extend it, don't replace it.
- `Button` (`pressed`), `useAnnounce`, `useStoredValue`, `apiBase()` from `src/config`.

## Touches

- `scripts/make_tokens.mjs`, `src/styles/tokens.css` (regenerated), `src/styles/tokens.test.ts`
- `src/styles/components.css`, `src/index.css`
- `src/components/ThemeSwitch.tsx`, `ServerPill.tsx` (new), their tests, and their entries in `src/components/index.ts`
- `src/App.tsx` (the header only)
- `docs/planning/UI-OVERHAUL.md` (only if a token name changes)

## Steps

1. Change the seeds in `make_tokens.mjs`, add the accent, glass and mono tokens, and make the dark block first. Run the script.
2. Extend `tokens.test.ts`: every text role on `--glass-bg` and every `--on-accent-*` on its accent is at least 4.5:1, in all four blocks. Glass is checked as its colour composited over `surface`.
3. Add `.ui-glass`, `.ui-label`, `.ui-pill` and the fallbacks to `components.css`. Put `.ui-glass` on `Card` and `Notice`, and check the existing tests still pass.
4. Build `ThemeSwitch` and `ServerPill` and place them in the header.
5. Load JetBrains Mono the same way the other fonts load in `src/index.css` (self-hosted, `font-display: swap`).

## Tests

- `tokens.test.ts`: contrast as in step 2.
- `ThemeSwitch.test.tsx`: night by default, pressing it sets `data-theme="day"`, stores the choice and announces it; blocked storage still switches for the visit; `expectNoA11yViolations`.
- `ServerPill.test.tsx`: stub `fetch` with ready, slow and failing answers. Check each label, that "Check again" checks again, and that nothing polls (fake timers). `expectNoA11yViolations`.

## Guardrails

- Contrast as above. Glass never lowers the contrast of text on it.
- No motion added here. The switch changes the theme instantly.
- Nothing specific to one data set in `src/`.

## Done when

- The app opens in the Night theme, with glass cards and mono labels, and passes every existing test.
- The Day theme and both high-contrast blocks pass `tokens.test.ts`.
- The header has the Night/Day switch and the server pill, both working by keyboard and announced.

## Checks

```bash
node scripts/make_tokens.mjs && npm run lint && npm test && npm run build
```

## Out of scope

- Restyling individual pages (UI02 to UI06), motion (UI05), Tailwind, a custom cursor, Muninn's runes.

## Result

Filled in by the agent.
