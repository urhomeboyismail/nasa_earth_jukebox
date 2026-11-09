# VIS3 Design-system housekeeping

| | |
|---|---|
| **Priority** | P2 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | app |
| **Branch** | `feature/VIS3-design-system-housekeeping` |

**Reviewers:** Roni (`src/styles/`, `src/index.css`, `src/components/`, `scripts/make_tokens.mjs`); Mohammad (`src/App.tsx` and the feature CSS in `player`, `compare`, `explore` and `ask`).

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

- `src/index.css` (the `@font-face`; Roni reviews).
- `scripts/make_tokens.mjs`, `src/styles/tokens.css` (regenerated).
- `src/styles/tokens.test.ts`: the four blocks and the mascot tokens exist.
- `src/components/Mascot.tsx` and `Mascot.test.tsx`.
- `src/components/colourAt.ts`, `colourAt.test.ts` (new if missing).
- `src/styles/components.css`, `src/styles/assistant.css`.
- Feature CSS for the radii and fallbacks: `src/features/player/player.css`, `welcome/welcome.css`, `story/story.css`, `compare/compare.css`, `compare/test-mode.css`, `about/about.css`, `ask/ask.css`, `home/home.css`, `help/help.css`, and `src/App.css` (Mohammad reviews the player, compare, ask and App files).
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

Not started.
