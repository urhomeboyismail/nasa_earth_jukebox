# Platform: desktop now, phone later

The app will run on phones as well as desktops, but the phone pass waits until the workflow is final (ticket T120 in `docs/TICKETS.md`).

**Now (building and refining):**
- Design and check for desktop at 1280 px. Also check 768 px for anything whose width matters.
- Don't build anything that will block the phone later:
  - flexible widths (`%`, `rem`, `min()`/`clamp()`, `flex-wrap`, grid), no fixed pixel widths;
  - touch targets at least 44 × 44 px;
  - nothing that works only on hover;
  - body text at least 16 px, and the page works at 200% zoom;
  - images keep their aspect ratio.
- Say in your PR which widths you checked.

**Later (T120, finalising):** the full phone pass at 360 px:
- the main navigation in a bottom bar below 768 px, clear of the home indicator (`env(safe-area-inset-bottom)`);
- F12 ducking and F15 vibration checked on a real phone;
- a PWA manifest so the app can be added to the home screen (ADR 0001).

Use `.claude/skills/responsive-layout/SKILL.md` for both phases.
