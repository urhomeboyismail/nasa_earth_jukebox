---
name: responsive-layout
description: Designer guide for choosing and fixing responsive layouts in the Earth Jukebox app, so every screen works on phone, tablet and desktop. Use whenever a change touches layout (CSS, markup structure, spacing, sizing, anything visible), when the layout-changed hook asks for it, or when deciding how a new page, panel, control group, list or media frame should adapt across screen sizes.
---

# Responsive layout designer

Pick the layout pattern that fits the content, apply it mobile first, then prove it at four widths. Rules here extend `AGENTS.md` → Conventions; if they disagree, `AGENTS.md` wins and this file should be fixed.

## 1. Project baseline (do not change without the team)

| Name | Width | Main navigation | Header |
|---|---|---|---|
| Mobile | below 768 px | Bar fixed to the bottom of the screen (`.app-header nav` in `src/App.css`) | Title + Voice guide button |
| Tablet | 768–1023 px | In the header, full row under the title | Title + Voice guide on row 1 |
| Desktop | 1024 px and up | In the header, one row | Title, links, Voice guide |

- Check widths: **360, 768, 1024, 1280 px**. 360 is a common small phone; 320 is the WCAG reflow floor, so nothing may break there either.
- Bottom bar height is `--bottom-nav-height` (set on `:root` under the mobile query). Anything fixed to the bottom (players, toasts, the voice guide panel) must sit above it: `bottom: calc(var(--bottom-nav-height, 0px) + 16px)`.
- Colors and shadows come from the tokens in `src/index.css` (`--bg`, `--text`, `--accent`, …). Do not hard-code new colors.
- Our 768 px switch is a project decision. Material 3's "compact" class ends at 600 dp and uses a bottom bar below that; we keep the bar up to 768 px because our five labels are long.

## 2. Choose the pattern

Work out what kind of content changed, then use the matching row. If none fits, use the most similar one and say so in the PR.

| Content | Mobile | Tablet / desktop | How |
|---|---|---|---|
| **Main navigation** (3–5 destinations) | Bottom bar, equal-width items, text labels (icon optional, never icon only) | In header | Page-level media query (already built; reuse it) |
| **Secondary actions** in a page (filters, tabs) | Horizontal row that wraps, or a segmented control | Same row, more space | `display: flex; flex-wrap: wrap; gap` |
| **Player controls** (play, stop, slider, speed, volume) | Primary control first and largest; slider full width on its own row; secondary controls wrap below | One row: controls left, slider fills the middle | Flex with `flex: 1 1 100%` on the slider at mobile; container query on the player for the one-row form |
| **Media frame** (NASA image, region outline) | Full width, natural aspect ratio | Capped width, centered, text beside or below | `width: 100%; height: auto; aspect-ratio` from the frame; `max-inline-size` on desktop |
| **Two side-by-side items** (date A vs date B) | Stacked, A above B, each full width | Two columns | `grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr))` |
| **List of cards** (visualizations, comparisons) | One column | As many columns as fit | Same `auto-fit` grid; no breakpoint needed |
| **Main content + side info** (player + description) | Stacked: main first, side info after | Sidebar (main 2fr, side 1fr) | Grid; switch with a container query on the page wrapper |
| **Floating panel** (voice guide, help) | Full-width sheet above the bottom bar, max height `calc(100dvh - var(--bottom-nav-height) - 96px)`, scrolls inside | Fixed card in a corner, ~400 px wide | Existing pattern in `src/styles/assistant.css` |
| **Dialog / consent screen** | Full screen or near full, buttons at the bottom within thumb reach | Centered card, max ~560 px | `<dialog>` or a region; focus moves into it |
| **Forms** (test-mode questions) | One column, labels above inputs, full-width inputs | One column still; cap width at ~640 px | Never put two inputs side by side on mobile |
| **Data tables** (results summary) | Stack each row as a labelled card, or keep the table in a horizontally scrolling region with a heading | Normal table | The scrolling region is the only allowed sideways scroll (WCAG reflow exception for 2D content) |
| **Long text** | Full width, 16 px+ body | Line length capped at ~70ch | `max-inline-size: 70ch` |

**Which CSS tool, in this order:**
1. **Intrinsic layout first.** `flex-wrap`, `grid` with `auto-fit` + `minmax(min(X, 100%), 1fr)`, and `clamp()` for type and spacing often need no breakpoint at all.
2. **Container queries for components** (player, compare panel, cards). They adapt to the space the component actually has, so they keep working when a component moves into a sidebar. Add `container-type: inline-size` on the component's wrapper.
3. **Media queries only for page-level changes**: where the navigation sits, the header layout, anything fixed to the viewport. Use the project widths (767/768, 1023/1024) so everything switches together.

