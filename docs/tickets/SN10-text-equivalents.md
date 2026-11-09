# SN10 Text equivalents: event sentences, announcements, hot-spot markers, sound recipe

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | SN01, SN03 |
| **Hotspots** | player, about |
| **Branch** | `feature/SN10-text-equivalents` |

## Goal

Everything the sound says has words, and the words are made by rules, never by a model:

1. **Event sentences** from one frame to the next: "A new warm area appeared in the north-east.", "The cold area in the south has gone.", "The warm area moved east."
2. **Rate-limited announcements** of those events through `useAnnounce`, so a screen reader is not flooded: at most one automatic announcement every 4 seconds and 8 a minute; a listener's own action is never held back.
3. **Hot-spot markers** on the picture: one marker per tracked hot spot, with a label, drawn for sighted listeners and listed for screen-reader users.
4. **A sound recipe** on About: a table of the seven voices, what drives each, and what it sounds like, made from the active preset.

## Why

- Announcements today are not rate-limited, and the events of a frame are not put into words at all. `src/describe/index.ts` describes one date (`describeFrame`) and a sequence (`describeSequence`); it does not describe changes between frames of the music.
- `docs/PLAN.md` §6.3 asks for "rate-limited announcements of events from `src/describe/`, hot-spot markers and the scan line on the map, and a sound-recipe table on About made from the active preset". This ticket writes those.
- The salvage ticket S04 (`docs/TICKETS.md`, "Salvage T93 announcement rate") may bring an `announceRate.ts` from an old branch. If S04 has merged first, reuse its limiter and test instead of writing a second one. Do not merge two.
- `src/describe/` must stay pure (boundary, `PLAN.md` §5.9). Words use the data set's own category labels from the manifest (`mapping.categories[].label`), never a word typed into `src/`.

