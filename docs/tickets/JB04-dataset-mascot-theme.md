# JB04 Data-set colour themes and trails from the manifest

| | |
|---|---|
| **Priority** | P2 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | F58 |
| **Hotspots** | schema, catalogue |
| **Branch** | `feature/JB04-dataset-mascot-theme` |

## Goal

Echo's thruster glow, visor accents and headphone LEDs take the colour of the open data set, and its jet trail takes a style that suits it: bubbles for ocean data, solar ions for atmosphere, bio-frequency pulses for vegetation. Each data set chooses these in **its own manifest**, through a new general field. Data sets that don't set it get a sensible default from their colour scale.

## Why

- The idea (team request, 2026-11-10) names three themes: ocean or hydro data in teal `#00ffcc` with bubble trails; atmosphere in electric blue `#00f0ff` with solar-ion trails; forest or vegetation in synth green `#39ff14` with bio-frequency pulses.
- `.claude/rules/phases.md`: nothing specific to one data set goes in `src/`. A data set's look lives in `public/data/<id>/manifest.json`. A need no field can express gets a **general** field in `src/data/schema.ts` and `src/data/types.ts`, documented in `docs/data-sources.md` → "Manifest fields" (`:43`), with a default.
- F58 turns Echo's colours into CSS variables (`--mascot-accent`) and adds the `data-trail` style hook.
- The colour scale is already in every manifest (`colorScale` in `src/data/schema.ts:21`), and `src/components/colourAt.ts` reads it, so a default accent can come from it.
- The data sets in the repo that fit the named themes are `mur-sst-mauritius` (sea surface temperature) and `synthetic-ocean` (ocean), plus `synthetic-storm` (atmosphere). There is no vegetation set yet; EIC03 adds the picked EIC sets.

## Design

**The field** (optional; strict like `sonification`, so a typo is reported):

```ts
mascot?: {
  accent?: string                                   // "#rrggbb"
  trail?: 'sparks' | 'bubbles' | 'ions' | 'pulse'   // a style, not a data-set name
}
```

Add it to the zod schema and to `Visualization` in `types.ts` together. They must match, per the header comment.

**Defaults** (`src/features/mascot/accent.ts`, new, pure):

```ts
export function mascotTheme(v: Pick<Visualization, 'colorScale' | 'mascot'>): { accent: string; trail: Trail }
```

- `accent`: the manifest's value; or else the most saturated stop of `colorScale` (HSL saturation, ties broken by the higher stop); or else, if that has less than 3:1 contrast against the visor colour from F58, the design token `--md-sys-color-primary`. A manifest accent with too little contrast also falls back, and `npm run check-data` warns about it.
- `trail`: the manifest's value, or `sparks`.

**Trail styles** (`src/components/mascot.css`, from F58). Small SVG or CSS particles behind the boots, shown while `boosting` or `retro`. All are only under `prefers-reduced-motion: no-preference`; under reduce they are a still picture.

| `trail` | Look |
|---|---|
| `sparks` (default) | A few short spark dashes |
| `bubbles` | Small rising circles |
| `ions` | Thin streaking dashes with a glow |
| `pulse` | Expanding rings, at most 2 a second |

**Wiring.** `MascotDock` (JB01) gets the open `Visualization` from `App.tsx` and sets `--mascot-accent` and `data-trail`. If JB01 didn't pass the visualization, read it the same way the pages do (`PageProps`, `src/features/types.ts`), and post on the board rather than editing `App.tsx`.

**Manifests and docs:**

- `public/data/mur-sst-mauritius/manifest.json` and `public/data/synthetic-ocean/manifest.json`: `"mascot": { "accent": "#00ffcc", "trail": "bubbles" }`.
- `public/data/synthetic-storm/manifest.json`: `"mascot": { "accent": "#00f0ff", "trail": "ions" }`.
- `docs/data-sources.md` → "Manifest fields": the field, its default and the contrast rule.
- `docs/DATASET-PLAYBOOK.md`: a step "choose Echo's accent and trail". Water uses `#00ffcc` with `bubbles`, air uses `#00f0ff` with `ions`, plants and land cover use `#39ff14` with `pulse`. Check the contrast.
- The data check behind `npm run check-data`: validate the field and warn on low contrast.

