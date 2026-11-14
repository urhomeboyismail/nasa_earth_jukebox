# UI04 Jukebox stage and transport in glass, with Loop and a mixer drawer

| | |
|---|---|
| **Priority** | P0 |
| **Size** | L (more than a day) |
| **Who** | agent+👤 |
| **Needs** | UI01, JB10 |
| **Hotspots** | player |
| **Branch** | `feature/UI04-stage-transport` |

## Goal

The Listen page is a glass stage: the NASA frame in a glass frame with a mono date readout, a telemetry transport bar (Play/Pause, a date scrubber with date labels, Loop, Speed, Volume), and the mixer in a glass drawer, all wired to the controls that already exist.

## Why

- The transport exists but is plain: Play/Pause/Resume (`src/features/player/index.tsx:290`), Date (`:301`), Speed (`:321`), Volume (`:327`). There is no Loop. Draft Ticket 4 asks for one.
- The mixer exists (`SoundPrefs`, `VoiceMixer`, `src/audio/prefs.ts`); Muninn shows secondary panels in drawers (`lib/animations.ts`, `slideInDrawer`).
- JB10 changes the same file (the tour's mixer stop), so it lands first.

## Design

- **Stage:** the frame sits in a `.ui-glass` frame. The NASA image is never filtered, blurred or tinted. Above it, a `.ui-label` "NOW PLAYING" and the date in mono (Headline). The existing live region stays as it is (T93 rate).
- **Transport bar:** a `.ui-glass` bar holding:
  - Play/Pause;
  - the Date slider with the first and last date as mono labels at its ends;
  - **Loop**, a `Button` with `pressed`: when on, the last date goes back to the first instead of stopping; announced, and stored in the player's state only;
  - Speed (the existing three steps);
  - Volume.
  - Keyboard shortcuts are unchanged; add `L` for Loop only if the F41 shortcuts dialog lists it too.
- **Mixer drawer:** a "Mixer" button opens `SoundPrefs` and `VoiceMixer` in a side drawer. It uses the house `Dialog` (native `<dialog>`, focus kept inside, Esc closes) styled as glass on one side. Motion comes later (UI05); here it simply appears.
- **Speed** stays Slow/Normal/Fast, not 0.5–2× (`UI-OVERHAUL.md` §1).

## Reuse

- `usePlayer` (`src/features/player/usePlayer.ts:52`) for Loop: one option, applied where the last date ends playback.
- `Slider`, `Button`, `Dialog`, `useAnnounce`, `SoundPrefs`, `VoiceMixer`.

## Touches

- `src/features/player/index.tsx`, `usePlayer.ts`, `player.css`, `player.test.tsx` (the `player` hotspot)
- `src/features/player/Symphony.tsx` (moving the mixer into the drawer)
- The F41 shortcuts list, only if `L` is added

## Steps

1. Wrap the stage and the transport in the UI01 classes, and add the date end labels.
2. Add Loop to `usePlayer` and the button.
3. Move the mixer into a drawer opened by a "Mixer" button.

## Tests

- `player.test.tsx`:
  - Loop on: playing past the last date returns to the first and keeps playing; off: it stops as before. Both announced.
  - The Mixer button opens a dialog named "Mixer"; Esc closes it and focus returns to the button.
  - `expectNoA11yViolations` with the drawer open.
- Every existing player test passes unchanged.

## Guardrails

- The template's guardrails, and the §6.3 interaction principles. The NASA image never animates beyond its own frames.

## Done when

- Listen looks like a glass stage in both themes, Loop works, the mixer is a drawer, and the player's tests all pass.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- A 0.5–2× speed slider, a new visual canvas or video renderer, drawer motion (UI05), the server pill (UI01).

## Result

Filled in by the agent.
