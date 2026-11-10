# F58 Echo as Juke-Bot: art, five visor expressions, motion states

| | |
|---|---|
| **Priority** | P2 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | H05 |
| **Hotspots** | — |
| **Branch** | `feature/F58-juke-bot` |

## Goal

Echo, the guide, is redrawn as **Juke-Bot**: a small friendly robot with an LED visor helmet, headphones, a chest screen (equalizer bars and a mini globe), gloves and glowing air-booster boots. It is our own design. The component gains five visor expressions and four motion states as props, so the later Juke-Bot tickets (JB01–JB07) only have to set props. Every place that shows Echo today still works unchanged. The persona line says Echo is a program, not a person.

## Why

- H05 is decided (2026-11-10, `docs/AGENT-BOARD.md` R-20261109-F37-1): the art is the Juke-Bot design, the name stays "Echo".
- Echo is now a full-body astronaut (`src/components/Mascot.tsx:1` and `:61`). The persona line in `server/app/assistant/knowledge.py:61` calls it "the app's friendly astronaut mascot". The brainstorm card (`docs/planning/BRAINSTORM-9NOV.md` §4, F58) explains why a robot is more honest: the guide's answers come from code and an AI model, not a person.
- `MascotPose` (`Mascot.tsx:6`: `idle`, `listening`, `talking`, `thinking`) is used by the voice panel (`src/VoiceAssistant.tsx:73-77`), the welcome and help. Those callers must not change.
- The colours are hard-coded in `C` (`Mascot.tsx:8`). JB04 recolours the accent per data set, so they have to become CSS variables with the current values as fallbacks.
- The chest already has small equalizer bars; JB03 drives them from the sound, so their heights must come from a prop.
- The concept page `docs/design/mascot-concepts.html` (and `.png`) shows the old astronaut.

## Design

**Look.**

- Helmet: a rounded robot head in a helmet with a dark LED visor (`--mascot-visor`), the Earth reflection kept on the glass.
- Headphones: two ear cups over the helmet, each with a small LED (`--mascot-accent`).
- Torso: short and rounded, with a chest screen holding at least four EQ bars and a mini globe (a circle with two meridian arcs).
- Gloves: rounded; one arm has a `pointing` variant.
- Boots: chunky air-booster boots, each with a nozzle and a flame path (hidden unless `motion` is `boosting` or `retro`).
- Glow: one `<filter>` with `feGaussianBlur` and `feMerge` in `<defs>`, used on the visor, LEDs and flames. Ids come from `useId`, as the clip paths already do.
- No antenna, no NASA logo, worm, meatball, flag or mission patch.

**Do not resemble** (two team members compare the art with this list before the merge; tick it in the pull request): twin binocular eyes on stalks (WALL-E); a glossy white egg body (EVE); a dome head on a barrel body (R2-D2); a round ball (BB-8); a soft white inflatable (Baymax); a blue-and-white jet-boot robot boy (Astro Boy); any existing game robot.

**Props** (all optional, so every caller keeps working):

```ts
export type MascotPose = 'idle' | 'listening' | 'talking' | 'thinking'          // unchanged
export type MascotExpression = 'happy' | 'searching' | 'eq_active' | 'alert' | 'resting'
export type MascotMotion = 'idle' | 'boosting' | 'retro' | 'pointing'
type EchoProps = {
  pose?: MascotPose
  expression?: MascotExpression   // default from pose: talking → eq_active, thinking → searching, otherwise happy
  motion?: MascotMotion           // default 'idle'
  thrust?: number                 // 0–1, flame length while boosting
  levels?: ArrayLike<number>      // 0–255, one per chest bar; default a fixed resting shape
  globeSpin?: number              // 0–1, the mini globe's turn speed
  className?: string
}
```

Props become `data-expression`, `data-motion` and the CSS variables `--thrust`, `--globe-spin` on the root `<svg>`. Bar heights are set as SVG attributes (`y`, `height`), not CSS, so they render without animation.

Put the types and the `pose → expression` mapping in `src/components/mascotTypes.ts` (a file that exports components exports only components).

**Visor expressions.** Each differs by **shape**, not only colour (WCAG 1.4.1):

| Expression | Visor shape |
|---|---|
| `happy` | Two arc eyes and a small smile path |
| `searching` | A horizontal radar line that sweeps, and three query dots |
| `eq_active` | Five wave bars in the visor |
| `alert` | A warning triangle with "!", in a high-contrast orange or red with at least 3:1 against the visor |
| `resting` | Two closed-eye lines, no mouth |

The old pose looks carry over: `listening` lights the ear-cup LEDs.

**Colours.** `C` becomes CSS variables (`--mascot-shell`, `--mascot-visor`, `--mascot-accent`, …), each with the current value as its fallback, so nothing looks different until JB04 sets `--mascot-accent`. `--mascot-trail` is a style hook (`data-trail` attribute) JB04 fills in; the default is a generic spark.

**Motion** (`src/components/mascot.css`, new, imported by `Mascot.tsx`). Every animation sits inside `@media (prefers-reduced-motion: no-preference)`:

