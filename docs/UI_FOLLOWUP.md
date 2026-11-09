# UI overhaul: follow-up inventory

A list of every UI element in the app as of commit `89c73b3` (5 Nov 2026), with its current state and what needs work. It is the starting point for a UI overhaul session. Read `AGENTS.md` (layout rules), `docs/PLAN.md` (features, owners) and `.claude/skills/responsive-layout/SKILL.md` before changing anything.

## How to use this file

- Section 1 covers the whole app (tokens, base styles, template leftovers). Sections 2 to 5 go element by element. Section 6 lists UI that the plan requires but that doesn't exist yet.
- Each element has **Where**, **Now** (what it is today) and **To do** (problems found and overhaul tasks). Items marked **[rule]** break a rule in `AGENTS.md`, so fix them first.
- Folder owners are set in `docs/PLAN.md` §4. Mohammad owns `App.tsx`, `pages.ts`, player, compare and the voice guide. Roni owns `index.css`, `src/styles/`, `src/components/`, and the home, learn and about pages. Check with the owner before editing their folder.
- Check every change at 360, 768 and 1280 px (plus 1024 px, which is a breakpoint in `index.css`) and at 200% zoom, in both light and dark colour schemes.

### Files that make up the UI

| File | Contains |
|---|---|
| [index.html](../index.html) | Document shell, viewport meta, favicon link, title |
| [src/main.tsx](../src/main.tsx) | Mounts `<App>` and imports `index.css` |
| [src/index.css](../src/index.css) | Design tokens, `#root` frame, base type (h1, h2, p, code) |
| [src/App.tsx](../src/App.tsx) | Header, main navigation, voice guide toggle, page heading, load error, page switch |
| [src/App.css](../src/App.css) | Header, nav and main styles, including the tablet and mobile bottom bar |
| [src/pages.ts](../src/pages.ts) | Page ids and titles (mirrored in `server/app/assistant/knowledge.py`; a server test fails if they drift) |
| [src/VoiceAssistant.tsx](../src/VoiceAssistant.tsx) | Voice guide panel |
| [src/styles/assistant.css](../src/styles/assistant.css) | Voice guide panel styles |
| [src/features/home/index.tsx](../src/features/home/index.tsx) | Home page (placeholder) |
| [src/features/learn/index.tsx](../src/features/learn/index.tsx) | Learn the sounds page (placeholder) |
| [src/features/player/index.tsx](../src/features/player/index.tsx) | Listen page (placeholder) |
| [src/features/compare/index.tsx](../src/features/compare/index.tsx) | Compare two dates page (placeholder) |
| [src/features/about/index.tsx](../src/features/about/index.tsx) | About the data page (placeholder) |
| [public/favicon.svg](../public/favicon.svg), [public/icons.svg](../public/icons.svg) | Favicon and an icon sprite, both left over from the Vite template |

There is no `src/components/` folder yet, even though `docs/PLAN.md` gives it to Roni for shared UI.

---

## 1. Global: tokens, base styles, frame

