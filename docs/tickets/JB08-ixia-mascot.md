# JB08 Echo wears Ixia: the 3D robot from the myt Learning Hub replaces the SVG robot

| | |
|---|---|
| **Priority** | P2 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | app, voice |
| **Branch** | `feature/JB08-ixia-mascot` |

## Goal

The guide is still Echo (the same Gemini Live voice guide, panel, dock, tips and names), but it is drawn by the 3D `<robot-companion>` robot ("Ixia") from https://learninghub.myt.mu/stories in place of the hand-drawn SVG `Echo`/`Sonny`. The team has myt's permission to reuse it; it is vendored with a credit.

## Why

- The team chose the myt Learning Hub robot as the mascot (13 Nov 2026).
- Today the robot is an inline SVG:
  - drawn in `src/components/Mascot.tsx` (`Echo`, `Sonny`);
  - rendered in `src/VoiceAssistant.tsx`, `src/features/mascot/MascotDock.tsx` and `src/features/welcome/Welcome.tsx`;
  - shown as Sonny badges in `src/App.tsx`, `src/features/help/HelpButton.tsx` and `src/features/demo/DemoControl.tsx`.
- Inspection of the live page (REA + Playwright) found the robot is one self-contained custom element. It lives in `/robot/robot-companion.js`, lazy-loads `robot-fx.js`, and takes three.js from its `three` attribute.
- Its API is:
  - methods: `say`, `face`, `gesture`, `hush` and `configure`;
  - attributes: `quiet`, `logo`, `bubble` and `look`;
  - events: `robot-ready`, and a cancelable `robot-click`.
- So it can be driven by our state without its own chat.

## Design

- `public/robot/` holds the four vendored files (`robot-companion.js`, `robot-fx.js`, `vendor/three.module.min.js`, `vendor/three.core.min.js`), byte-for-byte, with sha256 and credit in `public/robot/README.md`. three.js is served from there, never from unpkg.
- `src/features/mascot/ixia.ts` holds:
  - `loadIxia()`: injects the script once and resolves on `customElements.whenDefined`;
  - the pose and expression → face/gesture maps.
- `src/features/mascot/Ixia.tsx` renders the host element, `aria-hidden`, `quiet`, with our logo.
  - On `robot-ready` it calls `configure({ name: 'Echo', faq: [], tips: [] })`.
  - It cancels `robot-click` and calls `onActivate`.
  - It bridges `pose`, `expression` and `say` to element methods in effects (no `setState`).
- Badges become a static `<img>` of the robot's head.
- The manifest colours (JB04) still reach the robot through `--robot-accent` = `--mascot-accent`.

## Reuse

- `MascotPose`, `MascotExpression` and `expressionForPose` from `src/components/mascotTypes.ts`.
- `expressionFor.ts`, `useMascotGuide`, `accent.ts` and the dock's bubble and buttons.
- The pose mapping in `VoiceAssistant.tsx`.

## Touches

- `public/robot/**`
- `src/features/mascot/{Ixia.tsx,ixia.ts,Ixia.test.tsx,MascotDock.tsx,MascotDock.test.tsx,mascot-dock.css}`
- `src/components/{Mascot.tsx,mascotTypes.ts,Mascot.test.tsx,mascot.css}`
- `src/VoiceAssistant.tsx`, `src/VoiceAssistant.test.tsx`, `src/styles/assistant.css`
- `src/features/welcome/*`, `src/features/help/HelpButton.tsx`, `src/features/demo/DemoControl.tsx`
- `src/App.tsx`, `src/App.css`, `src/vite-env.d.ts` (or a new `src/types/robot-companion.d.ts`)
- `docs/PRE-HACKATHON-WORK.md` (after the merge)
- Removed with the SVG robot, as nothing else used them: `src/features/mascot/{useLevels,useScrollVelocity}.ts`, `src/audio/levels.ts` and their tests; `.oxlintrc.json` skips `public/robot/`

## Steps