- `floatIdle`: a 4 s ease-in-out vertical float (about 4 px), infinite, for `motion='idle'`.
- `boosting`: the body group rotates to −15° (forward tilt) with a quick transition; the flames show, and their `scaleY` is `0.4 + 0.6 × var(--thrust)`; `flickerFlame` changes flame opacity at most 3 times a second.
- `retro`: `retroBurn`, a short flame burst pointing forward (the boots tilt back) for about 400 ms.
- `pointing`: the pointing arm rotates out; no loop.
- `visorPulse`: a gentle glow pulse for `eq_active` and `alert`, at most once a second.
- The mini globe turns with `--globe-spin`.

Under reduced motion: no keyframes run, the tilt and flames still show as a still picture (so the state is visible), and nothing moves.

## Reuse

- `Echo`, `Sonny` and `MascotPose` in `src/components/Mascot.tsx`. Keep their names, default sizes and the `useId` clip-path pattern.
- The tests in `src/components/Mascot.test.tsx`.
- The global reduced-motion clamp in `src/index.css:130-139` stays as a backstop; don't remove it.
- The persona tests in `server/tests/test_assistant.py` (`test_the_guide_speaks_as_the_mascot_and_keeps_its_rules`, `test_the_persona_name_matches_the_frontend`).

## Accessibility

- The mascot stays decorative (`aria-hidden`). Its name and every state are in text where it is used (the guide, the welcome, and later the JB01 dock).
- Each expression differs by shape. The glow and the alert symbol keep at least 3:1 contrast against the visor (WCAG 1.4.11).
- Nothing flashes more than 3 times a second (WCAG 2.3.1). Under reduced motion everything is still.

## Touches

- `src/components/Mascot.tsx`, `src/components/Mascot.test.tsx`
- `src/components/mascotTypes.ts` (new), `src/components/mascot.css` (new)
- `docs/design/mascot-concepts.html` and `docs/design/mascot-concepts.png`
- `server/app/assistant/knowledge.py`: the persona line only
- `server/tests/test_assistant.py`: the "program, not a person" check
- `README.md`: one line in the AI disclosure, only if an AI image tool was used for a reference
- `docs/PRE-HACKATHON-WORK.md`: one line

## Steps

1. Read H05's decision on `docs/AGENT-BOARD.md` (R-20261109-F37-1). The name is "Echo"; if it says otherwise, stop and ask.
2. Write `mascotTypes.ts` (types and `expressionForPose`).
3. Redraw `Echo` as Juke-Bot with the new props, and `Sonny` as the helmet head with the visor (it shows `happy` unless told otherwise).
4. Move `C` to CSS variables with fallbacks; write `mascot.css`.
5. Update the comments at the top of `Mascot.tsx` and at `:61`.
6. Update the persona text in `knowledge.py` (a friendly robot guide, a program, not a person; name and rules unchanged) and its test.
7. Refresh the concept page and export its PNG again.
8. Run the checks. Add one line to `docs/PRE-HACKATHON-WORK.md` under "During the hackathon".

## Tests

- `Mascot.test.tsx`: each of the five expressions renders a distinct visor element (for example a `data-part="visor-alert"` group), and `pose` alone still picks the old look.
- `levels={[255, 0, 128, 64]}` sets four different bar heights; no `levels` gives the resting shape.
- `motion='boosting'` shows the flame elements; `motion='idle'` hides them.
- The markup stays `aria-hidden`; two `Echo`s on one page have different filter and clip ids.
- `await expectNoA11yViolations(container)`.
- The welcome, help and demo tests (`welcome.test.tsx`, `help.test.tsx`, `DemoControl.test.tsx`) pass unchanged.
- Server: the persona says "program" and "not a person"; the name test passes.

## Guardrails

- Visual only: no sound, no beep.
- New motion only under `prefers-reduced-motion: no-preference`. Nothing flashes more than 3 times a second.
- Each expression can be told apart without colour (WCAG 1.4.1); glow and alert keep 3:1 contrast (WCAG 1.4.11).
- The name, "Echo", is not changed. Nothing specific to one data set goes in `src/`.

## Done when

- Echo and Sonny render as Juke-Bot; the five expressions and four motion states work through props; the tests above pass.
- The "Do not resemble" list is ticked in the pull request, and two team members have looked at the art.
- The persona line says Echo is a program, not a person, and the server test checks it.
- The concept page and its PNG show the new art.

## Checks

```bash
npm run lint && npm test && npm run build
(cd server && .venv/bin/python -m pytest)
npx vitest run src/components/Mascot.test.tsx src/features/welcome src/features/help src/features/demo
```

## Out of scope

- Where Echo appears and what drives its props: the corner dock (JB01), scrolling (JB02), the sound (JB03), data-set colours and trails (JB04), the tour (JB05), alerts (JB06), the explorer (JB07).
- A rename. `MASCOT_NAME` stays "Echo".
- Beeps or other sound effects (they would clash with the data's sounds).
- The voice guide's behaviour (G04, G05).

## Result

Not started.