### 1.1 Design tokens
- **Where:** [src/index.css:1-51](../src/index.css#L1-L51)
- **Now:** These are the Vite starter tokens: purple accent `#aa3bff` (dark mode `#c084fc`), grey text, system font, 18 px root font (16 px at 1024 px and below). Light and dark mode follow `prefers-color-scheme`.
- **To do:**
  - Choose the project's own palette and type scale. Nothing here is designed for this project; it all came from the template.
  - **[rule]** Contrast: `#aa3bff` on white is about 4.4:1. That fails WCAG AA for normal text, and it is used as text colour for the current nav item and as background for white text (the pressed guide toggle, "Start talking"). Re-pick the accent, or keep it off small text.
  - Hard-coded colours that ignore dark mode: error red `#b3261e` (assistant.css:13, unreadable on the dark background), warning `#fff4e5`/`#4d2c00`/`#f0b35a` (assistant.css:29), error orb `#f9dedc`/`#410e0b` (assistant.css:23). Turn them into `--error`, `--warning-*` tokens with dark variants.
  - Add spacing, radius and font-size tokens. Values like 4, 8, 12, 14, 16 and 24 px and radii of 12, 16, 24 and 999 px are typed by hand in every file right now.
  - Add a focus-ring token. The `2px solid var(--accent)` outline is repeated in App.css and assistant.css.

### 1.2 Template leftovers to delete
- **Where:** `--social-bg` (index.css:10, :43), `#social .button-icon` (index.css:48-50), `.counter` (index.css:99), `code` styling (index.css:98-111, unused at the moment), [public/icons.svg](../public/icons.svg) (Bluesky, Discord, GitHub and X icons, not used anywhere), [public/favicon.svg](../public/favicon.svg) (the Vite logo).
- **To do:** Remove the unused rules and the sprite. Replace the favicon with an Earth Jukebox icon, and add `apple-touch-icon`, `theme-color` and a meta description to [index.html](../index.html).

### 1.3 Page frame (`#root`)
- **Where:** [src/index.css:53-63](../src/index.css#L53-L63)
- **Now:** Fixed `width: 1126px` with `max-width: 100%`, a left and right border, and **`text-align: center` on everything**. The voice guide and header override it with `text-align: left`.
- **To do:** Use `width: min(100%, <max>)` or a content-width token. Drop the global centring, since centred body text is hard to read and the plan's pages will be long. Decide whether the side borders stay.

### 1.4 Base typography
- **Where:** [src/index.css:69-96](../src/index.css#L69-L96)
- **Now:** h1 is 56 px (36 px at 1024 px and below) with negative letter spacing. h2 is 24/20 px. `p` margins are reset to 0, so paragraphs run together with no gap.
- **To do:** Build a fluid type scale with `clamp()`. Restore paragraph spacing, or add a flow/stack utility. Add h3 and list styles for the Learn and About pages.

### 1.5 Utility: `.sr-only`
- **Where:** [src/App.css:1-11](../src/App.css#L1-L11)
- **Now:** Lives in App.css but is used by the voice guide too.
- **To do:** Move it to shared styles (`index.css` or `src/styles/`).

### 1.6 Missing global pieces
- No **skip link** to `<main>`.
- No **footer**: NASA EIC credit, licence, AI disclosure link and team credits have nowhere to go.
- No **loading state** while the catalog loads (see 3.3).
- No **routing**: pages are a `useState` in `App.tsx`. Refreshing always goes back to Home, the browser Back button leaves the app, and you can't link to one page. Hash routing would be enough. Tell Mohammad, because the voice guide's `navigate` action calls `setPage`.
- No `prefers-reduced-motion` handling outside the voice guide orb. Planned animations (player progress, reveal) will need it too.

---

## 2. Header

### 2.1 Header bar
- **Where:** [src/App.tsx:65-82](../src/App.tsx#L65-L82), [src/App.css:13-21](../src/App.css#L13-L21)
- **Now:** A flex row that wraps: app name, nav, guide toggle. Padding is 16/24 px (12/16 px on mobile). A bottom border. On tablet (768 to 1023 px) the nav moves to its own full row ([App.css:82-87](../src/App.css#L82-L87)).
- **To do:** Visual redesign (logo or wordmark, background, maybe sticky on desktop). Keep the tablet two-row behaviour or replace it with something better, and check 1024 px, where it switches back to one row.

### 2.2 App name / wordmark
- **Where:** [src/App.tsx:66](../src/App.tsx#L66), [src/App.css:23-26](../src/App.css#L23-L26)
- **Now:** A plain `<p>Earth Jukebox</p>`. It isn't a link and has no logo.
- **To do:** Make it a link or button to Home, add a logo mark, and size it as a brand element.

### 2.3 Main navigation (desktop and tablet)
- **Where:** [src/App.tsx:67-77](../src/App.tsx#L67-L77), [src/App.css:28-61](../src/App.css#L28-L61). Items come from [src/pages.ts](../src/pages.ts): Home, Learn the sounds, Listen, Compare two dates, About the data.
- **Now:** `<nav aria-label="Main">` holding a list of `<button>`s, which are pill shaped. The current page has `aria-current="page"`, accent text and a tinted background. Hovering shows an accent border.
- **To do:**
  - **[rule]** `min-height: 40px` (App.css:41) is under the 44 px touch target. Raise it to 44 px or more.
  - Contrast of the current item (accent on a tinted accent background) is below AA; see 1.1.
  - If routing is added (1.6), these become links (`<a href>`) and keep `aria-current`.
  - Decide on icons. Mobile needs them (2.4), and desktop could use them too.
  - Page titles change in two places: `src/pages.ts` and `server/app/assistant/knowledge.py`.

### 2.4 Mobile bottom navigation bar
- **Where:** [src/App.css:89-132](../src/App.css#L89-L132) (below 768 px)
- **Now:** The same `<nav>`, fixed to the bottom. Five equal columns, each 64 px tall. Labels are text only, at **13 px**, wrapping with `overflow-wrap: anywhere`. `--bottom-nav-height = 64px + env(safe-area-inset-bottom)`. `.app-main` gets bottom padding to match.
- **To do:**
  - Add icons above short labels (for example Home, Learn, Listen, Compare, About). At 360 px, "Compare two dates" and "Learn the sounds" break mid-word with `anywhere`. Either use short labels on mobile (and keep `pages.ts` titles in sync, or add a separate `shortTitle`) or use `overflow-wrap: break-word`.
  - **[rule]** Labels at 13 px are below the 16 px body size. Check readability at 200% zoom, where five columns get very narrow.
  - The current item only shows the tint and accent colour. Add a second cue that doesn't rely on colour, such as an indicator bar or a bold or filled icon.
  - Keep the safe-area padding, and keep `--bottom-nav-height` as the single source of truth (the voice guide uses it).

### 2.5 Voice guide toggle button
- **Where:** [src/App.tsx:78-81](../src/App.tsx#L78-L81), [src/App.css:37-71](../src/App.css#L37-L71)
- **Now:** A pill button labelled "Voice guide", with `aria-pressed`. Off, it has a tinted background. On, it's filled with the accent. `margin-left: auto` pushes it right. On mobile it stays in the header at the top right.
- **To do:**
  - **[rule]** `min-height: 40px`; make it 44 px or more.
  - Contrast when pressed (white on `#aa3bff`); see 1.1.
  - Add a mic icon. Consider a live-status dot while a conversation is running and the panel is closed (closing it currently ends the session, so decide whether that should stay).
  - Focus goes to the panel title on open, but **doesn't come back to this button on close** (`closeAssistant` in App.tsx:55-58). Return focus to it.
  - On mobile, the top-right corner is out of thumb reach. Consider a floating button above the bottom bar instead.

---

## 3. Main area (shared by every page)

### 3.1 Main container
- **Where:** [src/App.tsx:84-88](../src/App.tsx#L84-L88), [src/App.css:73-79](../src/App.css#L73-L79), mobile padding at [App.css:129-131](../src/App.css#L129-L131)
- **Now:** Padding of 32/24 px. Mobile adds bottom padding to clear the nav bar. Nothing reserves space for the voice guide panel when it's open on desktop.
- **To do:** Set a readable content width (about 70ch for prose; wider for the player and compare). Decide whether the open panel should push content (a side column on desktop at 1280 px) or float over it as now.

### 3.2 Page heading (`h1`)
- **Where:** [src/App.tsx:85](../src/App.tsx#L85)
- **Now:** Shows the page title from `pages.ts`, with `tabIndex={-1}`. It gets focus on page change (not on first load), and its outline is removed (App.css:76-78).
- **To do:** Keep the focus behaviour (it's an accessibility requirement). Restyle it with the new type scale. Consider a subtitle or intro slot under it, since every page currently starts with a single `<p>`. `document.title` doesn't change with the page; update it too.

### 3.3 Data load error and loading state
- **Where:** [src/App.tsx:86](../src/App.tsx#L86)
- **Now:** If the catalog fails to load, an unstyled `<p role="alert">` appears: "The data could not be loaded. …". There is **no loading indicator**: while loading, each page shows only its intro line.
- **To do:** Build a shared alert/banner component (error, warning, info) with a "Try again" button, and a loading state (skeleton or status text with `role="status"`). Reuse the same component in the voice guide (4.4).

---

## 4. Voice guide panel

Component: [src/VoiceAssistant.tsx](../src/VoiceAssistant.tsx). Styles: [src/styles/assistant.css](../src/styles/assistant.css). States come from `AssistantStatus` in [src/hooks/useVoiceAssistant.ts:14](../src/hooks/useVoiceAssistant.ts#L14): `idle | connecting | listening | speaking | ended | error`. Check every element in every state.

### 4.1 Panel container
- **Where:** [VoiceAssistant.tsx:44](../src/VoiceAssistant.tsx#L44), [assistant.css:2-8](../src/styles/assistant.css#L2-L8), mobile at [assistant.css:64-70](../src/styles/assistant.css#L64-L70)
- **Now:** A non-modal floating card, `role="region"`, labelled by its title. Fixed at the bottom right, `min(400px, 100vw - 32px)` wide, `min(560px, 100vh - 120px)` tall. On mobile it's full width minus 16 px margins and sits above the bottom bar (`100dvh`). It is rendered only while open.
- **To do:**
  - **Escape doesn't close it.** Add that, and return focus to the toggle (2.5).
  - Desktop `max-height` uses `100vh` while mobile uses `100dvh`. Use `dvh` everywhere (with `vh` as a fallback).
  - It covers page content on desktop. Decide between a docked side panel and the floating card (see 3.1). On a 360 px phone it covers almost the whole screen; consider a bottom sheet with a drag handle or collapse.
  - Add an open/close transition, respecting reduced motion.

### 4.2 Header: status orb
- **Where:** [VoiceAssistant.tsx:46-47](../src/VoiceAssistant.tsx#L46-L47), [assistant.css:17-25](../src/styles/assistant.css#L17-L25)
- **Now:** A 44 px circle with a mic icon (a speaker icon while speaking). Its colour changes per state, it pulses while listening or speaking, and while listening an inline `box-shadow` grows with mic `level`. The muted state stops the pulse. It's `aria-hidden`. The pulse is turned off under reduced motion.
- **To do:** Redesign it as the panel's centrepiece. Show the muted state with a mic-off icon (there's no `mic_off` icon in the `icons` map yet). Give the level meter its own element instead of an inline style. The error colours are hard-coded (1.1).

### 4.3 Header: title, status line, close button
- **Where:** [VoiceAssistant.tsx:48-52](../src/VoiceAssistant.tsx#L48-L52), [assistant.css:9-13](../src/styles/assistant.css#L9-L13), [:48-52](../src/styles/assistant.css#L48-L52)
- **Now:**
  - Title `h2` "Voice guide", 18 px, gets focus when the panel opens.
  - Status `<p role="status">`, 15 px, with text per state (`statusText`, VoiceAssistant.tsx:30-37). In the error state it uses class `is-error` (red, hard-coded).
  - Close: a 44 × 44 icon button with `aria-label="Close voice guide"`. It has no `type="button"`; that's harmless because it's outside the form, but add it for consistency.
- **To do:** **[rule]** Status text at 15 px is below 16 px. Fix the error colour for dark mode. Give the close button a visible hover and focus background, not only a border.

### 4.4 Microphone-silent warning
- **Where:** [VoiceAssistant.tsx:55-56](../src/VoiceAssistant.tsx#L55-L56), [assistant.css:27-30](../src/styles/assistant.css#L27-L30)
- **Now:** A `<p role="alert">` banner shown when listening, not muted, and no input is detected. Amber, hard-coded light colours, 15 px.
- **To do:** Replace it with the shared alert component (3.3) using the warning variant, with dark-mode colours and 16 px text.

### 4.5 Conversation log
- **Where:** [VoiceAssistant.tsx:58-63](../src/VoiceAssistant.tsx#L58-L63), [assistant.css:32-39](../src/styles/assistant.css#L32-L39)
- **Now:** An `<ol aria-label="Conversation">` that scrolls and auto-scrolls to the bottom on each new entry. Before the first entry it shows a hint `<li>` (15 px). User bubbles are on the right with an accent tint; guide bubbles are on the left with `--code-bg`. Each bubble starts with hidden "You said:" or "Guide said:" text for screen readers.
- **To do:** **[rule]** The hint at 15 px is below 16 px. Consider suggestion chips that send a sample question, such as "What do the sounds mean?". Check bubble contrast in dark mode. The log isn't a live region, which is fine because the guide speaks, but confirm that with a screen reader.

### 4.6 Type-a-question form
- **Where:** [VoiceAssistant.tsx:65-70](../src/VoiceAssistant.tsx#L65-L70), [assistant.css:41-46](../src/styles/assistant.css#L41-L46)
- **Now:** An input labelled with hidden text "Type a question instead"; its placeholder repeats the label. 44 px tall, pill shaped, max length 500. Disabled unless a session is active. Send is a 44 × 44 icon button with `aria-label="Send"`, disabled when the input is empty.
- **To do:** While idle, the input is disabled with no explanation. Either let typing start a session or show "Start talking to type a question". Disabled opacity (0.6 and 0.5) may fail contrast; use a proper disabled style. Give the send button a filled style when it's enabled.

### 4.7 Action buttons
- **Where:** [VoiceAssistant.tsx:72-81](../src/VoiceAssistant.tsx#L72-L81), [assistant.css:48-60](../src/styles/assistant.css#L48-L60)
- **Now:**
  - Idle, ended or error: **"Start talking"** (filled, mic icon).
  - Active: **"Turn microphone on/off"** (tinted, `aria-pressed={micMuted}`, disabled while connecting) and **"End conversation"** (text style, stop icon).
- **To do:**
  - **[rule]** `.voice-assistant__btn` has `min-height: 40px` (assistant.css:53); raise it to 44 px or more.
  - The mute button uses `aria-pressed` and also changes its label, so screen readers announce something like "Turn microphone on, pressed". Use a fixed label ("Mute microphone") with `aria-pressed`, or a changing label without it. Switch the icon to mic-off when muted.
  - Contrast of "Start talking" (white on accent); see 1.1.
  - In the error state, the button says "Start talking". "Try again" would be clearer.

### 4.8 Privacy note
- **Where:** [VoiceAssistant.tsx:83](../src/VoiceAssistant.tsx#L83), [assistant.css:61](../src/styles/assistant.css#L61)
- **Now:** A 13 px paragraph saying that voice and text go to Google Gemini and that nothing is saved.
- **To do:** **[rule]** 13 px is below 16 px. This is consent-relevant, so keep it prominent. Consider showing it before the first "Start talking" and linking to the About page's AI section.

### 4.9 Icons
- **Where:** [VoiceAssistant.tsx:7-18](../src/VoiceAssistant.tsx#L7-L18)
- **Now:** Inline Material Symbols paths (mic, volume, close, send, stop) and a local `Icon` component.
- **To do:** Move `Icon` and the icon set to `src/components/` so the nav, player and compare can share them. Add mic_off, play, pause, replay, skip next/previous, home, school/learn, headphones/listen, compare and info.

---

## 5. Pages (all placeholders from T00)

Every page receives `{ visualization: Visualization | null }` ([src/features/types.ts](../src/features/types.ts)) and renders only one or two `<p>` lines today. Each needs a full design. The planned content is in section 6.

| Page | File | Owner | What's there now |
|---|---|---|---|
| Home | [src/features/home/index.tsx](../src/features/home/index.tsx) | Roni | Tagline, plus "Now playing from: {title}. {summary}" |
| Learn the sounds | [src/features/learn/index.tsx](../src/features/learn/index.tsx) | Roni (T42) | Intro, plus a comma-separated list of category labels |
| Listen | [src/features/player/index.tsx](../src/features/player/index.tsx) | Mohammad (T11) | Intro, plus "{n} dates from {first} to {last}" |
| Compare two dates | [src/features/compare/index.tsx](../src/features/compare/index.tsx) | Mohammad (T12, T13) | Intro, plus "{n} ready-made comparisons" |
| About the data | [src/features/about/index.tsx](../src/features/about/index.tsx) | Roni (T43) | Intro, plus "Source: {name}. Credit: {credit}." |

**Home to do:** Hero section (tagline, short explanation, call-to-action buttons to "Learn the sounds" and "Listen"), preview of the current visualization (thumbnail frame, title, summary), and a note on how to use it with a screen reader or voice guide.

---

## 6. Planned UI that doesn't exist yet

From `docs/PLAN.md` §5 and §6. Each line needs designing and building. Every interactive control must be 44 px or more, usable by keyboard, labelled for screen readers, and must not depend on hover.

### 6.1 Shared components (`src/components/`, Roni, F9)
- Button (primary, secondary, text, icon-only), with focus, hover, active and disabled states
- Alert/banner (info, warning, error) with an optional action (see 3.3, 4.4)
- Loading/status indicator
- Card (for comparisons, visualization picker, Learn categories)
- Slider (date scrubber, speed, volume)
- Radio group / segmented control (compare answer, test-mode questions)
- Icon component and set (4.9)
- Visually hidden live-region announcer (player announcements)

### 6.2 Frame viewer (F2, Mohammad), used on Listen and Compare
- Frame image, scaled to fit while keeping its aspect ratio, with `alt` from `frame.altText`
- Date label for the current frame
- Region outline drawn over the image (`regions[].points`, fractions from 0 to 1), with its name and description
- Region picker if there's more than one region
- Credit line (`source.credit`, licence) under the frame
- Optional `frame.note`

### 6.3 Player controls on Listen (F5, Mohammad)
- Sound unlock: the first play must come from a click or key press (`SoundEngine.unlock()`)
- Play / Pause (one toggle), Stop, Replay
- Previous / Next date (these match the voice commands in `src/features/player/controls.ts`)
- Date slider / scrubber across `frames`, with the current date as its value text
- Speed control
- Volume control (`setVolume`)
- Now-playing readout: date, category label, "insufficient data" state
- Screen-reader announcements for each step (live region)
- Export a sequence as WAV button (F14, should-have)
- Vibration toggle on supporting phones (F15, could-have)
- Visualization picker if there's a second dataset (F16, could-have; `App.tsx` always loads `catalog[0]` for now)
- Publishes `player` context for the voice guide (F10), with no visible UI

### 6.4 Compare two dates (F7, Mohammad)
- List of ready-made comparisons (`visualization.comparisons`) as cards, or a picker
- Date A / Date B pickers (custom pairs)
- "Listen to A" and "Listen to B" buttons, plus a frame viewer for each (hideable for blind-listening tests)
- Question text (`comparison.question`)
- Answer choice: A / B / Same (radio group)
- Reveal button, then correct/incorrect feedback and `explanation`
- "Next comparison" button
- Publishes `compare` context (F10)

### 6.5 Listening-test mode (F11, Mohammad for the UI, team leader for the API)
- Consent screen and checkbox (it must be ticked to start)
- Participant type: sighted / blind or low vision / prefer not to say
- "Using a screen reader?" and "Could you see the images?" questions
- A run of comparisons with response timing
- Confidence rating 1 to 5 and an optional comment per answer
- Finish screen and results summary
- How to enter and leave test mode (route, toggle or link) isn't decided yet

### 6.6 Learn the sounds (F6, Roni)
- One item per `mapping.categories` (coolest to warmest): label, note, a "Play this sound" button, maybe a colour swatch from `colorScale`
- Sample buttons for the tick sound and the missing-data cue
- Short explanation of how colour becomes pitch, plus a link to Listen

### 6.7 About the data (F8, Roni)
- Source block: name, link (`source.url`), credit, licence, retrieved-on date
- Method: how frames are sampled, `median` summary, `minValidFraction`, no-data handling
- Limits section
- AI-tool use disclosure (including the voice guide's Gemini use, linked from 4.8)
- Team credits

---

## 7. Suggested order

1. Tokens and template clean-up (1.1, 1.2, 1.3, 1.4): this unblocks everything else.
2. **[rule]** fixes: 44 px targets (2.3, 2.5, 4.7) and 16 px text (2.4, 4.3, 4.4, 4.5, 4.8).
3. Shared components (6.1), starting with Button, Alert and Icon, then refactor the header and voice guide to use them.
4. Header and nav redesign, including mobile icons (section 2), then decide on routing.
5. Voice guide polish (section 4: Escape, focus return, mute semantics, dark-mode colours).
6. Page layouts: Home, Learn, About (Roni); then the frame viewer, player and compare (Mohammad); then test mode.

After each step, run `npm run lint`, `npm test` and `npm run build`, and take screenshots with `.claude/skills/responsive-layout/scripts/screenshots.sh`.
