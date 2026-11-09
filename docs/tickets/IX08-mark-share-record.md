# IX08 Mark moments, share them, record an exploration as WAV

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | S01, SN12 |
| **Hotspots** | player |
| **Branch** | `feature/IX08-mark-share-record` |

## Goal

The listener presses `M` to mark the date and place they are on, sees the marks as text, copies a link that opens that exact moment, and records what they heard as a WAV file.

## Why

- A listener who finds something has no way to keep it. Nothing in the app remembers a place.
- S01 brings the deep-link format (F40) that a shared moment needs: `hashFor(page, params)` in `src/route.ts` already takes any parameters.
- SN12 makes the offline WAV render byte-identical, so a recording is the sound that was heard, rendered from the same steps.

## Design

- **Marks (pure, `src/features/marks/marks.ts`).** A mark is `{ dataId, date, col, row, at }` (`at` is the time it was made, ISO text). `addMark` keeps the newest 50. `removeMark` by index. The list is stored under `earth-jukebox:marks` and validated with zod on read; invalid entries are dropped one by one, not the whole list.
- **Marking.** `M` (IX01 `mark`) adds the current date and cell, and plays the `mark` feedback (one bright note, from IX01's table). The list shows each mark as text ("March 2024, north-east, warm. Remove mark."), with a button to remove it. Nothing is spoken.
- **Sharing.** "Copy a link to this moment" uses S01's `momentLink` (`src/features/player/momentLink.ts`), which builds `#listen?data=…&date=…&cell=<col>,<row>` with S01's `cellParam` in `src/route.ts`. This ticket adds no parameter and no parser: S01 already opens a linked cell (silently, with the first key press or touch unlocking sound). It copies with `navigator.clipboard.writeText`. Where that is missing or refused, the link appears in a read-only text field to select and copy. The result is announced once: "Link copied."
- **Recording.** "Start recording" begins a log of every date change and cursor move, with the time since the start, using the same steps the Listen page plays. "Stop and download" builds the steps and calls SN12's offline render, then offers the WAV through a Blob URL with a `download` name built from the data set's id and the time. A recording stops by itself at 180 s (the render's limit, `src/audio/engine.ts`), and says so in the visible text.
- **Words.** The visible text is the status: "Recording: 1 minute 20 seconds." Announced at start and stop only.

## Reuse

- `src/route.ts` (`hashFor`, `parseHash`), and the deep-link parsing that S01 adds to the Listen page.
- SN12's offline render (its function name is in SN12's ticket file). The current `SoundEngine.renderToWav(steps)` (`src/audio/index.ts`) is the fallback only until SN12 is done.
- IX01: `mark`, `recordUndo` (removing a mark is undoable).
- `src/components/Button.tsx`, `useAnnounce`.

## Touches

- `src/features/marks/marks.ts`, `store.ts` (zod), `record.ts` (the log, pure), and tests next to each. No link code: S01's `momentLink.ts` and `route.ts` are used as they are.
- `src/features/marks/MarksPanel.tsx` and its test.
- `src/features/player/index.tsx`: mount the panel. `player.test.tsx`.
- `src/features/explore/useExplorer.ts`: the `mark` handler reads the current date and cursor; nothing else changes.

## Steps

1. Write the pure parts: `marks.ts` and `record.ts`, with tests.
2. Write `store.ts` with zod. Test a corrupt entry.
3. Register the `mark` handler; add the list and the buttons in `MarksPanel`.
4. Add the copy button and the fallback text field.
5. Add the recording start and stop, the 180 s limit and the download.
6. Check that a copied link opens the same date and cell (S01's test, extended by one case for a mark).

## Tests

- `marks.test.ts`: adding keeps the newest 50; removing is by index; a corrupt entry is dropped alone.
- The copied link is S01's `momentLink` for the marked date and cell (one case in `MarksPanel.test.tsx`).
- `record.test.ts`: the log becomes steps in time order; the 180 s limit stops the log and says so.
- `MarksPanel.test.tsx`: `M` adds a mark and plays the mark note (fake engine); "Copy a link" calls `clipboard.writeText` (stub it), and the fallback field shows when it is missing; "Start recording" then "Stop and download" calls the render and creates a download link (stub `URL.createObjectURL`).
- `expectNoA11yViolations` on the panel.

## Guardrails

- The same log gives the same WAV bytes (SN12's guarantee). Nothing is random in the marks or the link.
- Peak at or below −1 dBFS in the recording (the render's own limiter; checked by SN12's test).
- No sound before a key press or click. Recording starts from a button.
- Every sound has its text: the mark's note is the list entry; the recording's status is visible text.
- Changes are announced through `useAnnounce`: link copied, recording started, recording stopped.
- No data-set name in `src/`. The file name uses the data set's id, not a title.

The five principles, for this ticket:
1. The mark's note answers the key at once.
2. Sound first: marks and links are for the listener's own keeping; words are the list.
3. Every mark can be removed, and removing can be undone.
4. Mark, copy and record are buttons and keys, all through IX01.
5. Learn by doing: IX11 teaches `M` in its first minute.

## Done when

- `M` marks the moment; the mark is listed as text and survives a reload; the list keeps the newest 50.
- A copied link opens the same date and cell, on the same data set.
- A recording downloads as a WAV that matches the steps (SN12's test), and stops at 180 s.
- All tests pass and the checks are green.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- Sharing to social networks, a server, or accounts.
- Editing a mark's text.
- Recording the voice guide.

## Result

Not started.
