# JB01 Corner widget, speech bubble and `useMascotGuide()`; Echo's face follows the app

| | |
|---|---|
| **Priority** | P2 |
| **Size** | L (more than a day) |
| **Who** | agent |
| **Needs** | F58 |
| **Hotspots** | app |
| **Branch** | `feature/JB01-mascot-dock` |

## Goal

Echo (drawn as Juke-Bot by F58) sits as a compact widget docked bottom-right on every page. Clicking it opens a small panel: a glass speech bubble with a tip, **Talk to Echo** (opens the voice guide), **Show me around** (the tour, once JB05 is merged) and **Turn Echo off**. Any page section can offer Echo a tip through `useMascotGuide()`. Echo's visor follows what the app is doing (loading, playing, talking, idle), without anyone setting it by hand.

## Why

- Echo appears today only beside the open voice panel (`src/VoiceAssistant.tsx:73-77`, desktop only, `src/styles/assistant.css:140-161`), inside the help panel and on the welcome. There is no single place where the guide lives.
- Help is inline on purpose: "nothing floats over the bottom bar or the voice guide" (`src/features/help/HelpButton.tsx:1-2`). The dock must respect that: it hides while the voice panel is open, and pads by `env(safe-area-inset-*)`.
- Page tips already exist (`TIPS` in `src/features/help/tips.ts:5`) and so does the off switch (`useMascotOn` and `setMascotOn`, `src/features/help/mascotSetting.ts:21` and `:37`). Reuse both.
- The app state the face needs is already in `src/App.tsx`: `loaded` (`:57`, `:95`), `assistant.status` (`:143`), and `assistantOpen` with its toggle (`:55`, `:204-205`). The player publishes `playing` on the context bus (`src/features/player/index.tsx:138`, `subscribeContext` in `src/assistant/context.ts:23`).
- The mascot must never talk over a screen reader (`docs/CREATIVE_PROCESS.md:67`). PLAN §6.3: "sound first, words on request". So tips wait for the user.

## Design

**Files** (`src/features/mascot/`, new):

- `MascotDock.tsx`: the widget and its panel.
- `guideContext.ts`: the context object and types. `MascotGuideProvider.tsx`: the provider. `useMascotGuide.ts`: the hook. (Split so each file exports only components or only hooks.)
- `placeBubble.ts`: pure placement.
- `expressionFor.ts`: pure expression choice.
- `mascot-dock.css`.

**The hook.**

```ts
type Tip = { text: string; mood?: 'alert' }
type MascotGuide = {
  offerTip(tip: Tip): void        // queue a tip; shown and announced only when the user opens the bubble
  clearTip(): void
  pointAt(selector: string | null): void   // for JB05; JB01 only stores it
}
export function useMascotGuide(): MascotGuide   // a no-op outside the provider, like useAnnounce
```

**Compact state.** A fixed `<button type="button" aria-expanded aria-controls>` bottom-right, at least 44 px, with `<Echo>` inside (`aria-hidden`). Its name is "Echo, your guide", and "Echo, your guide, has a tip" while a tip waits; a small dot shows that too, by shape as well as colour. Hover or focus shows only a name label. It must be dismissable with Esc, stay while hovered, and stay until the pointer leaves (WCAG 1.4.13).

**Expanded state.** Click, Enter or Space opens a non-modal panel (a disclosure, like the help panel):

- the speech bubble with the queued tip, or else the page tip from `TIPS`;
- **Talk to Echo**: calls `onTalk()` from `App.tsx`, which opens the voice panel (`setAssistantOpen(true)`);
- **Show me around**: rendered only when an `onTour` prop is given (JB05 passes it);
- **Turn Echo off**: `setMascotOn(false)`, then announce how to bring Echo back (help panel).

Opening announces the bubble text once through `useAnnounce`. Esc closes the panel and returns focus to the button. Focus is never hidden behind the dock (WCAG 2.4.11).

**The bubble** (`.mascot-speech-bubble`): a glass card with the existing surface tokens, a translucent background with `backdrop-filter: blur()` and a solid fallback, the elevation token, and a tail pointing at the helmet. Text contrast is 4.5:1 or more against the solid fallback. Placement:

