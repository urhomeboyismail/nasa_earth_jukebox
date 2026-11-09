# UI overhaul B: Stageshow craft and motion (T118, T119)

Written 9 Nov 2026. Two tickets that apply the **Stageshow** skill (`benjitaylor/skills`) to the real screens: the feature pages (T118) and the Home page with its animated demo (T119). The other two overhaul tickets, T116 and T117, are in [`UI-A-material-3-expressive.md`](UI-A-material-3-expressive.md). **The four are independent: any one can merge first, in any order, and none waits for another.**

Hand a ticket to your own AI like this:

> Read `AGENTS.md`, `docs/PLAN.md`, `docs/ui-overhaul/UI-B-stageshow-craft-and-motion.md` and ticket `<ID>`. Do only that ticket, on branch `feature/<ID>-short-name`, and open a PR into `main`.

## What Stageshow is, and what we take from it

`https://github.com/benjitaylor/skills.git` holds one skill, **Stageshow**: it builds faux product UI (stills and animated cursor demos) in React and CSS, with rules for craft (`references/craft.md`), motion (`references/motion.md`), framing and rehearsal (`references/rehearse.md`), and scripts that film a page into a contact sheet and report faults. It is MIT licensed. It is **not** a component library, so it does not compete with Material 3 Expressive (file A): Material is the design system, Stageshow is how we compose, animate and check the screens built with it.

We use it two ways:
1. **Its rules, on the real screens (T118):** restraint, one thing gets to be big, hierarchy from proportion and space instead of more boxes, text changes in place instead of swapping, nothing pops, every motion has a cause, UI feedback stays quick.
2. **Its kit, for one faux demo on Home (T119):** a short looping demo of the Earth Jukebox.

Get it **outside this repo** so its dependencies never enter `package.json`:

```sh
git clone https://github.com/benjitaylor/skills.git ~/stageshow-skills   # read SKILL.md and the references; its scripts run from here
cd ~/stageshow-skills/stageshow && npm install                           # playwright-core, lucide-react and the rest stay in this clone
# or, to give your AI the skill itself:  npx skills add benjitaylor/skills --skill stageshow
```

