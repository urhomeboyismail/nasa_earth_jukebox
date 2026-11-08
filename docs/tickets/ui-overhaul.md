# UI overhaul tickets: Material 3 Expressive

Restyle the whole app in [Material 3 Expressive](https://m3.material.io/blog/building-with-m3-expressive) (M3E), Google's newest version of Material Design. The overhaul is split into two tickets that **don't block each other**: they edit different files, and each one works whether or not the other has merged.

- **T50** builds the foundations and the app shell: tokens, base styles, header, navigation.
- **T51** builds the components and the voice guide panel.

The inventory in [`docs/UI_FOLLOWUP.md`](../UI_FOLLOWUP.md) lists every UI element and its problems. It was written before T10 to T47 merged, so routing, the shared components and the pages now exist. Each ticket below says which of its sections it covers.

We don't add packages (see the tickets README, rule 4). Material Web (`@material/web`) is in maintenance mode and has no M3E components, so both tickets write plain CSS against the M3 token names instead. Colors were generated with `@material/material-color-utilities` 0.4.0 (2025 spec, which is the M3E color spec), run outside the repo.

---

## Shared contract (both tickets read this; T50 implements it)

### Token names

These follow Material's own naming, so the M3 docs and Material Theme Builder exports map one to one.

| Group | Names | Notes |
|---|---|---|
| Color | `--md-sys-color-<role>`, for every M3 role (`primary`, `on-primary`, `primary-container`, …, `surface-container-highest`, `outline-variant`, `inverse-surface`, `scrim`) | Seed `#0B6E99` (ocean blue), Tonal Spot scheme, 2025 spec. Light, dark, and high-contrast versions of both (`prefers-contrast: more`) |
| Type | `--md-sys-typescale-<role>-<size>-{size,line-height,weight,tracking}` for display, headline, title, body and label in large, medium and small, plus `--md-sys-typescale-emphasized-weight` | Body text uses **body-large (16 px)**, never body-medium, because of the 16 px rule in `AGENTS.md` |
| Shape | `--md-sys-shape-corner-{none,extra-small,small,medium,large,large-increased,extra-large,extra-large-increased,extra-extra-large,full}` | The M3E corner scale: 0, 4, 8, 12, 16, 20, 28, 32 and 48 px, plus full |
| Elevation | `--md-sys-elevation-level{0..5}` | `box-shadow` values |
| Motion | `--md-sys-motion-spring-{fast,default,slow}-{spatial,effects}` and the same names with `-duration` | M3E springs written as CSS `linear()` easings. Spatial (position, size, shape) overshoots slightly; effects (color, opacity) doesn't. With reduced motion, durations become 0 |
| State | `--md-sys-state-{hover,focus,pressed,dragged}-state-layer-opacity` | 0.08, 0.10, 0.10, 0.16 |
| Target | `--control-size` | Becomes 48 px (M3's target size; above our 44 px floor) |

### Legacy tokens stay

Every page's CSS uses the old names (`--text`, `--text-h`, `--bg`, `--border`, `--code-bg`, `--accent`, `--accent-strong`, `--accent-bg`, `--accent-border`, `--on-accent`, `--error`, `--error-bg`, `--focus`, `--shadow`). **T50 keeps all of them as aliases of M3 roles**, so every page picks up the new look without anyone editing it. Remove them only after nothing uses them, in a later ticket.

### How the two stay independent

| | T50 | T51 |
|---|---|---|
| Edits | `index.html`, `public/`, `src/index.css`, `src/styles/tokens.css` (new), `src/styles/tokens.test.ts`, `src/App.tsx`, `src/App.css`, `src/App.test.tsx`, `src/components/Icon.tsx` (new) | All other files in `src/components/`, `src/styles/components.css`, `src/VoiceAssistant.tsx`, `src/styles/assistant.css`, page CSS and markup where a page adopts a new component |
| Never edits | Anything in T51's column | Anything in T50's column |
| If the other hasn't merged | Pages and components get the new colors through the legacy aliases | Writes every token with a fallback: `var(--md-sys-color-primary, var(--accent))`, `var(--md-sys-shape-corner-full, 999px)`. It looks right on the old tokens and better on the new ones |

`Icon.tsx` is a new file that T50 creates and **doesn't** add to `src/components/index.ts`, which belongs to T51. Import it by path (`./components/Icon`). T51 can switch `VoiceAssistant` to it once T50 has merged. Until then, `VoiceAssistant` keeps its own icons.

---

## T50: M3 Expressive foundations and app shell

**Owner:** Mohammad (shell). `src/index.css` and `src/styles/` belong to Roni, so agree the token file with Roni. **Due:** 8 Nov. **Priority:** Should. **Depends on:** nothing. **Branch:** `feature/ui-material-you`.

**Covers `UI_FOLLOWUP.md`:** 1.1 to 1.5, 1.6 (skip link), 2.1 to 2.5, 3.1 and 3.2.

**Files:** see the table above.

**Do:**
1. **Tokens:** add `src/styles/tokens.css` with every token in the contract, and import it first in `index.css`. Light and dark follow `prefers-color-scheme`; high contrast follows `prefers-contrast: more`.
2. **Legacy aliases:** in `index.css`, point every old token at an M3 role:
   - `--text` → on-surface-variant
   - `--text-h` → on-surface
   - `--bg` → surface
   - `--border` → outline-variant
   - `--code-bg` → surface-container-high
   - `--accent` → primary
   - `--accent-bg` → secondary-container
   - `--accent-border` → outline
   - `--on-accent` → on-primary
   - `--error` → error
   - `--error-bg` → error-container
   - `--focus` → secondary
   - `--shadow` → level 2
3. **Base styles:**
   - Drop the global `text-align: center` and the side borders on `#root`.
   - Fluid type from the type scale, with `clamp()` for headings.
   - Paragraph spacing, and h3 and list styles.
   - One focus ring: 3 px, secondary color, 2 px offset.
   - Move `.sr-only` from `App.css` into `index.css`.
   - Keep the reduced-motion block.
4. **Top app bar:**
   - The wordmark becomes a link to `#home` with a small logo.
   - The voice guide toggle becomes an M3E toggle button: tonal when off; filled when on, with its corners morphing from full to medium on a spatial spring; a mic icon.
   - Closing the guide returns focus to the toggle.
5. **Navigation** (same breakpoints as now; see `AGENTS.md`):
   - Below 768 px, use an M3E navigation bar: an icon in a pill-shaped active indicator, with a short label under it ("Home", "Learn", "Listen", "Compare", "About"). The full title stays the accessible name. The bar keeps `--bottom-nav-height` and the safe-area padding.
   - From 768 px, use horizontal nav items in the header: icon and full label in one pill.
   - The current page must have a cue that isn't color: a filled icon, the indicator, and a bolder label.
6. **Main area:**
   - Add a skip link to `<main>`.
   - The `h1` uses an emphasized headline style and keeps its focus behavior.
   - `document.title` follows the page ("Listen · Earth Jukebox").
   - The data load error uses `Notice` (error).
7. **Icons:** add `src/components/Icon.tsx`, built from Material Symbols paths (Apache 2.0) as `VoiceAssistant` already does. Include the outlined and filled nav icons, mic, mic_off, and play, pause, stop and replay for later use.
8. **Template leftovers:**
   - Replace the Vite favicon with an Earth Jukebox one.
   - Delete the unused `public/icons.svg`.
   - Add a meta description and `theme-color` (light and dark) to `index.html`.

**Done when:**
- `tokens.test.ts` checks, in light, dark and both high-contrast schemes:
  - every `on-X` / `X` pair at 4.5:1 or more
  - the legacy pairs it already checks, resolved through the aliases
  - the focus ring at 3:1 or more against the surface
- `App` tests cover the skip link, `document.title`, focus returning to the toggle, and `aria-current` with short mobile labels.
- `npm test`, `npm run lint` and `npm run build` pass.
- Screenshots at 360, 768, 1024 and 1280 px, in light and dark, show no sideways scroll and nothing hidden by the bar.

---

## T51: M3 Expressive components and voice guide panel

**Owner:** Roni (components). The voice guide files belong to Mohammad. **Due:** 12 Nov (M3). **Priority:** Should. **Depends on:** nothing; see the fallback rule above. **Branch:** `feature/T51-m3e-components`.

**Covers `UI_FOLLOWUP.md`:** 3.3, 4.1 to 4.9 and 6.1.

**Files:** see the table above. Page files change only where a page swaps in a new component, and without changing behavior.

**Do:**
1. **Button:**
   - M3E variants: filled, tonal, outlined, text and elevated.
   - Sizes small (default, 48 px target), medium and large.
   - A state layer for hover, focus and pressed.
   - The shape squares a little while pressed, on a fast spatial spring.
   - A toggle (`pressed`) uses the selected shape and color.
   - Keep today's props working: `variant="primary"` means filled and `"secondary"` means outlined, so no page has to change.
2. **IconButton** (new): standard, filled, tonal and outlined; a toggle form; a 48 px target. `aria-label` is required by its type.
3. **ButtonGroup** (new):
   - A *connected* single-choice group, built on native radio inputs, so it keeps radio semantics and arrow-key behavior.
   - A *standard* group, where neighbors squeeze when one is pressed.
4. **Slider:** the M3E look (a track with a gap around a tall handle, and a value indicator) on the native `<input type="range">`. The API stays the same.
5. **Card:** filled, elevated and outlined variants, with large corners. The API stays the same.
6. **Notice:** info, warning and error, in container colors from the tokens. An optional action button ("Try again"). Keep its roles and the "Error:" prefix.
7. **LoadingIndicator** (new): the M3E morphing-shape indicator, with a text label and `role="status"`. With reduced motion it is a static shape.
8. **Form fields:** an outlined style for `select`, `textarea` and text inputs, and M3 radio and checkbox styles, as classes the pages can use.
9. **Voice guide panel:**
   - A surface-container-high card with extra-large corners. On mobile it's a bottom sheet above the nav bar.
   - Escape closes it.
   - Use `dvh` everywhere.
   - All text at 16 px or more.
   - The mute button gets a fixed label with `aria-pressed`, and the mic_off icon when muted.
   - The status orb becomes an M3E shape, with a separate level meter.
   - Suggestion chips send sample questions.
   - The silent-microphone warning uses `Notice`.
   - In the error state, the start button reads "Try again".
   - Explain why the input is disabled while idle.
10. **Adopt on the pages,** with no change in behavior:
    - player speed → connected ButtonGroup
    - Compare answer and test-mode choices → connected ButtonGroup or M3 radios
    - Compare's `select` and the test-mode comment → outlined fields
    - "Analyzing the images…" → LoadingIndicator

**Done when:**
- Each new or changed component has a test with an accessibility check (`expectNoA11yViolations`).
- The page tests that already exist pass **unchanged**.
- `npm test`, `npm run lint` and `npm run build` pass.
- Screenshots at 360, 768, 1024 and 1280 px, in light and dark.
- The voice guide panel is checked by eye in every state (it needs a click to open).
