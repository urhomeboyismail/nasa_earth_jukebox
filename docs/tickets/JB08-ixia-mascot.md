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
- `docs/PRE-HACKATHON-WORK.md`

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

Filled in by the agent: the branch, the commits, and the real output of the checks, failures included.
