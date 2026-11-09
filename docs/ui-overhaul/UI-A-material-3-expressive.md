# UI overhaul A: Material 3 Expressive (T116, T117)

Written 9 Nov 2026. Two tickets, the **design system** (T116) and the **app chrome** (T117). The other two overhaul tickets, T118 and T119, are in [`UI-B-stageshow-craft-and-motion.md`](UI-B-stageshow-craft-and-motion.md). **The four are independent: any one can merge first, in any order, and none waits for another.** The rules that make this true are in "The contract" below and are the same in both files.

Hand a ticket to your own AI like this:

> Read `AGENTS.md`, `docs/PLAN.md`, `docs/ui-overhaul/UI-A-material-3-expressive.md` and ticket `<ID>`. Do only that ticket, on branch `feature/<ID>-short-name`, and open a PR into `main`.

## What "Material 3 Expressive" means here

Google's 2025 update to Material 3. We take its five parts and implement them in **plain CSS custom properties and React, with no new npm package** (`AGENTS.md` and TICKETS.md rule 5; `@material/web` does not ship the Expressive components anyway):

1. **Colour:** dynamic tonal colour from one seed, using the `Expressive` scheme variant (hue-shifted, higher chroma), light and dark.
2. **Shape:** a wider corner scale (adds *large-increased*, *extra-large-increased*, *extra-extra-large*) and shapes that **morph** on press and when toggled.
3. **Type:** the M3 type scale plus **emphasised** (heavier) styles, on a variable font so weight and width can change smoothly.
4. **Motion:** **springs** instead of fixed curves: a *spatial* spring (moves, size, shape; may overshoot) and an *effects* spring (colour, opacity; never overshoots), each in fast, default and slow.
5. **Components:** the Expressive set that fits this app: buttons in five types and three sizes with toggle and shape morph, **connected button group**, **extended FAB**, navigation bar with a pill indicator, and a bottom sheet.

