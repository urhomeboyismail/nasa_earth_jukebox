# I01 One announcer for the whole app

| | |
|---|---|
| **Priority** | P0 |
| **Size** | S (under half a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | app, player, compare, learn |
| **Branch** | `fix/I01-app-announcer` |

## Goal

One `AnnouncerProvider` wraps the whole app. Every `useAnnounce()` call reaches the live region on every page, and also from the help button and the welcome on Home.

## Why

- `useAnnounce` silently does nothing outside a provider. The default context value is `() => {}` (`src/components/announcerContext.ts:5`). Any announcement made outside a provider is dropped.
- Providers exist only in Listen (`src/features/player/index.tsx:42`) and Compare (`src/features/compare/index.tsx:39`).
- Outside those two pages, nothing is announced:
  - the help button (`src/features/help/HelpButton.tsx:35` and `:42`) is rendered by `src/App.tsx:217`, above the pages;
  - the welcome (`src/features/welcome/Welcome.tsx:61`, `:78`, `:88` and `:116`) is shown on Home (`src/features/home/index.tsx:30`).
- Learn has its own `role="status"` paragraph (`src/features/learn/index.tsx:251`) instead of `useAnnounce`.
- `src/features/welcome/Welcome.tsx:165` has a second `role="status"` for the message that is announced at `:116`.
- `src/components/Announcer.tsx:4` already says "Put it once, near the root". The code does not do it.

## Reuse

- `AnnouncerProvider` in `src/components/Announcer.tsx`, and `useAnnounce` in `src/components/useAnnounce.ts`.
- `expectNoA11yViolations` from `src/test/a11y.ts`.
- The fetch stub pattern in `src/App.test.tsx`.

## Touches

- `src/App.tsx`: wrap the returned fragment (lines 167 to 230) in `AnnouncerProvider`. Review: Mohammad.
- `src/features/player/index.tsx`: remove the wrapper at line 42, keep its child. Review: Mohammad.
- `src/features/compare/index.tsx`: remove the wrapper at line 39, keep its child. Review: Mohammad.
- `src/features/learn/index.tsx`: replace the paragraph at line 251 with `useAnnounce`. Review: Roni.
- `src/features/welcome/Welcome.tsx`: remove the `role="status"` at line 165. Keep the visible text. Review: Roni.
- `src/App.test.tsx`: the new tests.

## Steps

1. In `src/App.tsx`, import `AnnouncerProvider` from `./components` and wrap the whole fragment (lines 167 to 230) in it, so the live region sits inside the app's root.
2. In `src/features/player/index.tsx` and `src/features/compare/index.tsx`, remove the `AnnouncerProvider` wrapper and keep the children. Check that the default export still returns one element.
3. In `src/features/learn/index.tsx`, remove the `<p role="status" className="sr-only">` at line 251. Find the function that sets `lastPlayed` (`grep -n setLastPlayed`), and call `announce(...)` with the same text in that event handler. Do not call it from an effect (`.claude/rules/frontend.md`).
4. In `src/features/welcome/Welcome.tsx`, remove `role="status"` from the paragraph at line 165. The announcement is already made at line 116.
5. Check the result: `grep -rn "AnnouncerProvider" src` should show the definition, `App.tsx`, and the tests. `grep -rn 'role="status"' src --include="*.tsx"` should list only the loading line in `App.tsx`, the live region itself, and the voice guide (left for V03). Put the list in the Result.
6. Add the tests below, run them on `main` first so that they fail, and paste the failure into the Result.
7. Add one line to `docs/PRE-HACKATHON-WORK.md` under "During the hackathon".

## Tests

Add to `src/App.test.tsx`. Clear `localStorage` in `afterEach`. Read the live region by its role and text, not by class.

- **Help button reaches the live region.** Render `App` at Home. Click the button named "Help from Echo". Click "Turn Echo off". Expect `screen.getByText('Echo is off.', { selector: '[role="status"]' })` to be in the document.
- **Welcome reaches the live region.** With empty `localStorage`, Home shows the welcome. Find the button "Skip the welcome" (`findByRole`), click it, and expect "Welcome skipped." inside a `role="status"` element.
- **Accessibility.** After rendering Home with the welcome shown, `await expectNoA11yViolations(container)`.

## Guardrails

Not applicable: no sound or visual change. Every announcement still goes through `useAnnounce`, and nothing is spoken by any other route.

## Done when

- Both new tests fail on `main` and pass on the branch. Their output is in the Result.
- `grep -rn "AnnouncerProvider" src` shows one use, in `src/App.tsx`.
- Learn and Welcome no longer carry their own status messages for announcements.
- Mohammad has reviewed `App.tsx`, Listen and Compare. Roni has reviewed Learn and Welcome.
- `npm run lint && npm test && npm run build` pass.

## Checks

```bash
npm run lint && npm test && npm run build
npx vitest run src/App.test.tsx src/features/welcome src/features/help src/features/learn
```

## Out of scope

- The announcement rate (S04).
- The voice guide's status message (V03, V01).
- The Ask panel, which already uses `useAnnounce` inside its own page.

## Result

Not started.