## Reuse

- `colorScale`, `colourAt` (`src/components/colourAt.ts`), and the contrast helper used by `src/styles/tokens.test.ts`, if it can be imported; otherwise write a small `contrastRatio` in `accent.ts`.
- The strict-object pattern of `sonification` in `src/data/schema.ts:102`.
- `Echo`'s CSS variables and `data-trail` hook (F58).

## Touches

- `src/data/schema.ts`, `src/data/types.ts` (the `schema` hotspot).
- `src/features/mascot/accent.ts` and `accent.test.ts` (new); `src/features/mascot/MascotDock.tsx` (set the variable and attribute).
- `src/components/mascot.css`: the four trail styles.
- `public/data/mur-sst-mauritius/manifest.json`, `public/data/synthetic-ocean/manifest.json`, `public/data/synthetic-storm/manifest.json`.
- `docs/data-sources.md` (the `catalogue` hotspot), `docs/DATASET-PLAYBOOK.md`.
- The data check script behind `npm run check-data`.
- `docs/PRE-HACKATHON-WORK.md`: one line.

## Steps

1. Add the field to the schema and types, with a schema test for a good value, a bad colour and an unknown trail.
2. Write `mascotTheme` with tests on the `fixture`, `synthetic-ocean`, `synthetic-globe` and `synthetic-change` manifests.
3. Add the trail styles.
4. Wire the accent and trail into the dock.
5. Set the three manifests; update the docs and the data check.
6. Run all checks, including `npm run check-data`.

## Tests

- Schema: `mascot` is optional; `"#00ffcc"` passes; `"teal"` and `"#0fc"` fail; `trail: "forest"` fails.
- `mascotTheme`: a manifest accent wins; with none, the most saturated stop is chosen; a low-contrast colour falls back to the token; the trail defaults to `sparks`.
- Every data set in `public/data/index.json` still validates (`npm run check-data`).
- `MascotDock.test.tsx`: with the `synthetic-ocean` manifest, the dock's root has `--mascot-accent: #00ffcc` and `data-trail="bubbles"`; `await expectNoA11yViolations(container)`.

## Guardrails

- Nothing specific to one data set goes in `src/`. The colours and the choice of trail live only in manifests and the playbook. `src/` names styles (`bubbles`), never data sets.
- Colour is never the only signal: the trail shapes differ, and every state is still in text (WCAG 1.4.1). Accent contrast is at least 3:1 against the visor (WCAG 1.4.11).
- Motion only under `prefers-reduced-motion: no-preference`; `pulse` stays at 2 a second or less (WCAG 2.3.1).
- Every other data set still validates and looks the same apart from Echo.

## Done when

- Switching between `mur-sst-mauritius`, `synthetic-storm` and `fixture` changes Echo's accent and trail as the manifests say.
- The field is documented and checked. The checks pass, including `npm run check-data`.

## Checks

```bash
npm run lint && npm test && npm run build
npm run check-data
```

## Out of scope

- Theming the rest of the app by data set.
- Picking accents for the EIC data sets (EIC03 does that with the playbook step).

## Result

Built by agent D on `feature/JB04-dataset-mascot-theme`, 12 Nov 2026.

**What changed**