**Order.** The queue needs SN01 (hot-spot ids, centroids, edges) and SN03 (`MusicFrame`, the captions' compass words, `presetFor`). The markers and the sound recipe appear in the Listen page and About; the markers' mount needs the Listen page (SN07), see Touches.

## Design

### Event sentences (`src/describe/events.ts`, new, pure)

```ts
export type SoundEvent =
  | { kind: 'appeared'; id: string; band: Band; place: string }
  | { kind: 'gone'; id: string; band: Band; place: string }
  | { kind: 'moved'; id: string; band: Band; place: string; direction: 'north' | 'south' | 'east' | 'west'; cells: number }
  | { kind: 'grew' | 'shrank'; id: string; band: Band; place: string }
  | { kind: 'dropout' } | { kind: 'recovered' }

/** The events from `previous` to `next`, in a fixed order (by id, then kind). Pure. */
export function eventsBetween(previous: FrameFeatures | null, next: FrameFeatures): SoundEvent[]

/** The sentence for one event, with the data set's own words: "A new warm area appeared in the north-east." */
export function describeEvent(event: SoundEvent, visualization: Pick<Visualization, 'mapping'>): string
```
- A hot spot is **appeared** when its id is in `next` and not in `previous`, **gone** in the reverse case, **moved** when its centroid moved more than `MOVE_CELLS` (2 cells, `2 / 64` of the width) (direction is the larger of the two components), and **grew** or **shrank** when its `areaShare` changed by more than `SIZE_STEP` (a relative change of 50%).
- `band` `high` is named by the top category's label, lowercased (`mapping.categories[last].label`), and `low` by the first's. Picture-mode data sets with no categories use "bright" and "dark". A `place` is the compass sector of the centroid (`compassOf`, from `src/sonify/captions.ts`).
- **dropout** when `next` has `stats.position` `null` and `previous` did not. **recovered** the other way round.
- An event sentence never contains a number that is not a count of cells or a place, so it cannot state a value wrongly.

### Rate-limited announcements (`src/describe/announce.ts`, new, pure apart from `now`)

```ts
export const MIN_GAP_MS = 4000
export const MAX_PER_MINUTE = 8
export const REPEAT_WINDOW_MS = 30000
export class AnnounceLimiter {
  constructor(now?: () => number)
  /** Returns true when the text may be announced now. 'user' answers are never held back by the gap or the per-minute count. */
  offer(text: string, source: 'user' | 'event'): boolean
}
```
- An `'event'` text is refused while less than `MIN_GAP_MS` has passed since the last announcement, or once `MAX_PER_MINUTE` have been made in the last minute, or when the same text was made within `REPEAT_WINDOW_MS`.
- A refused event is **dropped**, not queued: the next event after the gap is the one that counts. The listener can always ask (`What's here?` is IX02; until then, the "Now" line of SN07 is the text).
- A `'user'` text (for example "Symphony mode.", "Detail: Standard.") is always made.
- The page uses it through a small wrapper: `announceEvent(text)` calls `limiter.offer(text, 'event')` and then `useAnnounce()(text)`. The wrapper lives in `src/features/player/` (SN07 files) or `src/describe/` as a hook `useEventAnnouncer()`; choose one and say so in Result.

### Markers (`src/describe/markers.ts`, new, pure; drawn by `HotspotMarkers.tsx`)

```ts
export type HotspotMarker = { id: string; band: Band; x: number; y: number; label: string }
export function hotspotMarkers(features: FrameFeatures): HotspotMarker[]
```
- One marker per hot spot, at its centroid (`x`, `y` are 0 to 1 of the image). `label`: "High area h1 in the north-east, about 4% of the map." (the same words as the events, with the share to the nearest percent).
- `HotspotMarkers.tsx` draws each marker as a small ring with its id, `aria-hidden="true"`, and renders the list of labels as a visually hidden `<ul aria-label="Hot spots on this date">` for screen readers. Markers sit above the picture, scale with it, and never move on their own (no animation).

### The sound recipe (`src/describe/recipe.ts`, new, pure)

```ts
export type RecipeRow = { voice: VoiceId; drivenBy: string; sounds: string; detailLevel: DetailLevel }
export function soundRecipe(preset: Preset): RecipeRow[]
```
- Seven rows in `VOICE_IDS` order. `drivenBy` is the feature (the grid's median, the histogram, the change, the hot spots, the edges, the motion, the date). `sounds` is what it sounds like in words ("a line that rises and falls with the overall level"). `detailLevel` is the first level that includes the voice (`DETAIL_VOICES`).
- The preset is named once at the top of the table by `preset.label` and `preset.note` (SN03), so About says the key choice is artistic.
- The table is text. About renders it as a real `<table>` with a caption and header cells (`SoundRecipe.tsx`, in `src/features/about/`).

## Reuse

- `FrameFeatures`, `Hotspot`, `Band` (`src/analysis/features/types.ts`, SN01).
- `MusicFrame`, `Preset`, `DETAIL_VOICES`, `VOICE_IDS`, `presetFor`, `compassOf` (`src/sonify/`, SN03; `compassOf` is in `captions.ts`).
- `variableWords`, `DEFAULT_WORDS` (`src/data/words.ts`) if a word for "higher" is needed; prefer the category labels.
- `useAnnounce` (`src/components/useAnnounce.ts`). `AnnouncerProvider` (`src/components/Announcer.tsx`).
- The existing `describeSweep`, `describeCell`, `describeFrame` stay as they are (`src/describe/index.ts`).
- If S04 is merged, its `announceRate.ts` (see Why) replaces `AnnounceLimiter`.

## Touches

- New: `src/describe/events.ts`, `announce.ts`, `markers.ts`, `recipe.ts`, their tests; `src/components/HotspotMarkers.tsx` (shared UI: Roni's folder) with its test; `src/features/about/SoundRecipe.tsx` with its test.
- Edit: `src/features/about/index.tsx` (mount the recipe table, one block).
- Mounting the markers on the picture is one line in `src/features/player/Symphony.tsx` (SN07). That file is in the `player` hotspot: this ticket must run when no player ticket is in progress (see Steps). Until then, the markers component is tested alone and not mounted.

## Steps

1. Write `events.ts` and its tests on hand-made features (appeared, gone, moved, grew, dropout).
2. Write `announce.ts` (or reuse S04's): the gap, the count, the repeat window, user answers.
3. Write `markers.ts` and `HotspotMarkers.tsx` (tested alone).
4. Write `recipe.ts` and `SoundRecipe.tsx`; mount the table on About.
5. Mount the markers and the event announcer in Symphony (only when the player hotspot is free).
6. Run the checks.

## Tests

- **Events.** Two frames with one hot spot moved east by three cells: one `moved` event, `direction` `east`, and the sentence "The warm area … moved east."; a new spot: `appeared`; a spot that is no longer in `next`: `gone`; a spot whose share doubled: `grew`; no change: no event; a frame with no readable cells: one `dropout`, then `recovered`.
- **Order.** `eventsBetween` returns the same list every time for the same input.
- **Words.** The sentence uses the manifest's top category label for a `high` spot (a test data set with the label "Hot" gives "hot"; no word is typed into `src/`). A picture-mode set with no categories gives "bright".
- **Limiter.** Four events in 1 s: one is made. An event 4 s after the last is made. Nine in a minute: the ninth is refused. The same text within 30 s is refused. A `'user'` answer is made in every case.
- **Markers.** One marker per hot spot, at its centroid; labels contain the compass sector and the share; no animation class; the list has a label for each marker; `aria-hidden` on the rings.
- **Recipe.** Seven rows in `VOICE_IDS` order; each row's `detailLevel` matches `DETAIL_VOICES`; the preset's label appears once.
- **Accessibility.** `expectNoA11yViolations` on the markers, the recipe table and the About page.
- **Boundary.** `src/boundary.test.ts` covers `describe/**`; nothing in these files imports the assistant or fetches.

- **Golden.** `src/describe/__golden__/events.json`: `eventsBetween` and `describeEvent` for each consecutive pair of `synthetic-storm`'s frames (after SN02 and SN01), with `hotspotMarkers` for frame 0 and `soundRecipe` for each preset, all recorded as text.

## Guardrails

- Words by rules only; the same data always gives the same words. No model.
- Announcements are rate-limited for events and never for a listener's own action. Nothing is announced over a screen reader that the listener did not cause, beyond the limit.
- No word names a place or a data set outside the map and the manifest.
- The markers do not flash or move on their own; the rings are static.
- Everything in the list is also available as text (the markers' list, the recipe table, the event sentences).
- Nothing data-set-specific in `src/`: category labels come from the manifest.

## Done when

- Event sentences, the limiter, the markers, the recipe and the About table work, with the tests above.
- The events reach screen readers only through the limiter, through `useAnnounce`.
- The markers are mounted in Symphony, or Result says why they are not yet.
- `npm run lint && npm test && npm run build` pass with their real output in Result.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- "What's here?" and verbosity levels (IX02).
- The voice guide reading these sentences (G06).
- The sound recipe's audio examples.
- Changing the existing `describeFrame`, `describeSequence`, `describeCell` or `describeSweep` (they are used by Learn, Compare and the explorer).

## Result

Not started.
