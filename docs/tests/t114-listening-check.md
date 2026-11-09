# T114 listening check: the "change from normal" sound

**Status: NOT RUN.** No listener has taken part yet, so there are no scores here and the change style stays opt-in. This page is the ready-to-run protocol (T114 step 7, `docs/TICKETS.md`). When it has been run, add the results to the PR and to the table at the end, with no names.

All correct answers below come from the data, not from opinion: the pairs from `public/data/synthetic-change/expected.json` (and the app's own change steps), the traces from the app's own contour tracing on the real pictures.

## Who and what

- At least **3 listeners** on **headphones**; at least one who did not write the code; none told what the layers mean beyond one sentence each (below).
- A quiet room, volume set once with "Test sound" and left alone.
- Data set `synthetic-change` (made-up practice data), so the right answers are known. Open `#compare?data=synthetic-change`; use Listen's "Sound" control to switch between "Full" and "Change from normal". Check where the control is before the first session.
- Facilitator reads the script, writes down answers and never says whether one is right until the end.

## What to say (one sentence per sound)

- **Full:** "Each date is a note. A higher note is a warmer sea."
- **Change from normal:** "Each date is a held tone. A higher tone means the sea is further above what is normal for that time of year, not warmer."
- **Warm-edge trace:** "A moving tone follows the line where the sea is one degree warmer than normal; listen for where it moves."

## Part 1: which date is further above normal? (12 pairs, twice)

The same 12 pairs are played once in **Full** and once in **Change from normal**. Alternate which comes first between listeners (listener 1 starts with Full, listener 2 with Change, and so on). The question every time is: **"Which date is further above its normal?"**

In Full the listener hears the temperature, so on a pair where the two answers disagree the "natural" answer is wrong. That is the point of the test.

| # | Date A | Date B | Correct (further above normal) | What the temperature says |
|---|---|---|---|---|
| 1 | 15 May 2024 | 15 August 2024 | **Date B** | About the same |
| 2 | 15 September 2024 | 15 July 2024 | **Date A** | About the same |
| 3 | 15 February 2024 | 15 October 2024 | **Date B** | Date A |
| 4 | 15 January 2024 | 15 February 2024 | **About the same** | About the same |
| 5 | 15 January 2024 | 15 August 2024 | **Date B** | Date A |
| 6 | 15 April 2024 | 15 September 2024 | **Date B** | Date A |
| 7 | 15 January 2024 | 15 May 2024 | **About the same** | Date A |
| 8 | 15 December 2024 | 15 March 2024 | **About the same** | About the same |
| 9 | 15 December 2024 | 15 August 2024 | **Date B** | Date A |
| 10 | 15 October 2024 | 15 January 2024 | **Date A** | Date B |
| 11 | 15 July 2024 | 15 March 2024 | **About the same** | Date B |
| 12 | 15 September 2024 | 15 March 2024 | **Date A** | Date B |

Ten of the twelve are pairs where the temperature answer and the change answer disagree. Pair 3 is the original T111 case: February is warmer than October, but October is far above its own normal.

## Part 2: where is the warm edge? (6 traces)

Play each trace (the "Trace the warm edge" button, or **T**, in the change style) and ask: **"Is the warm edge mostly on the left, in the middle or on the right?"** "Left", "middle" and "right" are thirds of the map's width; the answer is where the line's points sit on average.

Only one `synthetic-change` date has a warm-edge line (October), so five traces come from the real Mauritius data (`mur-sst-mauritius`, change since 23 January 2023). Run those in a data set listed as real, and tell the listener which is which at the end.

| # | Data set | Date | Line | Correct | Where the line's points sit (x, 0 = west, 1 = east) |
|---|---|---|---|---|---|
| 1 | synthetic-change | 15 October 2024 | +1 °C | Right | 0.66 to 0.89, average 0.78 |
| 2 | mur-sst-mauritius | 24 March 2023 | +2 °C | Left | 0.00 to 0.05, average 0.03 |
| 3 | mur-sst-mauritius | 14 March 2023 | +1 °C | Right | 0.59 to 0.96, average 0.81 |
| 4 | mur-sst-mauritius | 3 April 2023 | +2 °C | Left | 0.04 to 0.22, average 0.14 |
| 5 | mur-sst-mauritius | 23 May 2023 | +1 °C | Middle | 0.38 to 0.77, average 0.61 (the only middle case; it leans east, so treat a "right" as a near miss and note it) |
| 6 | mur-sst-mauritius | 3 April 2023 | +1 °C | Right | 0.81 to 1.00, average 0.89 |

Play them in a mixed order (for example 3, 2, 6, 5, 1, 4), not as listed.

## Part 3: comfort

After one minute of sequences and three traces, ask: **"How comfortable was this to listen to, from 1 (unpleasant) to 5 (very comfortable)?"**

## Pass rule and decision

- **Pass:** every listener scores at least **10 of 12** in Part 1 with the change sound; at least **4 of 6** in Part 2; and every comfort rating is **3 or more**.
- **Pass:** `"change"` becomes the default for data sets with a baseline and is used in the final listening test (`docs/PLAN.md` §6.2).
- **Fail:** it stays opt-in. If only the traces failed, remove the contour voice and keep the bed.
- Write down, for every listener, the headphone model and whether they wrote any of the code. Do not write names.
- If a result is close or a listener struggled with the same item as others, say so; do not round up.

## Results (fill in after each listener)

| Listener | Wrote code? | Headphones | Started with | Part 1 Full (of 12) | Part 1 Change (of 12) | Part 2 (of 6) | Comfort (1 to 5) | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | |
| 2 | | | | | | | | |
| 3 | | | | | | | | |

**Decision:** _not yet made._
