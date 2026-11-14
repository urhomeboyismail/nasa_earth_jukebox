# EIC04 Authoring workflow: Consumption/ staging, `.vtt` captions, one-command parse, view and check

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | EIC01 |
| **Hotspots** | — (edits `package.json` and `vite.config.ts`, which no hotspot lists) |
| **Branch** | `feature/EIC04-authoring-workflow` |

## Goal

A contributor can follow the nightvault-authors routine for an EIC item: create a staging folder, drop the SVS MP4 and its `.vtt` captions in it, run one command to get `public/data/<id>/`, preview it at `http://127.0.0.1:5180` with a reload on every JSON edit, run one check, and empty the staging folder.

## Why

- `scripts/eic_ingest.py:1-12` already turns an MP4 into a data set, but every run needs a long flag list typed by hand (`scripts/eic_ingest.py:57-81`), and nothing records the flags between runs.
- Nothing reads `.vtt` captions. SVS pages (e.g. svs.gsfc.nasa.gov/4960) ship narration captions that belong in the manifest's `story` chapters (`src/data/schema.ts:90`, `:147`, `:200-205`).
- Vite does not reload when a file in `public/` changes, so a manifest edit in `docs/DATASET-PLAYBOOK.md` §6 ("tune only manifest values") needs a manual refresh.

## Design

- `scripts/consume.py new <Category>/<Source>/<Item_ID>`: makes `Consumption/<…>/` with an `ingest.json` holding `id` and the `eic_ingest` flags (`TODO` values).
- `scripts/consume.py parse [folder]`: runs `eic_ingest.main` for each item with an `.mp4`, then turns its `.vtt` into `story` chapters `caption-<n>`. Each cue's start and end become the latest dated frame at or before that point of the video. Cues are checked first: start before end, in order, not overlapping, ending inside the video.
- `scripts/consume.py clean`: empties `Consumption/` except its `README.md`.
- npm: `new-translation`, `parse-nasa`, `clean-consumption`, `view` (port 5180), `check` (lint, test, check-data, script tests).
- `vite.config.ts`: a dev-only plugin sends a full reload when `public/data/**/*.json` changes.

## Reuse

`eic_ingest.main` (as a library, as `eic_ingest` uses `convert_frames`), its ffprobe checks, `npm run check-data` for the chapters' frame ids. No schema change.

## Touches

`scripts/consume.py`, `scripts/tests/test_consume.py`, `package.json`, `vite.config.ts`, `.gitignore`, `Consumption/README.md`, `docs/DATASET-PLAYBOOK.md`, `docs/data-sources.md`, `AGENTS.md`, `docs/TICKETS.md`, this file.

## Done when

- The routine in Goal works end to end on a short MP4 and a hand-made `.vtt`, under a `rehearsal-` id.
- A bad `.vtt` (overlap, out of order, past the end) stops `parse-nasa` and names the cue.
- The checks pass.

## Out of scope

- A second viewer, a `content/` tree, precomputed Web Audio parameter files: the app, `public/data/<id>/` and live sonification (SN05, SN06) already do these.

## Result

Filled in by the agent.
