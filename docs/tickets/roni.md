# Roni tickets (medium)

Accessibility, shared components, the Learn and About pages, listening testers, and integration checks.

Files you own: `src/test/a11y.ts`, `src/test/fakes.ts`, `src/components/`, `src/styles/`, `src/index.css`, `src/features/learn/`, `src/features/about/`, `src/features/home/`, `docs/a11y-audit.md`, `docs/test-protocol.md`, `docs/integration-log.md`.

---

## T40: Accessibility test helpers (M2)

**Files:** `src/test/a11y.ts`, `src/test/fakes.ts`, one example test.

**Do:**
1. Add an `expectNoA11yViolations(container)` helper built on `vitest-axe` (installed by T00).
2. Add reusable fakes for `AudioContext` and `Worker`, so others can render components that use sound or workers in tests.
3. Write an example test that renders the Home page and passes the accessibility check.
4. Add a short "How to write a test" note to `AGENTS.md`.

**Done when:** the example passes and others can copy it.

---

## T41: Shared components and styles (M2)

**Files:** `src/components/`, `src/styles/`, `src/index.css`.

**Do:**
1. Build these components:
   - `Button` (with an `aria-pressed` toggle variant)
   - `Slider` (labelled, announces its value in words)
   - `Announcer` (one shared polite live region, used through an `announce(text)` hook)
   - `Card`
   - `Notice` (info and error)
2. Remove the leftover Vite demo CSS in `index.css` (`#social`, `.counter`, `#center`, and the 1126 px fixed width).
3. Set light and dark color tokens with a contrast ratio of at least 4.5:1, controls at least 44 × 44 px, and support for `prefers-reduced-motion`.

These are optional for others to adopt: Mohammad can switch to them when ready, so nobody waits.

**Done when:** each component has a test with an accessibility check.

---

## T42: Learn the sounds page (M2)

**Files:** `src/features/learn/`.

**Do:**
1. One button per category ("Play: warm"), plus buttons for the tick and the missing-data cue, each with one line of explanation. Use `createSoundEngine` and `playCategory` from T00 (they log while still a stub, and play once the real engine lands).
2. A "Play all, coolest to warmest" button.
3. A link to Listen at the end. The first click calls `unlock()`.

**Done when:** every sound can be played by keyboard, each button says what it plays, and a test covers it using the stub engine.

---

## T43: About the data page (M3)

**Files:** `src/features/about/`.

**Do:** fill the page from the manifest, in plain language:
1. what the data is (variable, unit, dates, region)
2. source and credits, with links
3. how colors become sound (legend, sample points, median, categories and notes, with a table)
4. limits: the values are approximate, missing data is left out, and the result of Dhruv's check (T33)
5. how we used AI tools (Bhavish's T24 collects the text)

**Done when:** every number comes from the manifest, none is typed by hand, and the page works with the fixture data.

---

## T44: Accessibility audit (M3)

**Do:** audit whatever is merged on 11–12 Nov.
1. Keyboard only: check there are no traps, the focus order is sensible, and focus is always visible.
2. A full run with NVDA or VoiceOver: Learn, Listen and Compare must work without looking, each date is announced once, and buttons say what they do.
3. Check at 200% zoom and at phone width.
4. Check that no sound starts without a click or key press, and that Stop is always reachable.
5. Record problems in `docs/a11y-audit.md`, with the file and owner for each.

**Done when:** the audit is written, and every serious problem has an owner (fix the ones in your own files yourself).

---

## T45: Test protocol and recruiting testers (start now, ready by M3)

This has the longest lead time in the project.

**Files:** `docs/test-protocol.md`.

**Do:**
1. Contact local associations for blind and low-vision people, and school accessibility offices. Book slots for 14–15 Nov (remote is fine). Line up at least 5 sighted volunteers as the fallback.
2. Write the protocol:
   - the same short introduction for everyone
   - the Learn page first
   - then test mode (`#compare?test=1`), with comparisons in a fixed order
   - then two questions: "What was hard?" and "What would you change?"
   - what we record, and the consent wording
3. Run one practice session with a teammate before 12 Nov.

**Done when:** the protocol is written, at least 5 sessions are booked, and the practice run is done.

---

## T46: Integration checks (9 and 12 Nov)

**Do:** at M2 and M3, clone `main` fresh and set it up using only `AGENTS.md`.
1. Go through Learn → Listen → Compare → test mode → voice guide, with keyboard only. At M3, also do it on the live URLs.
2. Check that the app's analysis matches Dhruv's `synthetic-ocean/expected.json` for every frame.
3. Record each result as pass or fail in `docs/integration-log.md`, and turn every failure into a short ticket with an owner.

**Done when:** each milestone has an entry in the log.

---

## T47: Vibration on phones (M5, could)

**Files:** `src/features/player/vibration.ts` (agree the hook-up point with Mohammad).

**Do:** where `navigator.vibrate` exists (Android Chrome), give a short pulse at each date, longer for warmer categories. It's off by default, with a setting to turn it on, and does nothing on browsers without support.

**Done when:** it works on an Android phone and is silently skipped elsewhere.
