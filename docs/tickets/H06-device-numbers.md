# H06 Device numbers, live-video CPU on a phone, real-phone checks

| | |
|---|---|
| **Priority** | P3 |
| **Size** | S (under half a day) |
| **Who** | 👤 |
| **Needs** | SN06 |
| **Hotspots** | — |
| **Branch** | `chore/H06-device-numbers` |

## Goal

Measure the app on real devices (a laptop and at least one phone, with a second phone browser if possible), write the numbers into `docs/performance.md`, and check the two things that only a real phone can show: F12 (music pauses while the guide talks) and F15 (vibration, which iOS does not support).

## Why

- `docs/performance.md` was measured in headless Chromium on a cloud machine with CPU throttling, and says so. Its "To fill in on real devices" table is empty.
- Memory is the stated risk: about 650 MB for 60 full-HD frames, which may be too much for a phone tab (`docs/performance.md`, "What it means").
- SN06 reads each displayed frame live from a video, which costs CPU during playback. Its cost on a phone is unmeasured.
- `docs/PLAN.md` (platform rule, `.claude/rules/platform.md`): F12 and F15 are still to do on real devices.

## What to measure

Use the data set in use for the demo (the real one once it is in the repo, otherwise the fixture). Note the commit and the data set id.

1. **Laptop** (model, RAM, browser). Play ready, sound map, peak memory, and whether the tab survived, as the `docs/performance.md` table asks.
2. **Phone** (model, OS version, browser). The same four numbers.
3. **Live video CPU on a phone** (SN06). Play a live-video sequence for two minutes. Record the CPU use of the browser (for example Android's developer tools or the battery and performance screen) and whether the picture and the sound stayed in step. Note any dropped frames shown by the browser.
4. **F12 on a phone.** Start Listen, start the voice guide, let it speak. The music must pause while the guide talks and must not start again by itself. Record what happened.
5. **F15 on a phone.** Turn vibration on. Play a sequence. Record whether it vibrated. On iPhone, record that it does not (this is expected: no vibration API on iOS).

## Where to write it

- `docs/performance.md`: fill in the "To fill in on real devices" table, one row per device, with the model, the browser and the date. For the live-video CPU and F12 and F15, add a short section under the table with the result and the date.
- Write "not measured" for any cell you could not measure. Do not estimate.

## Done when

- Each row of the device table is filled with a number or "not measured", with the model and the browser.
- The live-video CPU, F12 and F15 results are written, one line each.
- Any problem that blocks the demo is listed at the top of the section, with a ticket or board entry for it.

## Checks

```bash
git diff --stat docs/performance.md     # only that file changed
```

## Guardrails

F12 is a sound check: play the guide's voice and the music together only briefly, at the usual volume.

## Out of scope

- Fixing anything found (a ticket or a board request).
- The practice test (H03) and the final check (H08).

## Result

Not started.
