# Adding one NASA data set (hackathon phase)

The checklist for the hackathon phase (`.claude/rules/phases.md`): take one NASA data set from download to a tuned, checked entry in the jukebox **without changing code**. Field-by-field details are in [`data-sources.md`](data-sources.md); this page is the order to do them in.

Give yourself about half a day per data set, most of it on steps 4 to 6.

## 1. Pick and record the source
- One variable, one region, dated frames with a colour bar (SVS, GIBS, Worldview, EIC). Prefer PNG over JPEG or video.
- Write down the source name, URL, credit, licence and the day you downloaded it. These go in the manifest exactly as the source page says them.
- Choose a baseline, in this order: `anomaly-product` > `climatology` (same calendar month) > `reference-date` ([Baselines](data-sources.md#baselines-v2-t111)). With no baseline, the data set plays only the temperature styles.

## 2. Rehearse first
Convert into `public/data/rehearsal-<name>/`, which git ignores, and list it in `index.json` only while you check it. Take the `index.json` entry out again before you commit.

## 3. Convert
```bash
.venv/bin/python -I scripts/convert_frames.py --id <id> --frames <dir> \
  --legend-box x0,y0,x1,y1 --legend-values min,max --map-area x0,y0,x1,y1 \
  [--baseline-kind climatology --baseline-dir <normals> --baseline-label "the 1991 to 2020 August average"] \
  --out public/data/<id>
```
All the flags are in [Converting frames](data-sources.md#converting-frames-t91).

## 4. Fill in the manifest (`public/data/<id>/manifest.json`)
- Every `TODO`: title, summary, description, variable and unit, source fields, region name and description, one alt text per frame.
- Check `colorScale.noData` (land, coast, labels) and `maxColorDistance`, and move any region points that sit on land.
- Set category ranges and labels that fit **this** variable (five, coolest first).
- With a baseline: set `changeSteps` and `contourLevels` that fit the size of this data set's changes.
- Add comparisons, each checked against the NASA source. With a baseline, include one where "by value" and "by change" give different answers.
- Optional: story chapters, running forward in time.
- Add the entry to `public/data/index.json`.

## 5. Check
```bash
npm run check-data     # fix everything it names
npm test               # with a baseline: record its Scores in src/data/__golden__/change.json
```

## 6. Listen and tune
`npm run dev`, then open `#listen?data=<id>`:
- Play it through, explore the map by keyboard, and try Compare, Learn and the descriptions (concise and rich).
- Tune only manifest values (categories, steps, levels, regions, text) until it sounds right and reads right.
- Run the listening check (T87 protocol in `docs/evidence/`) with at least one person.

## 7. Commit
On branch `feature/T85-<id>`: the data set folder, its `index.json` entry, the golden Scores, and a line in `docs/PRE-HACKATHON-WORK.md` under "During the hackathon". **No changes to `src/`**, unless step 6 needed a new general manifest field (`.claude/rules/phases.md`).
