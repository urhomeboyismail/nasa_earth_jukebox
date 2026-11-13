# VIS3 Design-system housekeeping

| | |
|---|---|
| **Priority** | P2 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | app |
| **Branch** | `feature/VIS3-design-system-housekeeping` |


## Goal

The design system says what it does: Roboto Flex is loaded, the token generator reproduces `src/styles/tokens.css` exactly, the mascot takes its colours from the tokens, the hard-coded radii and colours are gone, the loading fallback is the shared loader, and the one cast in `colourAt.ts` is removed.

## Why

- **Font.** `public/fonts/RobotoFlex-latin.woff2` (with `OFL-RobotoFlex.txt`) ships, and `src/styles/tokens.css:51-52` names Roboto Flex as a fallback, but there is no `@font-face` anywhere, so the browser never loads it.
- **Generator.** `scripts/make_tokens.mjs:23` sets `SEED = '#b8424f'` and uses `SchemeExpressive` (`:19`, `:42`), with `@material/material-color-utilities@0.3.0` in its header. `src/styles/tokens.css:4-7` says the seed is `#8a1fe0`, Vibrant, 0.4.0, and has four colour blocks: light, dark, light high contrast and dark high contrast (`tokens.css:58-140` for the `prefers-contrast` blocks). Running the script today replaces the purple theme with the old one and drops the high-contrast blocks.
- **Mascot.** `src/components/Mascot.tsx:8-16` has a colour table of hex values (its `primary` duplicates the token), and the art uses literal hex in paths (`:68`, `:70`, `:84`, `:105`, `:110-112`).
- **Radii.** About twenty hard-coded `border-radius` values in the feature and component CSS, for example `src/features/player/player.css:19` (0.75rem), `src/features/welcome/welcome.css:6` (1.5rem), `src/features/story/story.css:8`, `src/features/compare/compare.css:22`.
- **Colour fallbacks.** `src/features/ask/ask.css:13` (`var(--bg, #fff)`) and the amber fallbacks at `src/styles/components.css:33-34` and `:63-64`.
- **Loading.** `src/App.tsx:224` shows "Loading…" as plain text in the Suspense fallback. The shared `LoadingIndicator` exists.
- **Cast.** `src/components/colourAt.ts:12` ends in `as RGB`.

## Design

- **Font.** In `src/index.css`: `@font-face { font-family: 'Roboto Flex'; src: url('/fonts/RobotoFlex-latin.woff2') format('woff2'); font-weight: 100 1000; font-display: swap; }`. Keep the licence file. The Vite config has no `base`, so `/fonts/` is right. Tokens keep their order (Google Sans Flex first).
- **Generator.** `scripts/make_tokens.mjs`: `SEED = '#8a1fe0'`; the scheme is built the way `tokens.css`'s header describes (SchemeVibrant's primary, secondary, tertiary and error palettes, and a neutral palette with chroma 0), using the 0.4.0 API. Check the package's API in a scratch folder before you write it; do not guess the class names. The four colour blocks are emitted together, and the high-contrast blocks use contrast level 1. The spring values are unchanged. The header comment names 0.4.0 and the seed.
- **Mascot tokens.** The art's colours become variables: `--mascot-shell`, `--mascot-visor`, `--mascot-ocean`, `--mascot-land`, `--mascot-glow`, in `tokens.css`, emitted by the generator. `primary` uses `--md-sys-color-primary`. In SVG, presentation attributes cannot read a `var()`, so the fills use `style={{ fill: 'var(--…)' }}` or a class.
- **Radii.** Map each literal to the nearest token: 0.25rem to `--md-sys-shape-corner-extra-small`, 0.5rem to `-small`, 0.75rem to `-medium`, 1rem to `-large`, 1.25rem to `-large-increased`, 1.5rem to `-extra-large`. Record the mapping in the PR.
- **Colour fallbacks.** Remove the hex after `var(--token, …)` where the token exists. Where it does not, add the token to the generator first.
- **Suspense.** `fallback={<LoadingIndicator label="Loading…" />}` in `App.tsx`. The component keeps its own live region.
- **Cast.** Write `colourAt` so the return is a three-element literal typed `RGB`, for example with a helper `mix(channel: 0 | 1 | 2): number` and `return [mix(0), mix(1), mix(2)]`. No `as`.