Its `scripts/film.mjs` and `scripts/layout.mjs` drive Chrome (`/usr/bin/google-chrome` is on the team laptop) against our running `npm run dev` URL and write contact sheets and fault reports to a folder **outside the repo**; do not commit recordings (the skill's own rule, and ours). Stageshow was written for React 18; this app is on React 19 and StrictMode, so anything copied from its `kit/` must be checked for double-run effects.

## The contract (same in both files; this is what keeps the four tickets independent)

Every overhaul ticket codes against **names that already exist on `main` or that are frozen here**, and every new name is read with a fallback that equals the old look. A page restyled before T116 (the design tokens) merges looks right, and looks better the moment it lands.

1. **Colour: today's names only** (`--bg --text --text-h --border --code-bg --accent --accent-strong --accent-bg --accent-border --on-accent --error --error-bg --focus --shadow`). Never reference `--md-sys-color-*` directly; for a surface step write a local alias: `--card-bg: var(--md-sys-color-surface-container, var(--code-bg));`
2. **Shape, type, motion, elevation: the frozen names with these fallbacks.**

   | Name | Fallback to write |
   |---|---|
   | `--md-sys-shape-corner-{extra-small,small,medium,large,large-increased,extra-large,extra-large-increased,extra-extra-large,full}` | 4px, 8px, 12px, 16px, 20px, 28px, 32px, 48px, 9999px |
   | `--md-sys-typescale-{display,headline,title,body,label}-{large,medium,small}` and the same plus `-emphasized` (a `font` shorthand) | `inherit` |
   | `--md-sys-motion-spring-{fast,default,slow}-{spatial,effects}` (easing) and the same plus `-duration` | `cubic-bezier(0.2, 0, 0, 1)` and `0.4s` |
   | `--md-sys-elevation-level-{0..5}` | `none` for 0, `var(--shadow)` for 1 to 5 |
   | `--md-sys-state-{hover,focus,pressed,dragged}-opacity` | 0.08, 0.10, 0.10, 0.16 |

3. **Never change:** `--control-size`, `--bottom-nav-height`, `--voice-panel-space`, the 767/768 and 1023/1024 breakpoints, every `.ui-*` class and every component prop. New component variants (`tonal`, `size`, `ButtonGroup`) are T116's: **do not use them here**; use the existing API and your own CSS.
4. **Each ticket owns different files**; the two tickets in this file touch no shared file.

## Definition of done (both tickets)

`npm run build`, `npm run lint` and `npm test` pass **with the existing tests unchanged**; new code has tests. Keyboard only works, with a visible focus ring. The layout rule in `AGENTS.md`: checked at **360, 768, 1024 and 1280 px** with the `responsive-layout` skill, no horizontal scroll, 44 px targets, nothing hover-only; **list the widths in the PR**. State the measured contrast of each text/background pair you introduce, in both themes. `package.json` unchanged. Reverts alone with `git revert`. Do not touch the sound, the analysis, the voice guide hook, the server, or any copy that a test or the voice guide's `knowledge.py` depends on.

Schedule: do these after your own Must tickets (TICKETS.md cut line, 12 Nov). **Cut order if time runs out: T119 first, then T118.**

---

## T118: The feature pages, composed and choreographed (Listen, Explore, Compare, Learn, Story, About, Ask)

**Suggested owner:** Bhavish (reviewers: Mohammad for `player`, `explore`, `compare`, `ask`; Roni for `learn`, `about`). **Due:** 12 Nov. **Priority:** Should.

**Builds on today's `main`:** the page markup and CSS as they are, the existing components, the legacy colour names, the contract. **Independent of:** T116, T117, T119.

**Files:** `src/features/{player,explore,compare,learn,about,story,ask}/*.css`, `src/describe/description.css`, and small markup changes in those folders only where a class or wrapper is needed. **No logic changes.**

*Merge note:* `src/features/player/` has uncommitted work from the T88b merge (data table, Test sound, Ask). This ticket's player part starts from whatever is on `main` when you begin; if those changes land first you rebase over them, and that is your job, not theirs.

### 1. Compose each page (Stageshow `craft.md`, "Restraint", "Spacing and alignment")
For each page, write down before coding: the one focal object, the one thing allowed to be big, and what can go. Then:
- **Listen:** the image is the focal object, large, with corners `large-increased`; the **date** is the one big number (`headline-large-emphasized`); region, credit and note drop to one quiet line. The primary button is the biggest control and the rest of the controls are visibly secondary. Settings (volume, speed, sound style, vibration) sit in one tonal group, not a stack of bordered boxes.
- **Explore, Compare:** hierarchy from space and surface (a tonal `surface-container` field with no outline), not a border on every block. Compare's two dates are two equal panels of equal weight; the answer controls are one group.
- **Learn, About, Story, Ask:** one column, line length capped at 70 ch, headings from the type scale, one accent per screen, say each thing once (no repeating a fact in a card title, a caption and the body).
- Judge each page by silhouette at thumbnail size first (Stageshow: "judge the silhouette before the details"): the focal object, support and empty space should read as one picture.
- Corners come from the scale; no new hard-coded radii or colours.

### 2. Move things the way Stageshow says (`motion.md`, "Changing text and values", "Things that appear, travel and leave", "Pace and easing")
- **Change only what changed.** When the slider or playback moves, the date, value and category text update **in place**: use `font-variant-numeric: tabular-nums` and a reserved width so nothing shifts or reflows; a changed word fades with an effects spring, it is not swapped for a new element.
- **A control that changes label changes on itself.** Play becomes Pause in the same button (label crossfade, width eased), never a second button.
- **Nothing pops.** Panels that open (data table, Ask, Explore details) open **with their content** with the spatial spring and close in the reverse; a panel is never blank for a frame. A page's sections arrive in a short stagger (40 to 80 ms apart, finished inside 400 ms); this runs once per page visit.
- **Feedback is instant.** Hover, press and focus respond at once (effects-fast); only arrivals are slower. Nothing waits on an animation to be usable.
- **The image never animates.** The frame shown must always be the frame being heard: no crossfade, slide or fade on the NASA image or the sound-map overlay. This keeps the correctness check "pausing or dragging never puts image and sound out of step" (PLAN.md §9) true. Animate only the chrome around it.
- All motion is CSS (springs via the contract's `linear()` easings with the fallback), is wrapped by the existing reduced-motion block, and starts no timers.

### 3. Rehearse (adapted from Stageshow `rehearse.md`)
With `npm run dev` running, from your Stageshow clone:

```sh
node scripts/layout.mjs "http://localhost:5173/#listen" --width 390 --strict --report ~/shots/listen-390.json
node scripts/film.mjs   "http://localhost:5173/#listen" --width 390 --every 800 --count 8 --out ~/shots/listen-390.png
```
Repeat for each page at 390 and 1280 and read every image. Fix the largest fault first (framing, then hierarchy, then motion, then polish). Put in the PR: for each page, the focal object you chose and one before/after screenshot at 390 and 1280. Faults the tool reports that are false positives for a real page (it is built for faux stages) are listed with a reason, not ignored silently.

### Acceptance
- Every existing test in `src/features/**` passes unchanged. If a class you renamed is used by a test or `explore`/`player` code, you changed too much: put it back.
- Visible at the end: each page has one obvious focal object; no horizontal scroll at 320, 360, 768, 1024, 1280 or at 200% zoom; touch targets at least 44 px; body text at least 1 rem.
- Frame/sound sync is untouched: grep shows no `transition` or `animation` on `.player__frame img` or the overlay.
- Contrast ratios are listed for new text/background pairs, both themes.
- With reduced motion on, nothing animates, and the layout is identical.

### If time runs out
Keep step 1 for Listen and Compare (the demo path); cut step 2's stagger, then the panel springs, then the other pages.

---

## T119: Home page and the animated demo

**Suggested owner:** Dhruv (Home is Roni's: she reviews). **Due:** 13 Nov. **Priority:** Could (cut first of the four).

**Builds on today's `main`:** `src/features/home/` (`index.tsx`, `home.css`, `home.test.tsx`), the `Card` component as it is. **Independent of:** T116, T117, T118.

**Files:** `src/features/home/*`, `src/features/home/stage/` (new: the small part of the Stageshow kit you need, plus `LICENSE-stageshow.md` copying the MIT notice), `home.test.tsx` (additions only).

### 1. Rebuild Home as a landing screen
Order: a one-line promise and one primary action ("Start listening", links to Listen with the current `data` param, as the steps do today), then the demo, then the three steps, then the existing "What you will try" card, then the credit and "About the data" note. **Every sentence in today's Home stays** (the tests and the voice guide's knowledge rely on them); only their placement and styling change. One big thing on the page: the headline; the demo is the picture, not another heading.

### 2. The demo (Stageshow, one faux product scene)
A 10 to 16 second loop in three to five beats, built from the kit's stage, `Act` and cursor parts, **at two widths: a 358 px compact design and a wide one** (Stageshow requires a real compact redesign, not a squeeze):
1. Opens on a finished Listen screen (a still that works on its own: image frame, the date, a timeline, a Play button).
2. The cursor presses **Play**; the timeline thumb starts to move.
3. The date steps forward; the pitch bars rise as the water warms.
4. **Payoff, held 2 s:** a caption "Warmer water, higher notes" with the dates, still on screen.
5. Reset with a cause (the thumb returns as the cursor presses Stop), never a rewind.

Content is **honest**: draw it from the app's own `synthetic-ocean` frames and label it "Example data" inside the demo; never present a made-up picture as NASA data. No stock sparkles, no made-up logos (Stageshow `craft.md`, "Icons and logos").

### 3. Accessibility (this app's audience makes these the main acceptance criteria, not extras)
- The demo is **decorative**: `aria-hidden="true"`, no focusable element inside, and the same meaning is carried by real text beside it (the steps already say it; add one sentence describing what the demo shows, readable by screen readers and visible).
- **Pause control (WCAG 2.2.2):** a real, labelled button ("Pause demo" / "Play demo", `aria-pressed`) that stops and resumes the loop. It is at least 44 px and reachable by keyboard.
- **Reduced motion:** the demo shows its **poster** (the payoff frame, step 4) and never animates; the Pause button then reads "Play demo" and plays only if the person asks.
- It starts only when it is on screen (`IntersectionObserver`), stops when the tab is hidden or it scrolls off, and **never makes a sound**.
- A visible `<noscript>`-safe fallback: if the demo fails to load, Home is complete without it.

### 4. Keep it cheap
- **No new npm package.** The kit imports `lucide-react`: replace those icons with inline SVG. Copy only the parts the scene uses; keep their MIT notice in `LICENSE-stageshow.md`.
- Load the demo with `React.lazy` so Home's first paint does not wait for it; check the result against the budgets in `docs/performance.md` and state the size added to the bundle in the PR.
- Strict-mode check: with `<StrictMode>` the loop starts once and cleans up on unmount (test it).

### 5. Rehearse
From your Stageshow clone, film the loop with the gate on: `node scripts/film.mjs "http://localhost:5173/#home" --select <the demo's selector> --gate --every 1000 --count 16 --out ~/shots/home.png`, at 358 and at 1280, and film the loop seam. Do not hand over until the gate ends `rehearsal passed`; put the verdict and one poster screenshot in the PR.

### Acceptance
- `home.test.tsx` passes unchanged; new tests: the demo container is `aria-hidden` with no focusable descendants; the Pause button toggles `aria-pressed` and stops the loop (fake timers); with `matchMedia('(prefers-reduced-motion: reduce)')` matching, the poster renders and no loop timer starts; `expectNoA11yViolations` on the whole page.
- Home works with the demo removed (delete the lazy import: nothing else breaks).
- At 360, 768, 1024 and 1280 px: no horizontal scroll; the demo scales with its container and keeps its aspect ratio; the primary action is within thumb reach on mobile and clear of the bottom bar.
- `package.json` is unchanged; `LICENSE-stageshow.md` is present.

### If time runs out
Ship step 1 alone (the Home rebuild, no demo). Then ship the demo as a **still poster** with no loop. The animated loop is the first thing cut.
