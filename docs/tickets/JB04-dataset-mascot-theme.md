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

Not started.
