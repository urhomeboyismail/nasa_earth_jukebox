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

Filled in by the agent.
