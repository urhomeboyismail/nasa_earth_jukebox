# W7: No blind user and no screen reader has used the app

TL;DR: Accessibility is the product, but everything we know about it comes from code checks and a scripted desktop Chrome run. Nobody has used NVDA, TalkBack or VoiceOver on any section, and nobody has listened to the sound.
Status: **open**. Found in: T4, T7, T8, T10. Owner: red team + frontend.

## Why it matters
- Passing axe does not mean the page is understandable. The messages at stops are long and may be tiring: "Steps 10 to 12: no data, not zero. ... Press Continue."
- The page now has many sections (Play, Ask, Picture, Hides, About). The order and amount of text may be too much for a screen-reader user to move around.
- The "What the sound hides" listener test (at least 2 of 3) has not been run by anyone.
- Presentation and Accessibility scores cannot honestly pass 4 without a real test (FINAL §11).

## How to fix
1. Book testers (T0 §D). If none can come, run a teammate on NVDA with the screen off, and label it "not a blind-user test".
2. Run `proof/tester-protocol.md` and fill in `proof/results-note.md` from the observer sheet.
3. Fix what they find, one issue per task number, then re-run the automated suites.
4. Check section order, heading structure and message length; consider a "skip to" link set.

## Done when
`proof/results-note.md` has a real n and real task results, or the pitch says "not yet tested with blind users" and nothing more.