Project rules that **override** Material where they differ (AGENTS.md wins): body text is at least 16 px (Material's body-medium and body-small are 14 and 12 px, so here they are 1 rem); touch targets are 44 px, so there is no XS (32 px) button; the main navigation is a bottom bar below 768 px and sits in the header from 768 px up (Material would use a rail); `prefers-reduced-motion` removes all motion (already global in `index.css`).

## The contract (what keeps the four tickets independent)

Every overhaul ticket codes against **names that already exist on `main` or that are frozen here**, and every new name is read with a fallback that equals the old look. So a page restyled before T116 merges still looks right, and looks better the moment T116 lands. Nobody waits.

1. **Colour: use today's names only.** `--bg --text --text-h --border --code-bg --accent --accent-strong --accent-bg --accent-border --on-accent --error --error-bg --focus --shadow`. They already switch for dark mode. **T116 re-points these to Material roles** (table in T116), so every page re-colours without being edited. Nobody else references `--md-sys-color-*` directly. If a ticket needs a Material surface step, it makes a local alias with a legacy fallback: `--card-bg: var(--md-sys-color-surface-container, var(--code-bg));`
2. **Shape, type, motion, elevation: use the frozen names below, always with the fallback shown.** The fallback is the Material value, so the result is the same with or without T116.

   | Name | Fallback to write |
   |---|---|
   | `--md-sys-shape-corner-{extra-small,small,medium,large,large-increased,extra-large,extra-large-increased,extra-extra-large,full}` | 4px, 8px, 12px, 16px, 20px, 28px, 32px, 48px, 9999px |
   | `--md-sys-typescale-{display,headline,title,body,label}-{large,medium,small}` (a `font` shorthand) and the same plus `-emphasized` | `inherit` |
   | `--md-sys-motion-spring-{fast,default,slow}-{spatial,effects}` (an easing) and the same plus `-duration` | `cubic-bezier(0.2, 0, 0, 1)` and `0.4s` |
   | `--md-sys-elevation-level-{0,1,2,3,4,5}` (a `box-shadow`) | `none` for 0, `var(--shadow)` for 1 to 5 |
   | `--md-sys-state-{hover,focus,pressed,dragged}-opacity` | 0.08, 0.10, 0.10, 0.16 |

3. **Names that never change** (other code relies on them): `--control-size`, `--bottom-nav-height`, `--voice-panel-space`, the breakpoints 767/768 and 1023/1024, and every existing `.ui-*` class.
4. **Components keep their props.** New props on `Button` and others are optional. An unknown variant class degrades to today's look.
5. **Each ticket owns different files** (listed in each ticket). Where two tickets edit different hunks of one file, whichever merges second rebases; neither waits.

| Shared file | Hunks | Who |
|---|---|---|
| `src/index.css` | `:root`, the dark block, `h1 h2 p code` | T116 |
| `src/index.css` | `#root`, `body` | T117 |

## Definition of done (all four tickets)

`npm run build`, `npm run lint` and `npm test` pass **with the existing tests unchanged** (a restyle changes no behaviour: if a test has to change, the change is wrong, unless the ticket says otherwise). New code has tests. Everything is reachable by keyboard with a visible focus ring. The layout rule in `AGENTS.md` holds: checked at **360, 768, 1024 and 1280 px** with the `responsive-layout` skill, no horizontal scroll, 44 px targets, nothing hover-only; **list the widths in the PR**. Contrast: jsdom cannot check it, so state the measured ratio for each text/background pair you introduce (4.5:1 text, 3:1 large text and UI edges, both themes). Every ticket can be **reverted alone** with `git revert`.

Schedule note: 12 Nov is the cut line for features (TICKETS.md). A restyle is not a feature, but it touches every screen, so these four **must not delay anything marked Must**. Do them after your own Must tickets. If time runs out, cut from the bottom: T119, then T118, then T117 steps 4 and 5, then T116 steps 5 and 6.

---

## T116: Design system foundations (tokens, type, shape, motion, shared components)

**Suggested owner:** Roni (owns `src/components/`, `src/styles/`, `src/index.css`). **Due:** 11 Nov. **Priority:** Should. **Status: steps 1 to 5 built 9 Nov on `feature/T116-m3e-foundations`** (not merged; step 6 not started).

**Builds on today's `main`:** the tokens in `src/index.css` and the six `.ui-*` components. **Independent of:** T117, T118, T119 (they use the contract, not this code).

**Files:** `src/styles/tokens.css` (new), `src/index.css` (the hunks in the table above), `src/styles/components.css`, `src/components/*` (and their tests), `public/fonts/` (new), `scripts/make_tokens.mjs` (new, a generator you run once; it is not part of the build).

### 1. Colour roles
- Pick the seed. **The Expressive scheme rotates hues, so a blue seed gives an olive primary and a pink container** (found when building this). Scan hues instead: seed `#b8424f` gives an ocean-blue primary, a sand-coloured secondary container and a land-green tertiary, so the app reads as Earth. Generate the **Expressive** scheme for light and dark with Google's `material-color-utilities` (`SchemeExpressive`), **run once in a scratch folder outside this repo** so the package never enters `package.json`. Commit only the generated CSS and the small script that produced it.
- Define **every** role for both themes (dark under `@media (prefers-color-scheme: dark)`, as today): `primary`, `secondary`, `tertiary` and `error`, each with `on-`, `-container` and `on-…-container`; `surface`, `on-surface`, `on-surface-variant`, `surface-dim`, `surface-bright`, `surface-container-lowest`, `-low`, plain `surface-container`, `-high`, `-highest`; `outline`, `outline-variant`; `inverse-surface`, `inverse-on-surface`, `inverse-primary`; `scrim`, `shadow`. All as `--md-sys-color-<role>`.
- **Re-point the legacy names:**

  | Legacy | Material role |
  |---|---|
  | `--bg` | `surface` |
  | `--text-h` | `on-surface` |
  | `--text` | `on-surface-variant` |
  | `--border` | `outline-variant` |
  | `--code-bg` | `surface-container` |
  | `--accent` | `primary` |
  | `--on-accent` | `on-primary` |
  | `--accent-strong` | `primary`; links use it on `--bg`, so measure 4.5:1 in both themes and, if it fails, use the next tone down in light or up in dark |
  | `--accent-bg` | `secondary-container` |
  | `--accent-border` | `outline` |
  | `--error`, `--error-bg` | `error`, `error-container` |
  | `--focus` | `primary`; needs 3:1 against both `--bg` and `--accent-bg`, otherwise use `tertiary` |

### 2. Type
Define the 15 M3 styles and their `-emphasized` variants as `font` shorthands (contract). Apply the project overrides: **`body-large`, `body-medium` and `body-small` are all 1 rem**; `label-large` is 1 rem, `label-medium` 0.875 rem, `label-small` 0.8125 rem (the mobile nav already uses 13 px). Set `h1` to `display-small` and `h2` to `headline-small`, keeping today's mobile sizes as the floor.
Font: **Roboto Flex** (SIL OFL) as a variable `woff2`, **self-hosted** in `public/fonts/` with a Latin subset and `font-display: swap`; no request to a font server. Stack: `'Roboto Flex', Roboto, system-ui, 'Segoe UI', sans-serif`. If the file cannot be fetched, ship the stack alone and say so in the PR (the app must look right without it).

### 3. Shape, elevation, state layers
Define the corner scale, `--md-sys-elevation-level-0..5` (Material's two-shadow recipe, tinted by `shadow`), and the four state-layer opacities. Interactive components draw hover, focus and pressed as a `::before` overlay in `currentColor` at those opacities, not by swapping colours.

### 4. Motion (springs)
Express each spring as a CSS `linear()` easing generated from the spring equation by `scripts/make_tokens.mjs`, with its settle duration, so no JavaScript runs at animation time. Values (Compose `MotionScheme.expressive`; **verify against that source when you build; two community sources disagree on default-spatial damping, 0.8 vs 0.73**):

| Token | Stiffness | Damping ratio |
|---|---|---|
| spatial fast / default / slow | 800 / 380 / 200 | 0.6 / 0.8 / 0.8 |
| effects fast / default / slow | 3800 / 1600 / 800 | 1 / 1 / 1 |

Rule for use: **spatial** for anything that moves or changes size or shape; **effects** for colour and opacity. The global reduced-motion block in `index.css` stays and still wins.

### 5. Components (same exports, same props, new optional ones)
- **`Button`:** `variant` gains `filled` (alias of `primary`), `tonal`, `outlined`, `text`, `elevated`; `secondary` keeps today's meaning. New optional `size: 's' | 'm' | 'l'` (44, 56, 96 px tall) and `shape: 'round' | 'square'`. On press the corner radius morphs towards `small` with the spatial-fast spring; a toggle (`pressed`) that is on uses the opposite shape from its off state. Colour and state-layer changes use effects springs. `aria-pressed` and the 44 px minimum are unchanged.
- **`ButtonGroup` (new export):** a connected group (2 px gaps, outer corners `full`, inner corners `small`, the selected item `full`). Props: `label` (accessible name, required), `children`. It is a `role="group"`; single-select use is composed by the caller with `Button pressed`. Tested with the keyboard.
- **`Slider`:** an Expressive slider look (thicker track, 44 px handle with a 4 px gap, value shown as before) built on the same `<input type="range">`, so keyboard, `aria-valuetext` and the `<output>` stay exactly as they are.
- **`Card`:** optional `variant: 'filled' | 'elevated' | 'outlined'`, default `outlined` (today's look, corners `large`). **`Notice`:** `secondary-container` or `error-container`, corners `medium`. **`DatasetPicker`:** the native `<select>` styled as an outlined field, still a native select. **`Legend`:** unchanged markup, corners from the scale.

### 6. Could (cut first)
A `LoadingIndicator` (morphing shape, `role="status"` with text) for the "data is loading" state.

### Acceptance
- A test reads `src/styles/tokens.css` and fails if any contract name from this file is missing from the light **or** the dark block. This is the guard that keeps the other three tickets valid.
- **The one existing test that must change is `src/styles/tokens.test.ts`**, because it parsed hex values out of `index.css` and the tokens are now `var()` pointers. Rewrite it to follow the pointers into `tokens.css` and keep every assertion it had. It also asserted `#root { max-width: 1126px }`, which would make T117 fail a test that T116 owns: relax that to "the root is fluid (`width: 100%`, no fixed pixel width)". Read the CSS from disk with `fileURLToPath(import.meta.url)` in a `@vitest-environment node` test: `?raw` on a stylesheet with an `@font-face` comes back empty under vitest.
- The existing `components.test.tsx`, `DatasetPicker.test.tsx` and `Legend.test.tsx` pass unchanged; new tests cover each new variant, size and `ButtonGroup`, each with `expectNoA11yViolations`.
- Toggling the OS theme re-colours the whole app with no page edited. State the contrast ratios of: `--text-h` on `--bg`, `--text` on `--bg`, link on `--bg`, `--text-h` on `--accent-bg`, `--on-accent` on `--accent`, and the focus ring on both, in both themes.
- Press a button: its corners morph and settle; with reduced motion on, nothing animates.
- `package.json` is unchanged.

---

## T117: App chrome (top bar, navigation, voice guide, page transitions)

**Suggested owner:** Mohammad (owns `src/App.tsx` and the voice guide UI). **Due:** 11 Nov. **Priority:** Should.

**Builds on today's `main`:** `App.tsx`, `App.css`, `VoiceAssistant.tsx`, `styles/assistant.css`. Uses the legacy colour names and the contract with fallbacks. **Independent of:** T116 (it does not import from `src/components` and does not need the new tokens to exist), T118, T119.

**Files:** `src/App.tsx`, `src/App.css`, `src/VoiceAssistant.tsx`, `src/styles/assistant.css`, `src/shell/` (new: `NavIcons.tsx`, `useViewTransition.ts`), `index.html` (`theme-color`), `src/index.css` (the `#root` and `body` hunks only), and the tests for these.

### 1. Top app bar
Replace the bordered header with a Material top app bar: the app name in `title-large-emphasized`, `surface` background, a tonal scroll state (the background steps to `surface-container` once the page scrolls; an effects spring on colour only). The 1126 px `#root` column with side borders goes: content is centred and capped at `max-inline-size: 72rem`, the bar spans the full width.

### 2. Navigation
- **Mobile (below 768 px):** a Material **navigation bar** fixed to the bottom: five items, each an inline-SVG icon above a text label (labels always shown, never icon only), the active item marked by a **pill indicator** that slides to the new item with the spatial-default spring. Height stays `--bottom-nav-height`; it keeps `env(safe-area-inset-bottom)`. Labels may wrap to two lines; the bar does not grow past `--bottom-nav-height`.
- **Tablet and desktop (768 px up):** the same destinations in the header as a row of items with the sliding pill indicator (not a rail: AGENTS.md puts the nav in the header). The 768/1024 behaviour in `App.css` stays.
- Keep the markup contract: `<nav aria-label="Main">`, a list of buttons, `aria-current="page"` on the active one. Icons are `aria-hidden`. The existing nav tests pass unchanged.

### 3. Voice guide
- The toggle stays reachable at every width, but on mobile it becomes an **extended FAB** above the bottom bar, bottom right: `bottom: calc(var(--bottom-nav-height) + 16px)`. It stays one `<button>` with `aria-pressed` and the same label ("Voice guide"), so `App.voice.test.tsx` passes unchanged.
- The open panel becomes a Material **bottom sheet** on mobile (full width, top corners `extra-large`, `surface-container-high`; no scrim, because it is not modal) and a floating card on tablet and desktop (about 400 px, `extra-large`, elevation 3). It opens with the spatial-default spring from the FAB. It still sets `--voice-panel-space` so page content is never hidden behind it, and it does not cover the bottom bar.
- Do not change `useVoiceAssistant`, `src/assistant/` or any server file.

### 4. Page transitions
When the page changes, wrap the swap in the View Transitions API (`document.startViewTransition`) with a **fade-through** (old content fades out with an effects spring, new content fades in and rises 12 px with a spatial spring). Feature-detect it and skip it when unsupported or when reduced motion is on. Focus still moves to the new page's `<h1>` exactly as today (`heading.current?.focus()`), and the screen-reader announcement is unchanged.

### 5. Theme colour and safe areas
`<meta name="theme-color">` for light and dark (the `surface` values) so the phone's browser bar matches. Confirm `viewport-fit=cover` insets on a notched layout.

### Acceptance
- `App.test.tsx`, `App.voice.test.tsx` and `route.test.ts` pass unchanged. New tests: the active nav item has `aria-current`; the FAB toggles the panel and keeps `aria-pressed`; the transition helper is skipped when `matchMedia('(prefers-reduced-motion: reduce)')` matches or the API is missing.
- At 360 and 768 px: nothing is hidden behind the bottom bar or the FAB, including with the panel open; the FAB and the nav items never overlap; Tab order is header, nav, page, FAB.
- At 1280 px: the bar spans the viewport and the content is centred.
- Contrast ratios stated for the nav label, the active label on the pill, and the FAB text, in both themes.
- No new npm package; `useVoiceAssistant` untouched.

### If time runs out
Cut in this order: page transitions (4), sheet and FAB styling (3; leave the header toggle), scroll tint (1), the sliding indicator (2; keep a static pill). Step 2's layout and the `#root` change are the minimum.
