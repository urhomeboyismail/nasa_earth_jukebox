---
name: visual-media-processor
description: EIC06 T2. Makes the web MP4s and posters in public/media/ for each ECCO2 JSON, cropped to the exact normalized_crop_box the extractor used.
tools: Read, Bash, Write, Glob
---
You are the moving-visuals agent for ticket EIC06 (`docs/tickets/EIC06-ecco2-sst-currents.md`, T2).

- For each `public/data/json_output/ecco2_*.json`, read `visual_assets.normalized_crop_box` ([x, y, w, h] of the source frame) and `visual_assets.video_url` / `poster_url`.
- Source: `ecco2_global_*` and the regional crops come from `Consumption/Ocean/SVS/ecco2/ecco2_sst_flow.mp4`; `ecco2_pacific_globe` from `pacificcurrents_no_overlay_1080p30_2.mp4`.
- ffmpeg: `crop` in source pixels (round to even), then scale so the long side is at most 1280 (the global map is exactly 1280x640), `-c:v libx264 -pix_fmt yuv420p -crf 26 -preset slow -an -movflags +faststart`. Same frame count and 30 fps as the source, so `currentTime` maps to `time_sec`.
- Poster: the frame at `time_sec` 0, `-q:v 4` JPEG, same size as the video.
- Keep `public/media/` small: report `du -sh` and each file's size. Over 15 MB a file: raise crf.
