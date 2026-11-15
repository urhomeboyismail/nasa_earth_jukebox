# EIC02 Pick 3–5 EIC visualisations; check source, credit and licence

| | |
|---|---|
| **Priority** | P1 |
| **Size** | S (under half a day) |
| **Who** | 👤 |
| **Needs** | — |
| **Hotspots** | — |
| **Branch** | `chore/EIC02-pick-visualisations` |

## Goal

Three to five NASA Earth Information Center (EIC) visualisations are chosen for the first real data sets (EIC03). For each one there is a recorded source page, the exact credit line, the licence or usage note read from the page, the legend read off the colour bar, the frame format, and a decision with its reason. At least one is an animation (for live reading) and at least one is a picture with no colour bar (for picture mode), if the team wants the picture mode shown.

## Why

- EIC03 cannot start without a source, a credit and a licence: `docs/DATASET-PLAYBOOK.md` step 1 and `docs/data-sources.md` "Manifest fields" require them, and `npm run check-data` fails while any `TODO` is left. Nothing may be guessed: a credit line copied from a page is the only acceptable one.
- The choice decides what the team can prove on Symphony, Scan and Learn: a visualisation with a colour bar gives values (the data mode), an animation gives live reading (SN06), a picture gives the picture mode (SN01).
- `docs/data-sources.md` "Candidates seen on SVS" already lists what was seen in search results, with pages not opened in full. This ticket turns that into checked picks.
- The queue says agents never claim this ticket. An agent may help gather the facts from pages the person opens, but the person reads each licence line and signs off each pick.

## Design

### Candidates (a starting list, not a decision)

| Proposed id | What it is | Why it is a candidate | What to check first |
|---|---|---|---|
| `mur-sst-mauritius` | Sea surface temperature around Mauritius (MUR SST) | Already started (S02, a salvage ticket). A data colour bar. | That the credit and licence on the page match what S02 recorded; the bar's numbers and unit. |
| a global temperature anomaly | A global map of the change from a long-term normal | Its legend may already show a change (`anomaly-product`), which is the simplest baseline. | Whether the bar runs below and above zero, and the normal it is measured from (the label for the manifest). |
| Arctic sea ice | Ice extent or concentration over the seasons | Strong seasonal change; a clear edge (ice and open water) for the rhythm voice. | Whether the bar shows concentration or extent, and whether land and the pole are masked. |
| an ocean current flow animation | Surface currents as a moving picture | An animation: the live reader (SN06) and the motion voice have something to read. | The frame count and the frame rate; whether there is a colour bar or only arrows (arrows cannot be read as values). |
| a hurricane or cloud picture | A true-colour picture of a storm or clouds | Picture mode: no measured values, so the app must say so. | That it has no colour bar that would be read as values; the picture's own credit line. |

Add or drop candidates freely. The queue asks for 3 to 5 picks.

### The checklist for each candidate

For each candidate, record every line. "Unknown" is allowed; then the candidate is dropped or checked again.

