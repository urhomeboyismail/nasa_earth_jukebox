# <ID> <Title>

| | |
|---|---|
| **Priority** | P0 / P1 / P2 / P3 |
| **Size** | S (under half a day) / M (about a day) / L (more than a day) |
| **Who** | agent / 👤 (a person; agents never claim it) / agent+👤 (an agent builds it, a person signs off) |
| **Needs** | Ticket IDs that must be `done` first, or — |
| **Hotspots** | Hotspot files this ticket edits (see `docs/TICKETS.md`), or — |
| **Branch** | `feature/<ID>-<slug>` (or `fix/`, `chore/`) |

## Goal

One or two sentences: what is true when this ticket is done.

## Why

The finding that makes this worth doing, with `file:line` references, so the agent does not have to rediscover it.

## Design

The part of the v3 design (`docs/PLAN.md` §6.3) that this ticket builds: interfaces, names, numbers. Leave this out for small fixes.

## Reuse

Functions, files and tests that already exist and must be used instead of written again.

## Touches

The files this ticket may change. Anything else needs a post on `docs/AGENT-BOARD.md` first.

## Steps

1. …

## Tests

Tests sit next to the code (`x.ts` → `x.test.ts`). Find things by role and name, use `userEvent`, call `expectNoA11yViolations`, use the fakes in `src/test/fakes.ts`, and stub `fetch` with `vi.stubGlobal`. Server tests use pytest in `server/`.

## Guardrails

For every ticket that makes sound or changes what is shown while sound plays:

- The same input always gives the same output (features, music frames, WAV bytes). Any randomness is seeded.
- The peak stays at or below −1 dBFS. No sound plays before a click or key press (WCAG 1.4.2).
- Nothing flashes more than 3 times a second (WCAG 2.3.1). Under `prefers-reduced-motion` everything is still. The NASA image never animates beyond its own frames.
- Every voice and cue has a text equivalent, and changes are announced through `useAnnounce`, never over a screen reader.
- Nothing specific to one data set goes in `src/` (`.claude/rules/phases.md`). No model in `analysis/`, `audio/`, `describe/` or `sonify/`.

For interaction tickets (IX), also the five principles in `docs/PLAN.md` §6.3: a sound answer within 50 ms, sound first and words on request, the listener in control, one input layer for every device, learn by doing.

## Done when

- …

## Checks

```bash
npm run lint && npm test && npm run build
npm run check-data                          # if public/data/ changed
(cd server && .venv/bin/python -m pytest)   # if server/ or src/pages.ts changed
```

## Out of scope

- …

## Result

Filled in by the agent: the branch, the commits, and the real output of the checks, failures included.
