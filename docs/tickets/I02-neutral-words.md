# I02 Neutral default words; remove the temperature words still in `src/`

| | |
|---|---|
| **Priority** | P0 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | learn, player, compare |
| **Branch** | `fix/I02-neutral-words` |

## Goal

The app's default words are neutral, so a data set that does not name its own words is not described as temperature. The text in `src/` that the listener reads no longer says "warm", "cold" or "temperature". Every data set that exists today reads exactly as before, because each manifest sets its own words.

## Why

- The default words are about sea temperature: `src/data/words.ts:6-13` (`higher: 'warmer'`, `lower: 'cooler'`, `highest: 'warmest'`, `lowest: 'coolest'`, `edge: 'warm edge'`, `thing: 'water'`).
- No manifest sets `variable.words` today. A check on 9 Nov: none of `public/data/fixture`, `synthetic-ocean`, `synthetic-globe`, `synthetic-change` or `rehearsal-sst` has it. Every data set gets the defaults.
- Temperature words still written into the text the listener reads:
  - `src/features/learn/index.tsx:160` ("all one temperature"), `:163` and `:164` (the play button "Play: all warm"), `:179` ("the temperature changes"), `:205` ("never mistaken for cold");
  - `src/features/player/index.tsx:239` ("not the temperature itself");
  - `src/features/compare/index.tsx:213` ("not the temperature itself");
  - `src/features/about/index.tsx:95` ("never counted as cold");
  - `src/features/demo/script.ts:18` ("from cold to hot").
- Correction to the brief: the golden files do not change. `src/data/__golden__/*.json` hold categories, notes, frame IDs and sound steps, not words. The tests that change are the tests that assert words, for example `src/data/words.test.tsx` (it expects `higherPhrase(DEFAULT_WORDS)` to be `'warmer water'`).
- Not a problem: `src/features/ask/facts.ts:74-76` has "coldest", "warmest" and "coolest" as aliases. Those are words people type, not words the app says. Keep them, and say so in the pull request.

## Reuse

- `variableWords(variable)` and `higherPhrase(words)` in `src/data/words.ts`. Every page already gets its words from these. Use them in the text rather than writing new strings.
- `src/data/index.ts` exports `DEFAULT_WORDS`, `variableWords` and `higherPhrase`.

## Touches

- `src/data/words.ts` (the defaults).
- `public/data/fixture/manifest.json`, `public/data/synthetic-ocean/manifest.json`, `public/data/synthetic-globe/manifest.json`, `public/data/synthetic-change/manifest.json`: add the explicit words.
- `src/features/learn/index.tsx`.
- `src/features/about/index.tsx`.
- `src/features/player/index.tsx` and `src/features/compare/index.tsx`.
- `src/features/demo/script.ts`: the demo names no data set, so its sentence must stay neutral.
- The tests that assert the old words (found in Steps).
- Not `rehearsal-sst`: it is git-ignored. Set its words locally if you like, but never commit it.

## Steps

1. Change the defaults in `src/data/words.ts` to neutral words. Proposal: `higher: 'higher'`, `lower: 'lower'`, `highest: 'highest'`, `lowest: 'lowest'`, `edge: 'edge'`, `thing: 'value'`. The sentences that use them must still read well. Check each one (`grep -rn "higherPhrase\|words\.\|variableWords" src`), and change the sentence rather than the word if needed. For example, "longer for higher value" needs a new sentence.
2. Add the old words explicitly to each manifest that is in the repo, so their text does not change. In each `public/data/<id>/manifest.json`, inside the `variable` object, add: `"words": { "higher": "warmer", "lower": "cooler", "highest": "warmest", "lowest": "coolest", "edge": "warm edge", "thing": "water" }`. Check the schema still accepts it (`words` is a partial object with `thing` allowed to be empty).
3. Replace the listed sentences in Learn, Listen, Compare and About with text built from the variable's words, or with words that name no temperature. Learn's "Play: all warm" becomes a neutral label such as "Play: all one value". Keep the category names, which come from the manifest.
4. Replace the sentence in `src/features/demo/script.ts:18` with a neutral one, such as "from the lowest category to the highest".
5. Leave the comments that use examples (`src/audio/pan.ts:4`, `src/analysis/analyze.ts:42`) and the internal function name `traceWarmEdge` (`src/features/player/usePlayer.ts:277`). Those are not text the listener reads. Do not rename them in this ticket.
6. Update the tests that assert the old words. Find them with `grep -rl --include='*.test.ts' --include='*.test.tsx' -e warmer -e warmest -e 'warm edge' -e coolest -e 'water' src`. Change only assertions about the default text. Assertions about category IDs ("warm", "cold") stay.
7. Add a test that the defaults contain no temperature word (see Tests).
8. Run `npm run check-data` and the regression tests. They must pass without changing the golden files.
9. Add one line to `docs/PRE-HACKATHON-WORK.md` under "During the hackathon".

## Tests

