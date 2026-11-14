# UI04 Jukebox stage and transport in glass, with Loop and a mixer drawer

| | |
|---|---|
| **Priority** | P0 |
| **Size** | L (more than a day) |
| **Who** | agent+👤 |
| **Needs** | — |
| **Hotspots** | player |
| **Branch** | `feature/UI04-stage-transport` |

## Standalone

Built on the Listen page that is on `main` today (`src/features/player/`). It does not wait for any other ticket. Other tickets that edit the player (for example the tour's mixer stop) hold the `player` hotspot, so this one starts when none is in it. If the page has changed since this was written, keep the controls that exist and restyle those.

## Goal

The Listen page is a glass stage: the NASA frame in a glass frame with a mono date readout, a transport bar (Play/Pause, a date scrubber with date labels, Loop, Speed, Volume), and the mixer in a glass drawer, all wired to controls that already exist plus Loop.

## Why

- The transport exists but is plain: Play/Pause/Resume, Date, Speed, Volume (`src/features/player/index.tsx`). There is no Loop.
- The mixer exists (`SoundPrefs`, `VoiceMixer`, `src/audio/prefs.ts`). Secondary panels read better in a drawer.

## Design

- **Stage:** the frame sits in a glass frame. The NASA image is never filtered, blurred or tinted. Above it, a mono uppercase "NOW PLAYING" and the date in mono (Headline). The existing live region stays as it is.
- **Transport bar:** a glass bar holding:
  - Play/Pause;
  - the Date slider with the first and last date as mono labels at its ends;
  - **Loop**, a `Button` with `pressed`: when on, the last date goes back to the first instead of stopping; announced, kept in the player's state only;
  - Speed (the existing three steps, Slow/Normal/Fast, not 0.5 to 2×);
  - Volume.
  - Keyboard shortcuts are unchanged; add `L` for Loop only if the shortcuts dialog lists it too.
- **Mixer drawer:** a "Mixer" button opens `SoundPrefs` and `VoiceMixer` in a side drawer. It uses the house `Dialog` (native `<dialog>`, focus kept inside, Esc closes), styled as glass on one side. It simply appears; motion is a separate ticket (UI05).

Write the glass as a local class in this feature's CSS, on the existing `--md-sys-color-*` tokens: a translucent `surface-container` with `backdrop-filter: blur(24px)`, a 1 px lit top edge, and a solid `surface-container-high` with a 2 px outline under `prefers-contrast: more`, `prefers-reduced-transparency: reduce` and `@supports not (backdrop-filter: blur(1px))`. If `.ui-glass`, `.ui-pill` and `.ui-label` already exist in `src/styles/components.css` on `main` when you start, use them instead and write no local copy. Do not edit `tokens.css`, `components.css` or `index.css` (the `theme` hotspot).

## Reuse

- `usePlayer` (`src/features/player/usePlayer.ts`) for Loop: one option, applied where the last date ends playback.
- `Slider`, `Button`, `Dialog`, `useAnnounce`, `SoundPrefs`, `VoiceMixer`.

## Touches

- `src/features/player/index.tsx`, `usePlayer.ts`, `player.css`, `player.test.tsx`
- `src/features/player/Symphony.tsx` (moving the mixer into the drawer)
- The shortcuts list, only if `L` is added

## Steps

1. Wrap the stage and the transport in glass, and add the date end labels.
2. Add Loop to `usePlayer` and the button.
3. Move the mixer into a drawer opened by a "Mixer" button.

## Tests

- `player.test.tsx`: Loop on, playing past the last date returns to the first and keeps playing; off, it stops as before; both announced. The Mixer button opens a dialog named "Mixer"; Esc closes it and focus returns to the button. `expectNoA11yViolations` with the drawer open.
- Every existing player test passes unchanged.

## Guardrails

The template's guardrails, and:

- Nothing specific to one data set in `src/` (`.claude/rules/phases.md`); colours and text come from the manifest.
- No sound before a click or key press. Nothing flashes. Every sound has a text equivalent.

- The §6.3 interaction principles. The NASA image never animates beyond its own frames.

## Done when

- Listen looks like a glass stage in both themes, Loop works, the mixer is a drawer, and the player's tests all pass.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- A 0.5 to 2× speed slider, a new canvas or video renderer, drawer motion (UI05), the server pill.

## Result

Filled in by the agent.
