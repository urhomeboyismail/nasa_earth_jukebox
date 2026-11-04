# Tickets

Sub-tickets cut from [`docs/PLAN.md`](../PLAN.md). Hand a ticket to your own AI like this:

> Read `AGENTS.md`, `docs/PLAN.md` and ticket `<ID>` in `docs/tickets/`. Do only that ticket, on branch `feature/<ID>-short-name`, and open a PR into `main`.

Every ticket must also meet the definition of done in PLAN.md §9.

## How tickets stay independent

1. **T00 is merged first, on day 1.** It installs every package, creates every interface in PLAN.md §5 with a *working stub* behind it, adds a small test dataset, and creates the page folders.
2. **Every other ticket depends only on T00.** You build against the stubs. Whoever owns an interface replaces the stub with the real thing **behind the same exports**, so nobody waits for anybody.
3. **Only edit files your ticket lists.** If you need a change in someone else's file, ask them; don't edit it.
4. **Don't add packages.** T00 installs them all, so `package.json` and the lockfile don't conflict. If you really need a new one, agree it with the team leader first.
5. One person's tickets can have an order among themselves ("do T03 before T04"). That never blocks anyone else.

## Who does what

| Person | Load | Tickets | File |
|---|---|---|---|
| Team leader | Heavy | T00, T01–T08: shared interfaces, frame analysis, sound engine, study API, re-plan, demo | [`team-leader.md`](team-leader.md) |
| Mohammad (@urhomeboyismail) | Heavy | T10–T14: page links, player, Compare, test mode, voice control | [`mohammad.md`](mohammad.md) |
| Bhavish (@bhavish.tb) | Light | T20–T24: stereo panning, CI, deployment, results summary, submission | [`bhavish.md`](bhavish.md) |
| Dhruv | Medium | T30–T34: data schema, synthetic frames, NASA research, converter, comparisons | [`dhruv.md`](dhruv.md) |
| Roni | Medium | T40–T47: test helpers, components, Learn, About, audit, testers, integration checks, vibration | [`roni.md`](roni.md) |

## Timeline

| Milestone | Target | Tickets |
|---|---|---|
| Day 1 | 5 Nov | **T00** |
| M1 Start in parallel | 6 Nov | Everyone starts any of their tickets. Start now (not code): T32, T45 |
| M2 Full journey on synthetic data | 9 Nov | T01, T02, T03, T04, T10, T11, T12, T30, T31, T40, T41, T42, T21, T22 |
| M3 Feature complete and deployed | 12 Nov | T05, T13, T14, T43, T44, T45, T46, T20, T23 |
| M4 Real data | 13 Nov | T06, T33 |
| M5 Tests, demo, submission | 15 Nov | T07, T08, T34, T47, T24 |

## All tickets

| ID | Title | Owner | Due | Priority |
|---|---|---|---|---|
| T00 | Shared interfaces, stubs and tooling | Team leader | Day 1 | Must |
| T01 | Frame analysis core | Team leader | M2 | Must |
| T02 | Frame analysis worker | Team leader | M2 | Must |
| T03 | Sound engine: voices, cues, volume, ducking | Team leader | M2 | Must |
| T04 | Sound engine: sequences, pause, speed | Team leader | M2 | Must |
| T05 | Study API and database | Team leader | M3 | Must |
| T06 | Re-plan against the judging guide | Team leader | M4 | Must |
| T07 | Demo script and backup video | Team leader | M5 | Must |
| T08 | WAV export | Team leader | M5 | Should |
| T10 | Hash links and navigation | Mohammad | M2 | Must |
| T11 | Player page | Mohammad | M2 | Must |
| T12 | Compare page | Mohammad | M2 | Must |
| T13 | Listening-test mode UI | Mohammad | M3 | Must |
| T14 | Voice guide playback tools | Mohammad | M3 | Should |
| T20 | Stereo panning values | Bhavish | M3 | Should |
| T21 | Continuous integration | Bhavish | M2 | Must |
| T22 | Deployment: Render and Vercel | Bhavish | M2 | Must |
| T23 | Results summary | Bhavish | M3 | Must |
| T24 | Submission README and AI-use disclosure | Bhavish | M5 | Must |
| T30 | Data schema and validation | Dhruv | M2 | Must |
| T31 | Synthetic frame generator | Dhruv | M2 | Must |
| T32 | NASA source research | Dhruv | Now | Must |
| T33 | NASA converter and check | Dhruv | M4 | Must |
| T34 | Curate real comparisons | Dhruv | M5 | Must |
| T40 | Accessibility test helpers | Roni | M2 | Must |
| T41 | Shared components and styles | Roni | M2 | Must |
| T42 | Learn the sounds page | Roni | M2 | Must |
| T43 | About the data page | Roni | M3 | Must |
| T44 | Accessibility audit | Roni | M3 | Must |
| T45 | Test protocol and recruiting testers | Roni | Now → M3 | Must |
| T46 | Integration checks | Roni | M2, M3 | Must |
| T47 | Vibration on phones | Roni | M5 | Could |