```ts
export function placeBubble(anchor: DOMRect, size: { w: number; h: number }, viewport: { w: number; h: number }, margin = 16):
  { x: number; y: number; side: 'above' | 'below' | 'left' | 'right' }
```

It prefers above-left of the helmet, flips when there is no room, and clamps inside the viewport with the margin. It is recomputed on open, resize and scroll (throttled to one requestAnimationFrame).

**The face.**

```ts
export function expressionFor(s: { loading: boolean; voice: AssistantStatus; playing: boolean; tipMood?: 'alert'; idleMs: number; hidden: boolean }): MascotExpression
```

The order is:
1. `alert` when the waiting tip is an alert;
2. `searching` while a data set loads or the voice guide is `connecting`;
3. `eq_active` while playing or the voice guide is `speaking`;
4. `resting` when the tab is hidden or there has been no input for 60 s;
5. otherwise `happy`.

The idle clock reads `pointerdown`, `keydown` and `scroll` (passive) and checks once every 15 s. It is the only timer.

**Mount.** In `src/App.tsx`, wrap the page in `MascotGuideProvider` (inside `AnnouncerProvider`), and lazy-load `MascotDock` after `</main>` (`:227`), next to the voice panel (`:229`). Pass `loading`, `assistant.status`, `assistantOpen` and `onTalk`. The dock renders nothing when `useMascotOn()` is false or the voice panel is open.

## Reuse

- `Echo` and the F58 types (`src/components/Mascot.tsx`, `src/components/mascotTypes.ts`).
- `TIPS` (`src/features/help/tips.ts`), `useMascotOn` and `setMascotOn` (`src/features/help/mascotSetting.ts`).
- `useAnnounce` (`src/components/useAnnounce.ts`), `subscribeContext` (`src/assistant/context.ts`).
- `Button` and `IconButton` from `src/components/`, and the design tokens in `src/styles/tokens.css`.
- The disclosure and Esc pattern of `src/features/help/HelpButton.tsx`.

## Touches

- `src/features/mascot/` (new): the files above and their tests.
- `src/App.tsx`: the provider, the lazy mount and the props.
- `docs/PRE-HACKATHON-WORK.md`: one line.

## Steps

1. Write `placeBubble.ts` and `expressionFor.ts`, with their tests first.
2. Write the context, provider and hook.
3. Write `MascotDock.tsx` and `mascot-dock.css`.
4. Mount it in `App.tsx`.
5. Run the checks and fill in Result.

## Tests

- `placeBubble.test.ts`: room above → above; no room above → below; near the right edge → clamped inside; a viewport smaller than the bubble → pinned at the margin.
- `expressionFor.test.ts`: one case per rule, plus the order (an alert beats playing; loading beats playing).
- `MascotDock.test.tsx`:
  - the button is found by role and name;
  - clicking opens the panel, the bubble text is announced, and Esc closes it and refocuses the button;
  - `offerTip` changes the button's name to "…has a tip" but announces nothing until it is opened;
  - "Talk to Echo" calls `onTalk`;
  - "Turn Echo off" hides the dock;
  - nothing renders while the voice panel is open;
  - `await expectNoA11yViolations(container)` open and closed.
- `src/App.test.tsx` keeps passing.

## Guardrails

- No sound and no speech of its own. Tips are announced only when the user opens the bubble, through `useAnnounce`, never over a screen reader.
- Echo stays `aria-hidden`; the button and panel carry the names.
- Motion only under `prefers-reduced-motion: no-preference`; nothing flashes. Touch targets 44 px or more.
- Nothing specific to one data set goes in `src/`. Don't check or rework the layout at different widths (`.claude/rules/platform.md`).

## Done when

- The dock shows on every page, opens and closes by mouse and keyboard, shows the right tip, and opens the voice guide.
- Pages can offer tips through `useMascotGuide()`, and Echo's face follows loading, playing, talking and idle.
- The checks pass.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- Scroll boosters (JB02), the chest EQ (JB03), data-set colours (JB04), the tour (JB05), alerts from data (JB06), the explorer link (JB07).
- Changing the voice panel or its hook (the `voice` hotspot).
- Writing tips for specific data sets (that is manifest work).

## Result

Not started.