- `src/data/schema.ts`, `src/data/types.ts`: optional, strict `mascot { accent?, trail? }`. `accent` must be `#rrggbb`, `trail` one of `sparks`, `bubbles`, `ions`, `pulse`. Schema and type change together (the `expectTypeOf` check in `schema.test.ts` compiles).
- `src/features/mascot/accent.ts` (new, pure): `mascotTheme` picks the first of the manifest accent and the most saturated legend stop (ties go to the higher stop) with at least 3:1 against the visor `#0f2233`; otherwise `var(--md-sys-color-primary)`. The trail defaults to `sparks`. `accentWarning` produces the `check-data` warning.
- `src/features/mascot/MascotDock.tsx`: a new optional `visualization` prop. With it, the dock's root gets `--mascot-accent`, `--mascot-accent-soft` (a 55 % mix with white) and `--mascot-trail`, plus `data-trail`. Without it, Echo keeps its own colours.
- `src/components/mascot.css`: four trail shapes keyed off an ancestor `[data-trail]` (short dashes, small rings, long streaks, a wide ring). They are still pictures by default and move only under `prefers-reduced-motion: no-preference`. `pulse` runs one cycle every 0.8 s, under the 2 a second limit.
- Manifests: `mur-sst-mauritius` and `synthetic-ocean` get `#00ffcc` / `bubbles`; `synthetic-storm` gets `#00f0ff` / `ions`. Only the field is added (a JSON round trip left the rest byte-identical).
- `src/data/datasets.test.ts` (run by `npm run check-data`): one warning-only case per data set prints `accentWarning`. None of the current data sets triggers it.
- Docs: `docs/data-sources.md` gains the "Echo's look (JB04)" section, `docs/DATASET-PLAYBOOK.md` step 4 gains the accent and trail line, and `docs/PRE-HACKATHON-WORK.md` gains one line.

**Still open (outside Touches)**

- `src/App.tsx:237` does not pass the data set to `<MascotDock>`, so in the running app Echo keeps its default colours until it does. Asked on the board: `R-20261112-JB04-1` (one prop, `visualization={visualization}`). "Done when: switching data sets changes Echo" is covered by `MascotDock.test.tsx` but needs that line in the app.
- The trails only show while Echo is `boosting` or `retro`, and nothing in the dock sets a motion yet (JB02 does). The shapes are ready for it.
- `Mascot.tsx` still writes its own `data-trail="spark"` on the `<svg>`. The styles key off the dock's attribute, so it does no harm; it could go in a later Mascot ticket.
- The fallback token `--md-sys-color-primary` is `#802cc9` in light mode, which is itself only 2.4:1 against the visor. It is today's look, as the ticket asks. The dark theme's `#cd97ff` passes.
- The generators `scripts/make_synthetic.py` and `make_synthetic_storm.py` rewrite their manifests in full, so a regeneration would drop `mascot` (as it would `variable.words` in `synthetic-ocean` today).

**Checks** (Windows, Node 24.19.0)

`npm run lint`:
```
> moon-heist@0.0.0 lint
> oxlint
```
(exit 0, no findings)

`npm run build`:
```
dist/assets/player-Ce8cMOyu.js             49.06 kB │ gzip:  16.52 kB
dist/assets/esm-Cf-aICZN.js               340.81 kB │ gzip:  79.42 kB
dist/assets/index-PQHmzxle.js             389.09 kB │ gzip: 121.94 kB
✓ built in 974ms
```
(exit 0)

`npm test`: the default run (8 `vmThreads` workers) aborted with `FATAL ERROR: Zone Allocation failed - process out of memory` on this laptop (8 GB, about 1.2 GB free). Re-run as `npx vitest run --maxWorkers=2`:
```
 FAIL  src/data/sound-regression.test.ts > sound regression baseline > notices when one legend stop of the fixture changes
 Test Files  1 failed | 109 passed (110)
      Tests  1 failed | 1828 passed (1829)
   Duration  84.33s
```

`npm run check-data` (as `npx vitest run --maxWorkers=2 src/data src/analysis/synthetic.test.ts`):
```
 FAIL  src/data/sound-regression.test.ts > sound regression baseline > notices when one legend stop of the fixture changes
 Test Files  1 failed | 11 passed (12)
      Tests  1 failed | 258 passed (259)
```

The one failure is not from JB04. It fails the same way on `main` with these changes stashed. The test compares a string with `
` endings against `src/data/__golden__/fixture.json` read from disk, and this machine checks files out with `core.autocrlf=true` (`git ls-files --eol`: `i/lf w/crlf`), so the file on disk has `
`. On a checkout with LF endings it should pass.

The JB04 tests, all passing: `schema.test.ts` "Echo's look: the mascot field (JB04)" (4), `accent.test.ts` (12) and `MascotDock.test.tsx` "Echo's look follows the open data set (JB04)" (3, the first with `expectNoA11yViolations`). The six mascot, schema and data-set files together give 162 passed.
