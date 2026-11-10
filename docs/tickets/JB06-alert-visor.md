# JB06 Alert visor on notable data events

| | |
|---|---|
| **Priority** | P2 |
| **Size** | S (under half a day) |
| **Who** | agent |
| **Needs** | JB01, SN10 |
| **Hotspots** | player |
| **Branch** | `feature/JB06-alert-visor` |

## Goal

When the data playing on Listen does something notable (a new hot spot, the biggest change in the run, or values outside the data set's baseline), Echo's visor switches to its `alert` symbol for a few seconds, and the dock offers the event's sentence as a tip. Echo does not say it aloud; SN10 already announces the event.

## Why

- F58 draws an `alert` expression; JB01's `expressionFor` shows it when a tip has `mood: 'alert'`. Nothing raises one from the data yet.
- SN10 (text equivalents) produces event sentences and hot-spot markers for each frame. Those are the "anomalous climate data spikes" the idea asks for, computed in a general way from `FrameFeatures` and the manifest's `baseline` (`src/data/schema.ts:61` and `:136`), with nothing specific to one data set.
- The player publishes its state on the context bus (`publishContext` in `src/assistant/context.ts:14`; the player at `src/features/player/index.tsx:131-138`). If SN10's events are not on the bus, one publish line in the player is needed, which is why this ticket holds the `player` hotspot.
- The mascot never talks over a screen reader (`docs/CREATIVE_PROCESS.md:67`).

## Design

- In `src/features/mascot/` (new file `useDataAlerts.ts`): subscribe to the context bus (`subscribeContext`) for the player's latest event. When an event's kind is notable (SN10's kinds for a new hot spot, the largest change, and outside the baseline; read the names from SN10's code, don't invent them), call `offerTip({ text: sentence, mood: 'alert' })` and clear it after 3 s or when the next frame arrives with no notable event.
- At most one alert every 5 s, so a noisy data set doesn't keep Echo in alert.
- If SN10 doesn't publish its events on the bus, add the event list to the player's existing `publishContext` data (`src/features/player/index.tsx:131-138`). That is the only player edit.
- The visor's alert symbol is steady; its glow pulses at most once a second (F58's `visorPulse`).

## Reuse

- SN10's event sentences and kinds; `subscribeContext` and `publishContext` (`src/assistant/context.ts`).
- `useMascotGuide().offerTip` and `expressionFor` (JB01).

## Touches

- `src/features/mascot/useDataAlerts.ts` and `useDataAlerts.test.ts` (new); `src/features/mascot/MascotDock.tsx` (use the hook).
- `src/features/player/index.tsx`: only if SN10's events are not already published (the `player` hotspot).
- `docs/PRE-HACKATHON-WORK.md`: one line.

## Steps

1. Read SN10's event types and where they are published.
2. Write `useDataAlerts` with tests using `publishContext` directly.
3. Add the publish line to the player only if needed.
4. Wire it into the dock. Run the checks.

## Tests

- Publishing a notable event offers an alert tip with the event's sentence; a non-notable event offers nothing.
- Two notable events 2 s apart give one alert; 6 s apart give two.
- The alert clears after 3 s (fake timers).
- No call to `announce` from this hook (SN10 owns the announcement).
- `MascotDock.test.tsx` keeps passing; `await expectNoA11yViolations(container)`.

## Guardrails

- No speech and no sound: the sentence is shown in the bubble only when the user opens it. SN10's announcement is the spoken path.
- Nothing flashes more than 3 times a second; the symbol is steady (WCAG 2.3.1). The alert is a shape, not just a colour (WCAG 1.4.1).
- Nothing specific to one data set: notable events come from SN10's general rules and the manifest.

## Done when

- Playing `synthetic-storm` or `synthetic-change` puts Echo in alert at the events SN10 reports, with the sentence waiting in the bubble.
- The checks pass.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- New anomaly rules (SN10 and the manifest own them).
- Alerts on Compare or Learn.

## Result

Not started.