## Reuse

- `src/styles/tokens.css`, `src/styles/tokens.test.ts`.
- `src/components/LoadingIndicator.tsx`.
- `src/components/colourAt.ts` and its tests (if none, add them here).
- `public/fonts/RobotoFlex-latin.woff2`, `OFL-RobotoFlex.txt`.

## Touches

- `src/index.css` (the `@font-face`).
- `scripts/make_tokens.mjs`, `src/styles/tokens.css` (regenerated).
- `src/styles/tokens.test.ts`: the four blocks and the mascot tokens exist.
- `src/components/Mascot.tsx` and `Mascot.test.tsx`.
- `src/components/colourAt.ts`, `colourAt.test.ts` (new if missing).
- `src/styles/components.css`, `src/styles/assistant.css`.
- Feature CSS for the radii and fallbacks: `src/features/player/player.css`, `welcome/welcome.css`, `story/story.css`, `compare/compare.css`, `compare/test-mode.css`, `about/about.css`, `ask/ask.css`, `home/home.css`, `help/help.css`, and `src/App.css`.
- `src/App.tsx` (the Suspense fallback only).

## Steps

1. Add the `@font-face` and check that the font loads in the test browser or at least that the rule exists (a test reads `index.css`).
2. In a scratch folder, install `@material/material-color-utilities@0.4.0`. Find its API for the Vibrant scheme and the neutral palette. Write the generator to emit the current `tokens.css` byte for byte, except for the header comment you change.
3. Run the generator with `MCU_DIR=<scratch>`. Make `git diff --exit-code src/styles/tokens.css` clean except the header. Add the mascot tokens in the same run.
4. Replace the mascot's hex with tokens. Replace the radii and fallbacks, file by file.
5. Replace the Suspense text and the cast.
6. Check that `grep` finds no hex literal in `Mascot.tsx`, no `border-radius` with a number in `src/`, and no `as RGB` in `colourAt.ts`.

## Tests

- `tokens.test.ts`: the four colour blocks exist; the mascot tokens exist; contrast of the existing pairs is unchanged (the test already checks them).
- The generator check is a documented command, not a unit test. Its result is written under Result (the diff is empty).
- `Mascot.test.tsx`: the rendered art has no hex attribute; the fills read `var(--…)`.
- `colourAt.test.ts`: the values at the ends and in the middle of a scale match the old results exactly.
- `App.test.tsx`: the Suspense fallback is the loader (role `status` with the label).
- `expectNoA11yViolations` on the mascot and the loader.

## Guardrails

- The same input gives the same colours. The generator's output is fixed by its seed.
- Nothing flashes. The changes do not add motion; `prefers-reduced-motion` still stops all of it.
- Every colour keeps its contrast. The token tests check the existing pairs; the radii change does not affect contrast.
- No data-set name, unit or colour in `src/`.
- Layout is not checked (`.claude/rules/platform.md`); a radius change is not a layout change.

## Done when

- Roboto Flex is loaded by `@font-face`, and its licence file is in `public/fonts/`.
- Running the generator in a scratch folder reproduces `src/styles/tokens.css` (the diff is empty except the header).
- No hard-coded hex or radius number is left in the mascot, the components or the feature CSS, except inside `tokens.css` itself.
- The loader is the Suspense fallback; `colourAt.ts` has no cast.
- All tests pass and the checks are green.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- Redesigning any component or colour.
- The display settings and the high-contrast scheme (VIS2).
- A lint rule to enforce this (I11).
- Any layout or width check.

## Result

Built by agent D on `feature/VIS3-design-system-housekeeping`, 13 Nov 2026, from `main` at `bd91e58`.

