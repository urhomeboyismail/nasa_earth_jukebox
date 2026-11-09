# Two phases: a broad design first, then refinement for each NASA data set

**Pre-hackathon (to 8 Nov 2026): design broadly.** Build general machinery that works for any data set: loading, analysis, the sound engine and styles, Listen, Compare, Learn, descriptions, accessibility, and the change style (v2).

**Hackathon (from 9 Nov 2026): refine for each data set.** Take each NASA data set in turn, add it, and tune it until it sounds and reads right. Follow `docs/DATASET-PLAYBOOK.md`.

## The rule that keeps the phases apart

Everything specific to one data set lives in **its own files**, never in `src/`:

- `public/data/<id>/manifest.json`: title, source and credit, colour scale, no-data colours, `mapArea`, regions, categories and notes, baseline, `changeSteps`, `contourLevels`, comparisons, story, alt text;
- `public/data/index.json` (its entry);
- the converter flags you pass to `scripts/convert_frames.py`.

So:

- Don't write a data set's name, place, unit, value range, category label or date into `src/`. Read it from the manifest. (Comments and test fixtures may use examples.)
- Test new code on `fixture`, `synthetic-ocean`, `synthetic-globe` and `synthetic-change`, so it works for any manifest that passes `npm run check-data`.
- In the hackathon phase, refining a data set means changing its data and manifest, not code. If a data set needs something no manifest field can express, add a **general** field to `src/data/schema.ts` and `src/data/types.ts`, document it in `docs/data-sources.md` → "Manifest fields", and give it a default so every other data set still validates and sounds the same.
- A `rehearsal-*` data set is practice. Its folder is git-ignored, so don't commit its `index.json` entry either (`docs/data-sources.md`).