- `src/data/words.test.tsx`: update the default-words assertions to the new defaults. Add: "the defaults use no temperature word" (none of `warm`, `cold`, `hot`, `temperature` appear in the values of `DEFAULT_WORDS`).
- A data set with no `words` reads with the neutral words. A data set with the explicit words reads as before (`warmer water`).
- Learn, About and Listen: each changed sentence is found by its text in a test (role or text query). Update the old assertions.
- `src/data/sound-regression.test.ts` and `src/data/change-regression.test.ts` must pass unchanged. If they fail, the change is wrong: revert it.
- `await expectNoA11yViolations(container)` on any page whose copy changed, if its test renders the page.

## Guardrails

- Text only. The sound and the visuals do not change, and the golden files are the proof.
- Every text the listener reads is either from the manifest or neutral. No number or unit is added.
- Changed sentences keep the same meaning for the same data set.

## Done when

- `DEFAULT_WORDS` has no temperature word. `grep -rn -i "warm\|cold\|temperature" src --include="*.tsx" --include="*.ts"` lists only the Ask aliases, comments, internal names and test fixtures.
- Every existing data set reads as before (the explicit words are in each manifest).
- `npm run check-data` passes. The sound and change regression tests pass with no golden change.
- `npm run lint && npm test && npm run build` pass.

## Checks

```bash
npm run lint && npm test && npm run build
npm run check-data
npx vitest run src/data src/features/learn src/features/about src/features/player src/features/compare src/features/demo
```

## Out of scope

- New words for a new data set (that is the manifest's job, in EIC03).
- The Ask aliases.
- Renaming internal functions and variables.

## Result

Branch `fix/I02-neutral-words`.

**Defaults** (`src/data/words.ts`): `higher: 'higher'`, `lower: 'lower'`, `highest: 'highest'`, `lowest: 'lowest'`, `edge: 'edge'`, `thing: 'values'`. One difference from the ticket's proposal: `thing` is `'values'`, not `'value'`, because three sentences print `higherPhrase` ("Which date shows higher values?", "longer for higher values", Home's question), and the plural reads correctly in all three without a new sentence.

**Manifests:** the explicit temperature words were added to `fixture`, `synthetic-ocean`, `synthetic-globe` and `synthetic-change`. `mur-sst-mauritius` already had them (S02), so the ticket's note that no manifest sets `variable.words` was out of date. `rehearsal-sst` was not touched.

**Sentences changed** (the listener's text; every other occurrence of the words in `src/` is a comment, an internal name, the Ask aliases or a test):
- Learn: "all one temperature" to "all one value"; the button and its announcement "Play: all warm" to "Play: all one value"; "When the temperature changes" to "When the value changes"; "never mistaken for cold" to "never mistaken for a low value"; "A cooler place is a lower note, and a warmer place is a higher note" to "Where the value is cooler, the note is lower; where it is warmer, the note is higher" (built from the data set's words).
- Listen and Compare: "not the temperature itself" to "not the value itself".
- About: "never counted as cold" to "never counted as a low value".
- Demo script: "from cold to hot" to "from the lowest category to the highest".
- Not changed, as the ticket says: the Ask aliases ("coldest", "warmest", "coolest" and so on are words people type), `traceWarmEdge` and the comment examples.

`grep -rn -i "warm\|cold\|temperature" src --include='*.ts' --include='*.tsx'`, without tests, golden files and comment lines, lists only: a developer message in `src/data/check.ts`, the Ask aliases, `traceWarmEdge`, and the local names `warmest`/`coolest` in `src/describe/index.ts`.

**Tests:** `src/data/words.test.tsx` (the fixture now sets its own words, so the "no `words`" cases use the same data set with none; new tests: the defaults contain no temperature word, the fixture still reads "warmer water", the neutral reading of Compare and `describeSequence`), `src/features/compare/judge.test.ts`, `src/features/learn/learn.test.tsx` (the two old assertions, plus the own-words and neutral readings), and one new assertion each in `src/features/player/change.test.tsx`, `src/features/compare/change.test.tsx`, `src/features/about/about.test.tsx` and `src/features/demo/runDemo.test.ts`. Only assertions about the default text changed; no category ID assertion did.

Also changed, outside Touches: `docs/data-sources.md` (the `variable.words` row listed the old defaults; it now lists the neutral ones and says a temperature data set should set all six), and the work-log line in `docs/PRE-HACKATHON-WORK.md`.

The sound and change regression tests pass with no golden change (`git diff --stat -- src/data/__golden__` is empty).

```
$ npm run lint
(oxlint: no warnings or errors)
$ npm test
 Test Files  64 passed (64)
      Tests  1209 passed (1209)
$ npm run build
✓ built in 438ms
$ npm run check-data
 Test Files  9 passed (9)
      Tests  192 passed (192)
$ npx vitest run src/data/sound-regression.test.ts src/data/change-regression.test.ts
 Test Files  2 passed (2)
      Tests  12 passed (12)
```
