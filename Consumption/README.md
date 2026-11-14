# Consumption: staging for raw NASA material (EIC04)

Nothing here is committed except this file. Raw SVS videos and captions go here while you turn them into a data set, and the folder is emptied when you are done.

```bash
npm run new-translation -- "Atmosphere/SVS/rehearsal-4960"   # makes Atmosphere/SVS/rehearsal-4960/ and its ingest.json
# put the .mp4 and its .vtt captions in that folder, and fill in the TODOs in ingest.json
npm run parse-nasa                                            # writes public/data/<id>/
npm run view                                                  # http://127.0.0.1:5180/#listen?data=<id>, reloads on JSON edits
npm run check
npm run clean-consumption                                     # empties this folder, keeping this README
```

The full order, from picking a source to committing, is in `docs/DATASET-PLAYBOOK.md`.
