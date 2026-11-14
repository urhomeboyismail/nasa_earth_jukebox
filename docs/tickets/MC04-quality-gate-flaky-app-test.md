# MC04 Quality gate, and the flaky App test

| | |
|---|---|
| **Priority** | P2 |
| **Size** | S (under half a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | — |
| **Branch** | `chore/MC04-quality-gate`, from `chore/jpl-hud-theme` |

## Goal

The full check suite passes reliably on `chore/jpl-hud-theme`. In particular, `src/App.test.tsx:112` ("loads the first visualization and shows it on each page") no longer fails now and then under the full run.

## Base

Like every MC ticket, this one branches from `chore/jpl-hud-theme` (not yet on `main`), and the person merges it back there.

## Why

- On 14 Nov 2026 a full `npm test` had 1 failure out of 3162 at `src/App.test.tsx:112`. The same file alone passed (51/51), and the run before passed everything. That points to a timing flake under load, not a code fault, but no one has confirmed that.
- During MC01's full run, a different test failed the same way: `src/features/art/ArtPanel.test.tsx` "imports a valid file: the choice is applied and art mode is on" failed in the full suite and passed alone (21/21). So look for a shared cause (suite load, timeouts, leaked timers or globals), not just one test.
- A flaky test makes the gate before the pull request (MC05) untrustworthy.

## Reuse

- `ecc:quality-gate` or `ecc:verification-loop` to run the gate.
- `src/App.test.tsx` and its `fetch` stubs. Testing Library's `findBy*` and `waitFor` timeouts.

## Touches

`src/App.test.tsx`. Production code only if the flake turns out to be a real race; then post on `docs/AGENT-BOARD.md` first, because `src/App.tsx` is the `app` hotspot.

## Steps

1. Branch from `chore/jpl-hud-theme`.
2. Reproduce: run the full suite 3 times, then the file alone 10 times (`npx vitest run src/App.test.tsx`), and record the failures.
3. Check whether `main` (`fc6e8eb`) flakes too, so you know whether the Mission Control commits are involved.
4. Fix the cause. Prefer awaiting the right element over a longer timeout. If a timeout is the honest fix, say why.
5. Run the gate: lint, test, build and `check-data`, and paste their real output.

## Tests

The fixed test passes 10 runs in a row alone, and in 3 full runs.

## Done when

- The cause is named in **Result** (a test race, or a real race in the app).
- The gate's real output is pasted in **Result**.

## Checks

```bash
npm run lint && npm test && npm run build
npm run check-data
```

## Out of scope

- Other lint warnings that were already there (`src/features/compare/Fusion.tsx`).

## Result

Filled in by the agent.
