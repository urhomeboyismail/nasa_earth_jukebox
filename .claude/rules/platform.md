# Platform: phone and desktop

The app runs on phones and desktops, and can be installed from the browser (PWA manifest and icons, T120).

- Check every layout change at 360 px (phone), 768 px (tablet) and 1280 px (desktop). No horizontal scroll at any of them.
- Flexible widths (`%`, `rem`, `min()`/`clamp()`, `flex-wrap`, grid), no fixed pixel widths.
- Touch targets at least 44 × 44 px with space between them; nothing that works only on hover.
- Body text at least 16 px, and the page works at 200% zoom. Images scale and keep their aspect ratio.
- Below 768 px the main navigation is a bar fixed to the bottom, clear of `env(safe-area-inset-bottom)`. Content and floating panels must not sit behind it.
- Say in your PR which widths you checked. Use `.claude/skills/responsive-layout/SKILL.md` for patterns and the screenshot script.
- Still to do on real devices: F12 (music pauses while the guide talks) and F15 (vibration; iOS has none).
