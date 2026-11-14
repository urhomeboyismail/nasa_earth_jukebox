# MC03 The backdrop follows real sound

| | |
|---|---|
| **Priority** | P1 |
| **Size** | S (under half a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | — |
| **Branch** | `chore/MC03-backdrop-real-audio`, from `chore/jpl-hud-theme` |

## Goal

While a data set plays, the backdrop's atmosphere line and satellite speed visibly follow the sound, and they settle back when it stops. This is checked in a real browser with real audio, not by calling `setJukeboxEnergy` by hand.

## Base

Like every MC ticket, this one branches from `chore/jpl-hud-theme` (not yet on `main`), and the person merges it back there.

## Why

- Browser QA only set the energy by hand. The real path never ran: ensemble graph → `setLevelSource` (`src/audio/ensemble/graph.ts:77`) → energy timer (`src/audio/level.ts:30`) → `window.setJukeboxEnergy` (`public/nasa-bg.js`).
- The energy is the mean of 4 bands × 2 (`readEnergy` in `level.ts`), a guess. Real music may sit near 0 or pinned at 1.

## Reuse

- `ecc:browser-qa` or `ecc:e2e-testing`, with the Chrome DevTools MCP.
- The fixture dataset (`public/data/fixture/manifest.json`) and the Listen page's Play.
- `readBands` in `src/audio/level.ts`.

## Touches

`src/audio/level.ts`, `src/audio/level.test.ts` (only to retune the energy mapping), `public/nasa-bg.js` (only for the response curve).

## Steps

1. Branch from `chore/jpl-hud-theme`. Run `npm run dev`.
2. On Listen, press Play on two data sets (fixture and a synthetic one). Log the energy values for about 20 s (wrap `window.setJukeboxEnergy` from the page) and take screenshots at quiet and loud moments.
3. If the values are bunched near 0 or near 1, retune `readEnergy`. Keep it simple: a gain and a clamp. Update its test.
4. Check that pausing brings the line back to rest within a second.

## Tests

`level.test.ts`: the energy test stays green with the new mapping (fake timers).

## Guardrails

- No sound changes. The analyser is a read-only tap. No sound before a click.
- The atmosphere line pulses with the sound, but never more than 3 flashes a second.

## Done when

- **Result** holds the min, median and max energy logged for each data set, the screenshots' paths, and the mapping used.
- The line visibly moves while playing and rests when paused.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- Changing the look (that is MC01 and the design contract). Code review, the accessibility pass.

## Result

Branch `chore/MC03-backdrop-real-audio` (from `chore/jpl-hud-theme` at `14b29ce`): **no code change**, so there is nothing to merge. This is a findings ticket. Claim kept local, not pushed (the person's choice, 14 Nov 2026).

**How it was measured:** Chrome, dev server, Listen at 1440×900, real clicks on Play (so audio starts with a user gesture). `window.setJukeboxEnergy` was wrapped from the page to log every value `level.ts` sends (about 30 a second). 10 s per run.

**Finding 1: only Symphony mode drives the backdrop.** The analyser tap exists only on the Symphony ensemble's master (`src/audio/ensemble/graph.ts:77`, the only caller of `setLevelSource`). Simple mode, which is the default on Listen (`src/features/player/index.tsx:89`), and Scan play through `src/audio/engine.ts`, which has no tap. Playing the fixture in Simple mode for 2.5 s logged **0** energy values, so the backdrop stays at rest. Echo's chest equaliser (UI08) has the same gap. Fixing it means tapping `engine.ts` the way `graph.ts` does, and `engine.ts` is the `engine` hotspot, outside this ticket. Proposed as a follow-up ticket; not built.

**Finding 2: in Symphony mode the line follows the sound; the mapping stays as it is.**

| Data set (Symphony) | Samples | Min | 10th pct | Median | 90th pct | Max | At 1.0 | Swings low→high per s |
|---|---|---|---|---|---|---|---|---|
| Fixture ocean (Loop on) | 294 | 0 | 0 | 0.092 | 0.636 | 0.856 | 0 | — |
| Synthetic ocean | 294 | 0.100 | 0.456 | 0.851 | 0.898 | 0.913 | 0 | 0.2 |

- Mapping in use: `readEnergy` = mean of 4 log bands × 2, clamped to 1 (`src/audio/level.ts:23`). Unchanged.
- Why not retune: neither data set touched the clamp (overall max 0.913) or sat at 0, and the fixture used almost the whole range. Synthetic ocean sits high and steady because its sound is steady: the page's own description at that moment read "The overall level is middle and steady". A lower gain would leave the top third unused for every data set. A single gain cannot both lift quiet sets and spread steady loud ones; that would need a level relative to a slow average, which is a design change, not a tune.
- Rest: after Stop, all 44 values in the next 1.5 s were 0 (the timer keeps running while the graph exists and reads silence). The backdrop's own smoothing settles the line in about half a second.
- Flashing: the line changes width and opacity smoothly (analyser smoothing 0.8, then the backdrop's easing). It is a thin line, far below the WCAG 2.3.1 area for a flash, and swung low→high 0.2 times a second.

**Screenshots** (local, in the session scratchpad `mc03/`): `fixture-playing.png`, `synthetic-ocean-playing.png` (atmosphere line visibly thicker while playing).

**Checks:** none run, as no file changed. The branch is identical to `chore/jpl-hud-theme` at `14b29ce`, whose checks passed in MC02's base run.

**Proposed follow-up (needs a new ticket; `engine` hotspot):** tap `src/audio/engine.ts`'s output into `setLevelSource` as `graph.ts` does, so Simple and Scan drive the backdrop and Echo's chest too.