**Font.** `src/index.css` has the `@font-face` for Roboto Flex (`/fonts/RobotoFlex-latin.woff2`, weight 100 to 1000, `font-display: swap`), after the tokens import. The licence stays in `public/fonts/`. The built CSS carries the rule, and `dist/fonts/` has both files. A token test reads the rule and checks that both files are there.

**Generator.** `scripts/make_tokens.mjs` is rewritten. It now reproduces `src/styles/tokens.css`:

- Colour is computed: seed `#8a1fe0`, spec 2025, a `DynamicScheme` with `SchemeVibrant`'s primary, secondary, tertiary and error palettes and a neutral palette of chroma 0 (`TonalPalette.fromHueAndChroma`), light and dark at contrast 0 and 1. I found the API in 0.4.0's own `.d.ts` files in a scratch install. On the first run all 144 colour values in the four blocks matched the file.
- Type, shape, elevation, state layers and the motion springs are data in the script, copied from the file, so they come out as they are.
- **The springs are data, not recomputed.** No stiffness and damping I tried, around the values in the file's comment, reproduces the current `linear()` points (best fit is still 0.002 to 0.005 away), and the old settle rule gives other durations (for example 350 ms, not 370 ms). Recomputing would change the app's motion, and the ticket says the spring values are unchanged.
- Two fixes so it runs at all: 0.4.0 has a relative import without `.js` (`./dynamic_color`), which Node's ESM loader refuses, so the script retries such imports with `.js` (`module.registerHooks`, Node 22.15 or later). On Windows the package path is imported as a `file://` URL.
- New tokens, from the same run: `--md-sys-color-warning-container` and `--md-sys-color-on-warning-container` in all four blocks (the amber that `components.css` had as fallbacks; the high-contrast blocks get the same values as light and dark, as before), and the `--mascot-*` tokens.

Generator check (`MCU_DIR` is a scratch folder with `@material/material-color-utilities@0.4.0`):

```
$ MCU_DIR=<scratch> node scripts/make_tokens.mjs && git diff --stat src/styles/tokens.css
wrote …/src/styles/tokens.css
light   on-warning-container on warning-container: 13.22:1 ok
dark    on-warning-container on warning-container: 7.21:1 ok
… (28 ratios, all ok)
 src/styles/tokens.css | 28 ++++++++++++++++++++++++++--
```

The whole diff is the header (one "GENERATED by" line, and the sentence about the warning pair) plus added lines: the warning pair after `on-error-container` in each block, and the mascot section at the end of `:root`. No existing value changed. A second run gives the same file (same SHA-1).

**Mascot.** `src/components/Mascot.tsx` reads `var(--mascot-*)` with no hex fallbacks. The two literal colours in the art are now tokens too: the ground shadow `#000` becomes `--mascot-shadow` (`var(--md-sys-color-shadow)`) and the visor shine `#fff` becomes `--mascot-highlight`. The values are today's, except `--mascot-accent: var(--md-sys-color-primary)` and `--mascot-accent-soft: var(--md-sys-color-primary-container)`, as the ticket asks. **Visible change:** the accent was always `#802cc9`. It now follows the theme: the same in light, `#cd97ff` in dark, `#320059` in light high contrast and `#f2deff` in dark high contrast. `accent-soft` is `#c384ff` in light and dark as before. MascotDock still overrides both per data set (JB04). The fills stay presentation attributes holding `var()`, as F58 drew them. Browsers resolve those, and the Juke-Bot art already relied on it before this ticket.

**Radii and fallbacks** (files in Touches only):

| Literal | Token | Where |
|---|---|---|
| 0.25rem | `--md-sys-shape-corner-extra-small` (4px) | about, home, player (×1), story (×1), welcome (×1); `--ui-corner-extra-small` in components |
| 0.5rem | `-small` (8px) | ask, compare, test-mode, player |
| 0.75rem | `-medium` (12px) | ask, compare, test-mode (×2), player, story; `--ui-corner-medium` in components |
| 1.25rem | `-large-increased` (20px) | help |
| 1.5rem | `-extra-large` (28px) | welcome card. **4px rounder than before**, as the ticket's mapping says |
| 20px | `-large-increased` (20px) | assistant transcript line |
| 999px, 2px | `--ui-corner-full` | components: legend bar (a pill either way), slider thumb (4px wide, so it was already fully rounded) |

