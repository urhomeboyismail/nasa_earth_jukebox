# F58 Robot Echo redraw

| | |
|---|---|
| **Priority** | P2 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | H05 |
| **Hotspots** | — |
| **Branch** | `feature/F58-robot-echo` |

## Goal

Echo, the guide, is drawn as a small friendly robot in a clear astronaut helmet. It is our own design. Its four poses stay the same, so every place that shows Echo is unchanged. The persona line says Echo is a program, not a person.

## Why

- Echo is now a full-body astronaut (`src/components/Mascot.tsx:1` and `:60`: "an astronaut who listens to Earth", "Echo: the full-body astronaut"). The persona line in `server/app/assistant/knowledge.py:61` calls it "the app's friendly astronaut mascot".
- The brainstorm card (`docs/planning/BRAINSTORM-9NOV.md` §4, F58) gives the reasons. Echo's welcome lines are scripted, and with the server on its answers come from an AI model. A robot says it is a program. A human astronaut suggests a real person is listening.
- The redraw is cheap: the four poses (`MascotPose`: `idle`, `listening`, `talking`, `thinking`) and the Sonny badge already exist. The sizes and props do not change.
- The concept page `docs/design/mascot-concepts.html` (and `mascot-concepts.png`) shows the current astronaut, and must be refreshed.
- The name stays "Echo". `MASCOT_NAME` is in `src/features/welcome/lines.ts:4`, and `PERSONA_NAME` in `knowledge.py:60`. The test `test_the_persona_name_matches_the_frontend` checks they match.
- The decision on the name and the art (H05) must be made first. This ticket is the drawing.

## Reuse

- `Echo`, `Sonny` and `MascotPose` in `src/components/Mascot.tsx`. Keep their names, props and default sizes.
- The colour constants `C` in `Mascot.tsx:8` to `:16`. Use only those colours. Do not add new ones.
- The tests in `src/components/Mascot.test.tsx`.
- The persona test `test_the_guide_speaks_as_the_mascot_and_keeps_its_rules` in `server/tests/test_assistant.py:239`, which must keep passing, and the name test at `:249`.

## Design

**Look.** From the card:

- Helmet: a clear glass dome with a collar ring. The Earth reflection on the glass stays.
- Head and face: a rounded robot head inside the helmet, with a dark face screen (`C.visor`), two glowing eyes (`C.glow`) and a mouth line.
- Ears: two round speaker discs on the sides of the head.
- Body: a short, rounded torso with a chest panel. No antenna (it would poke through the helmet).
- Colours: only the tokens already in `Mascot.tsx` (purple, light shell, cyan glow).

**Poses as expressions.** `MascotPose` and every caller stay the same.

- `idle`: a smile.
- `listening`: wider eyes, and the ear discs glow.
- `talking`: the mouth becomes a few waveform bars.
- `thinking`: the eyes glance up, and the mouth becomes dots.

**Do not resemble** (from the card; two team members compare the finished art with this list before the merge, and it is ticked in the pull request):

- twin binocular eyes on stalks (WALL-E);
- a glossy white egg body (EVE);
- a dome head on a barrel body (R2-D2);
- a round ball (BB-8);
- a soft white inflatable (Baymax).

No NASA logo, worm, meatball, flag or mission patch.

**Persona line.** In `knowledge.py`, `PERSONA` says Echo is a friendly robot guide in an astronaut helmet, and a program, not a person. It says so if asked. The tools and the rules do not change.

**AI disclosure.** If any AI image tool is used for a reference, say so in the README's AI section (S03). The final art is drawn as SVG by a team member.

## Accessibility

- The mascot stays decorative (`aria-hidden`). Its name and every state are in text, in the guide and the welcome.
- Each pose differs by shape (mouth, eye size, the discs), not by colour or glow alone.
- The glowing features keep at least 3:1 contrast against the dark face screen (WCAG 1.4.11).
- Motion only under `prefers-reduced-motion: no-preference`. Nothing flashes.

## Touches

- `src/components/Mascot.tsx` and `src/components/Mascot.test.tsx`. Review: Roni (`src/components/`).
- `docs/design/mascot-concepts.html` and `docs/design/mascot-concepts.png`. Review: Roni.
- `server/app/assistant/knowledge.py`: the persona line only. Review: Mohammad (`server/app/assistant/`), and the team leader as the card asks.
- `server/tests/test_assistant.py`: add the "program, not a person" check.
- `README.md`: one line in the AI disclosure. Review: Bhavish.
- `docs/PRE-HACKATHON-WORK.md`: one line.

## Steps

1. Read H05's decision on the name and the art, in the queue and on `docs/AGENT-BOARD.md`. If the name is not "Echo", stop and ask.
2. Draw the four poses and the Sonny badge in `Mascot.tsx`, as SVG, with the design above. Keep the props and sizes.
3. Update the comments at the top of `Mascot.tsx` and at `:60` (no more "astronaut who listens to Earth", say the helmeted robot).
4. Update the persona text in `knowledge.py`. Keep the name and the rules.
5. Update the persona test in `server/tests/test_assistant.py` with the new check (see Tests).
6. Refresh `docs/design/mascot-concepts.html` and export its PNG again.
7. Check the "Do not resemble" list by eye against the art, and tick it in the pull request.
8. Run the checks.
9. Add one line to `docs/PRE-HACKATHON-WORK.md` under "During the hackathon".

## Tests

- `Mascot.test.tsx`: all four poses render for `Echo` and `Sonny` at full size and as the badge. Each pose produces a different set of SVG shapes (compare the markup of the four poses, for example the number of `ellipse` or `path` elements, or a `data-pose` attribute). Keep the test that checks the markup is `aria-hidden`.
- `Mascot.test.tsx`: with reduced motion (`matchMedia` stub), no animation class is applied.
- The existing tests of the welcome, help and demo (`welcome.test.tsx`, `help.test.tsx`, `DemoControl.test.tsx`) pass unchanged. `await expectNoA11yViolations(container)` where they render the mascot.
- `server/tests/test_assistant.py`: the persona text says "program" and "not a person", and it says so when asked (check the text, not the model). The name test and the rules test pass unchanged.
- The server tests: `(cd server && .venv/bin/python -m pytest)`.

## Guardrails

- Visual only. No sound, no beep, no new animation. Motion is off under reduced motion, and nothing flashes more than 3 times a second.
- Each pose can be told apart without colour (WCAG 1.4.1), and the glow keeps 3:1 contrast (WCAG 1.4.11).
- The name, "Echo", is not changed.

## Done when

- The four poses and the badge render; the tests above pass.
- The "Do not resemble" list is ticked in the pull request, and two team members have looked at the art.
- The persona line says Echo is a program, not a person, and the server test checks it.
- The concept page and its PNG show the new art.
- `npm run lint && npm test && npm run build` pass. `(cd server && .venv/bin/python -m pytest)` passes.
- Roni (components), Mohammad (persona) and Bhavish (README line) have reviewed their parts.

## Checks

```bash
npm run lint && npm test && npm run build
(cd server && .venv/bin/python -m pytest)
npx vitest run src/components/Mascot.test.tsx src/features/welcome src/features/help src/features/demo
```

## Out of scope

- New poses, new animation, a second character, beeps or other sound effects (they would clash with the data's sounds).
- A rename. `MASCOT_NAME` stays "Echo".
- The voice guide's behaviour (G04, G05).

## Result

Not started.