## 3. Rules every layout must meet

- **Reflow:** no horizontal page scroll at 320–1280 px or at 200% zoom (WCAG 1.4.10). Use `%`, `rem`, `min()`, `clamp()`, `fr`; avoid fixed pixel widths on containers. Long words and URLs: `overflow-wrap: anywhere`.
- **Touch targets:** at least **44 × 44 px** with space between neighbors. WCAG 2.5.8 sets 24 × 24 as the floor; Apple's guideline is 44 pt and Material's is 48 dp, and we use 44.
- **Thumb reach:** on mobile put frequent actions in the bottom half; avoid placing the only copy of a key action in the top corners.
- **No hover-only behavior.** Everything reachable by tap and keyboard; hover can only add.
- **Viewport height:** use `dvh` (or `svh`) instead of `vh` for full-height areas, so mobile browser toolbars don't cut content off.
- **Safe areas:** anything fixed to a screen edge pads by `env(safe-area-inset-*)`. `index.html` already sets `viewport-fit=cover`, which these values need.
- **Order:** keep the DOM order the same as the reading order. If CSS `order` or grid placement moves something visually, check that keyboard Tab order still makes sense (WCAG 2.4.3).
- **Text:** body at least 16 px; never disable zoom.
- **Motion:** respect `prefers-reduced-motion`.
- **Focus:** visible focus outline on every control, and never hidden behind the bottom bar (add `scroll-padding-bottom: var(--bottom-nav-height)` on the scrolling container if needed).
- **Images:** scale to their container and keep their aspect ratio; always have `alt` text.

## 4. Procedure when called

1. **Find what changed:** which files, which components, which of the content types in §2.
2. **Pick the pattern** from §2 and the CSS tool from the list under it. Prefer reusing an existing pattern in the codebase over inventing one.
3. **Write mobile-first CSS:** base styles for mobile, then `min-width` queries or container queries for larger sizes. (The navigation query in `App.css` is the one existing `max-width` exception; don't copy it for new components.)
4. **Check against §3,** line by line.
5. **Verify visually:**
   ```bash
   npm run build
   npx vite preview --port 4174 --strictPort    # in its own terminal or as a background task
   .claude/skills/responsive-layout/scripts/screenshots.sh http://localhost:4174/ <out-dir> [hash]
   ```
   Open each PNG and look for:
   - horizontal scrolling or clipped content
   - overlap with the bottom bar
   - targets that look too small
   - awkward wrapping (for example one item alone on a row)

   A floating panel needs a click to open, so screenshots won't show it; say it still needs a check by eye.
6. **Fix and repeat** until all four widths pass.
7. **Report in the PR:** the pattern you chose and why (one line), the widths you checked, and anything you couldn't check.

## 5. Common fixes

| Symptom | Fix |
|---|---|
| Page scrolls sideways on mobile | Find the fixed-width or non-wrapping element; switch to `max-width: 100%`, `flex-wrap: wrap`, or `minmax(min(X, 100%), 1fr)` |
| Content hidden behind the bottom bar | Bottom padding `calc(var(--bottom-nav-height) + 24px)` on the scrolling area; `bottom` offset on fixed elements |
| Buttons squashed in a row | Let them wrap, or give the main one `flex: 1 1 100%` on mobile |
| Text overflows its box | `min-width: 0` on the flex child plus `overflow-wrap: anywhere` |
| Full-height panel cut off on iOS | `100dvh` instead of `100vh` |
| Tablet layout looks like a stretched phone | Add a container query so the component uses its extra width (two columns, side-by-side controls) |
| Image distorted | `height: auto` (or `aspect-ratio`) with `object-fit: contain` |

## Sources

- Window size classes and bottom bar vs rail: Jetpack Compose and Material 3 adaptive guidance, summarised at <https://dev.to/tkuenneth/about-window-size-class-libraries-5c5m> and <https://pub.dev/packages/window_size_classes>
- WCAG 2.2 target size (2.5.8) and reflow (1.4.10): <https://tabnav.com/academy/wcag/success-criterion-2.5.8>, <https://dequeuniversity.com/resources/wcag2.1/1.4.10-reflow>, <https://www.boia.org/blog/understanding-target-size-under-wcag-2.2-and-how-it-affects-people-with-disabilities>
- Bottom navigation, safe areas and `dvh`: <https://21st.dev/blog/react-mobile-navigation-components>, <https://blog.openreplay.com/es/5-mobile-web-problemas-soluciones/>
- Container queries, intrinsic grids, `clamp()`: <https://frontendbytes.9elements.com/intrinsic-vs-cq>, <https://docs.etchwp.com/responsive-development/intrinsic-responsiveness>