`components.css` uses its own `--ui-corner-*` aliases, as its header says to. The circles (`50%`) and the loader's and voice orb's morphing keyframes stay. They are shapes, and no corner token can express them. Fallbacks: `ask.css` `var(--bg, #fff)` → `var(--bg)`. The warning aliases in `components.css` read the new tokens with no hex, and its dark override block is gone, because the tokens' dark block does that job now.

**Loader.** Both Suspense fallbacks in `App.tsx` (the page and the voice panel from I10) are `<LoadingIndicator>`, inside the existing `.app-loading` wrapper so the 40vh it reserves stays.

**Cast.** `colourAt` returns `[mix(0), mix(1), mix(2)]`. New `colourAt.test.ts` (10 tests) checks stops, blends, ends and unsorted stops. I ran it against the old code first, so the expected values are the old results.

**Left over, outside Touches** (files added after this ticket was written). A follow-up can map them the same way:

- `src/components/hotspotMarkers.css:36` (0.25rem)
- `src/describe/description.css:7`, `:13` (0.75rem, 0.25rem)
- `src/features/jukebox/jukebox.css:23` (0.75rem)
- `src/features/mascot/mascot-dock.css:47`, `:61` (1rem, 1.25rem)
- `src/features/player/symphony.css:11` (0.5rem)
- `src/components/mascot.css:22`, `:24`: `var(--mascot-trail, #7fe7ff)`. The fallback is now unused, because the token exists.

**Tests added:** tokens (the four blocks and the GENERATED header, the mascot tokens and the themed accent, the warning pair's contrast in all four schemes, the font rule and files), Mascot (each expression painted only with `none`, `url(#…)` or `var(--mascot-…)`, no hex in any attribute, no a11y violations), App (the page fallback is the shared loader, with the About page's load held, and no a11y violations), colourAt.

**Checks.** On this laptop the default `npm test` (8 vmThreads workers) runs out of memory (about 650 MB free), so the suite ran as `npx vitest run --pool=forks --maxWorkers=1`. Same tests, one process.

```
$ npm run lint
> moon-heist@0.0.0 lint
> oxlint
(exit 0)

$ npx vitest run --pool=forks --maxWorkers=1
 FAIL  src/VoiceAssistant.test.tsx > microphone consent (V02) > "Allow microphone" stores "mic", then asks for the microphone once
AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
 Test Files  1 failed | 141 passed (142)
      Tests  1 failed | 2306 passed (2307)
   Duration  474.00s

$ # the same file alone, four times (unchanged by this branch)
      Tests  53 passed (53)
      Tests  1 failed | 52 passed (53)
      Tests  53 passed (53)
      Tests  53 passed (53)

$ npm run build
✓ built in 1.03s

$ npm run check-bundle
index-ukK8VxwF.js: 80303 bytes gzip (78.4 KB), within the budget of 84362 bytes (82.4 KB).

$ grep -c -E '#[0-9a-fA-F]{3,8}\b' src/components/Mascot.tsx; grep -c "as RGB" src/components/colourAt.ts
0
0
```

**The one failure is not from this branch.** It is a timing-dependent test from I10, already on `main`. This branch changes neither `src/VoiceAssistant.tsx`, its test, nor the hook. Since I10, the hook loads the audio code on first use, and the App preloads it when the panel opens. `VoiceAssistant.test.tsx` renders the panel with the real hook and no App, so its first Start waits for a dynamic import, and the `getUserMedia` assertion sometimes runs first. Confirmed by a temporary `beforeAll(() => loadAssistantAudio())` in that test file: 5 passes out of 5, then reverted. The fix belongs on its own branch (that test file is outside VIS3's Touches). Every test this branch touches passes.