1. **Page.** The NASA page's address, its title, and the date range and frame count it covers.
2. **Credit.** The exact credit line from the page, copied, with the words the page uses. Do not write your own.
3. **Licence and usage.** Read the page's usage or licence text, and any note that a part of the material belongs to someone else (a third-party image, music or data). Record the words, and whether the page says anything about NASA logos, insignia or endorsement. Use NASA's current media usage guidance (find the page from the NASA website; do not rely on memory). If a part is not clearly free to use, drop it or keep only the parts that are clear.
4. **Underlying data.** If the picture comes from a data provider, record the provider's name and its own licence (the provider may have a different one from NASA's page).
5. **Colour bar.** Is there one? Its two end values and their unit, as printed on the bar. The end that is the low value (for a horizontal bar, the left end; for a vertical bar, the bottom end). Whether the bar has labels or only a picture of a bar.
6. **Frames.** Format (MP4, PNG, JPG), size in pixels, frame count, frame rate, and the dates each frame stands for. A frame with a date in its name, or a list of dates on the page, is best.
7. **Overlays.** Titles, logos, dates, legends and a map border on the frame: where they are, as fractions of the picture, roughly.
8. **Alt text.** The page's own description of what the picture shows, copied for the alt text.
9. **Baseline candidate.** `anomaly-product` (the bar already shows the change), `climatology` (the page gives a long-term average for each month, and each month's average is available as a picture), `reference-date` (a single earlier date is enough), or `none`.
10. **Decision.** Pick or drop, and the reason in one sentence.

### Where the result goes

Append a table to the existing section "Candidates seen on SVS" in `docs/data-sources.md`, one row per candidate, with these columns: proposed id, page address, title, credit (exact), licence or usage (exact words, or "see page, read by <name> on <date>"), underlying data and its licence, colour bar (ends and unit, or "none: picture"), frames (format, size, count, rate), overlays, baseline candidate, decision, reason. Put the date you read each page in the table.

Do not download a frame in this ticket. EIC03 downloads and records the date it did.

## Reuse

- `docs/data-sources.md` "What was and was not found", "Candidates seen on SVS" and "Still to find out": extend them, do not repeat them.
- `docs/DATASET-PLAYBOOK.md` step 1 (the source fields and the baseline order).
- `docs/PLAN.md` §6.3, "EIC data" (what EIC visualisations usually are).

## Touches

- `docs/data-sources.md`, the candidates section only.
- Nothing else. No code, no data folder, no manifest.

## Steps

1. Open each candidate's NASA page (the person does this; an agent may gather the facts from the pages the person opens, and must mark anything it could not read).
2. Fill the checklist for each candidate. Stop at 5.
3. Make the decision and write the reason.
4. Write the table into `docs/data-sources.md`.
5. Tell the team on `docs/AGENT-BOARD.md` which ids are picked, so EIC03 can start. (The picks are then a request to EIC03's owner.)

## Done when

- Three to five picks have every field of the table filled, or "unknown" with a reason to drop.
- Every credit is copied from the page, and every licence line says where it was read and when.
- At least one pick has a colour bar with its ends and unit, and one is an animation, if the team wants the live reading shown on the first data sets.
- The board names the picks.

## Checks

```bash
git diff --stat -- docs/data-sources.md     # only the candidates section changed
```

No code check applies: this ticket changes documents only.

## Guardrails

- Nothing is guessed: a credit, a licence, a colour-bar value or a date is copied from the page, with the day it was read. "Unknown" is written as unknown.
- A part of a visualisation that is not clearly free to use is dropped, not used with a caveat.
- No agent claims this ticket. An agent may gather facts from pages the person opens and must mark what it could not read.
- Nothing in the table implies that NASA endorses the app.

## Out of scope

- Downloading or converting any frame (EIC01, EIC03).
- Writing any manifest, or `index.json` (EIC03).
- Deciding the presets, comparisons or stories (EIC03).
- Any claim about NASA's endorsement of the app. The app says it is not endorsed by NASA only if the team decides that text; this ticket does not write it.

## Result

Done by Roni (Sahajoo Ronitesh, team Guru's Moon Heist) with Claude Code, 14 and 15 Nov 2026. Five picks, each with every field of the checklist in `docs/data-sources.md` under "Checked picks (EIC02)", read on the live NASA pages (SVS was unreachable for a while on 14 Nov; every pick was read again live).

| Pick | What | Source | Data set |
|---|---|---|---|
| 1 | SST anomaly | SVS 5176, https://svs.gsfc.nasa.gov/5176 | built as `sst-anomaly-global` (merged, PR #97) |
| 2 | Sea ice concentration | GIBS layer `GHRSST_L4_MUR_Sea_Ice_Concentration` | not built yet: the layer is a flat world map, so a polar crop must be chosen |
| 3 | Global temperature change 1880 to 2025 | SVS 5603, https://svs.gsfc.nasa.gov/5603 | built as `global-temperature-anomaly` (merged, PR #98) |
| 4 | Ocean currents coloured by SST | SVS 3912, https://svs.gsfc.nasa.gov/3912 | built as `ocean-currents-temperature` (PR #101, open) |
| 5 | Hurricanes over warm water, Atlantic 2023 | SVS 5305, https://svs.gsfc.nasa.gov/5305 (Sea Surface Temperature only version) | built as `hurricanes-2023-atlantic` (PR #102, open) |

Seen and not picked, with the reason in the table: SVS 4809 (a rotating globe), 5265 (no colour bar), 5382 and 5583 (third-party JAXA material, no colour bar), 5479 (its ocean background reads as cold water).

Licence read by: Sahajoo Ronitesh on 15 Nov 2026 for all five picks. No pick is a picture-mode one (no colour bar).

Checks: `git diff --stat -- docs/data-sources.md` shows changes only in the candidates section.
