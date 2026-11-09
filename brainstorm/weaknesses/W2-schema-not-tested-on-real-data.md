# W2: The story schema comes from our reading of FINAL, not from real data

TL;DR: `contract/story.schema.json` was designed from the written plan. No real EIC or GIBS series has passed through it yet. The first real story may not fit.
Status: **open**. Found in: T1. Owner: data engineer (with sound and frontend owners).

## Why it matters
- The plan freezes the schema at hour 6. Sound, frontend and agent all build on it. A late change costs three people.
- T2 is the ticket with the most unknowns. If decoding gives something the schema cannot say, we find out at the worst time.

## What might not fit (guesses, not facts)
- **One value per step.** Real data may give a region, several bins, or a distribution per frame.
- **`coverage_pct` as one number.** Real coverage might need its own definition per layer (cloud, night, no-data).
- **Step labels as plain text.** Real series have dates, irregular spacing, and maybe two frames a day.
- **One `source_id` per step.** A step might combine two sources (frame plus cross-check).
- **`facts.json` has no schema yet.** `key_moments[].fact_ids` are just strings.
- **No place for frame images or marker geometry** beyond a 0–1 `marker` point.

## How to fix
1. Before the freeze, run one real series through a throwaway script: GIBS sea-ice for a few years, decoded against its colour key, written as a story file.
2. Run `validate_story.py` on it. Every error that is not a real data problem is a schema gap. List them.
3. Change the schema once, in one go, with agreement from the sound and frontend owners. Update the fixture and tests with it.
4. Add a `facts.schema.json` at the same time.

## Done when
One real (non-fixture) story validates with `--require-real`, and the schema version moves from `1.0.0-draft` to `1.0.0`.

## Cheap safeguard now
`schema_version` is already in every file, so a change is detectable. Keep `additionalProperties: false` so a drift fails loudly instead of silently.