1. Vendor the files; write the README with credit.
2. Write `ixia.ts`, `Ixia.tsx` and their test.
3. Swap Echo in the dock, the voice panel and Welcome; swap the Sonny badges for the head image.
4. Remove the dead SVG code and CSS; update the tests' selectors.
5. Run the checks and look at it in the browser.

## Tests

`Ixia.test.tsx`, with a stub custom element, checks:
- the script is injected once;
- `configure` gets `name: 'Echo'`;
- `pose` → `gesture`, and `say` → `el.say`;
- `robot-click` is cancelled and calls `onActivate`;
- axe passes.

Existing role queries in the dock, voice, App, help and welcome tests stay.

## Guardrails

- The robot is decorative (`aria-hidden`). Every state is still in text and announced through `useAnnounce`.
- Under `prefers-reduced-motion`: no gestures, and `look="none"`.
- The robot never opens its own chat; a click opens our voice guide.

## Done when

- The robot shows in place of the SVG Echo, with our logo, and opens our voice guide on click.
- It mouths the guide's spoken line.
- Nothing loads from unpkg or myt.mu.
- Checks pass.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- Renaming Echo.
- Layout pass (`platform.md`).
- JB05 and JB06 (they will drive the new robot through the same props).

## Result

Branch `feature/JB08-ixia-mascot`.

What changed:
- **The robot.** `public/robot/` holds the robot and three.js, byte for byte from the live site with their sha256 (see `README.md`). It also holds our chest logo ("echo") and a still of the head for the badges.
- **The dock.** `MascotDock` renders `Ixia.tsx` once and no longer remounts it per page (App drops `key={page}`; the bubble closes on a page change instead).
  - The robot takes the pointer: its `robot-click` opens our bubble, not its chat.
  - The dock button is the keyboard and screen-reader way in. It is out of sight until focused, then shows as a chip left of the robot. It sits outside the robot's box because the robot moves away from anything clickable under it.
  - Our bubble, the tip dot and the name label follow where the robot is drawn.
  - Esc closes the bubble wherever focus is, and is stopped there, so the robot does not also send itself away.
- **The voice guide.** While the panel is open, the same robot steps beside it (no button) and mouths the guide's spoken line a piece at a time (`spokenLine` in App, from the transcript while speaking).
- **Faces and gestures.** Echo's expressions map to the robot's faces, and its poses to gestures (`robot.ts`).
- **Badges.** Sonny (header toggle, Help, demo caption) and the Welcome robot are now `RobotBadge`, the still head.
- **Removed.** The SVG `Mascot.tsx`, `mascot.css`, the voice-panel robot CSS, and the chest-bar and booster hooks (the robot reacts to scrolling by itself).

Checks (13 Nov 2026):

```
$ npm run lint
> oxlint
(no warnings or errors)

$ npm test
 FAIL  src/data/change-regression.test.ts > change regression baseline > gives the same Score every time
   (Test timed out in 90000ms)
 Test Files  1 failed | 167 passed (168)
      Tests  1 failed | 2608 passed (2609)

$ npm run build
✓ built in 1.05s
```

The one failure fails the same way on a clean `origin/main` (a b9405fd checkout: `Tests 1 failed | 6 passed (7)` for that file, timing out at 90 s on this machine). It is a data-analysis test that this ticket does not touch.

In the browser (`vite`, Playwright headless Chromium at 1440 by 900):
- the robot renders bottom right with "echo" on its chest;
- a click on it opens our bubble, and its own chat stays closed;
- its body and corner button are out of the Tab order;
- Esc closes the bubble, and the robot stays;
- opening the voice guide moves the same element beside the panel;
- `say()` types into its bubble with the mouth moving;
- no request leaves the app's origin.

Not done here:
- **Credit line in the About page.** It is the `about` hotspot, not this ticket's. Suggested: "Echo's robot: the myt Learning Hub's robot companion, used with permission."
- **The muted-microphone case.** The voice panel's old "listening but muted is idle" pose rule is gone: the dock's pose follows the status only.
