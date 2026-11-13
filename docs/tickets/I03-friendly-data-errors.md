# I03 Friendly data errors instead of developer messages

| | |
|---|---|
| **Priority** | P2 |
| **Size** | S (under half a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | app |
| **Branch** | `fix/I03-friendly-data-errors` |

## Goal

A listener who cannot load a data set reads a plain sentence that says what to do. The developer detail (file names, HTTP status, validation messages) goes to the console.

## Why

- `src/App.tsx:82` throws "No visualizations are listed in public/data/index.json." That is shown to users when the list is empty.
- `src/App.tsx:223` shows `The data could not be loaded. {loadError}`. `loadError` is the raw `message` of the error.
- The messages come from `src/data/index.ts`. `DataError` builds `"<file>: <message>"` (lines 10 to 17). `fetchJson` writes texts such as "could not be found (HTTP 404)." and "is not valid JSON.". `loadVisualization` adds the zod issues from `describeIssues`.
- So a listener can see "fixture/manifest.json: could not be found (HTTP 404)." That is developer language, and it is not useful to a listener who uses a screen reader.
- `src/App.tsx:85` and `:106` store these messages in `failure`, and `App.tsx:96` picks them up.

## Reuse

- `DataError` in `src/data/index.ts`, with its `file` field, for developers.
- `Notice` (`src/components/Notice.tsx`) for the message box.
- `useAnnounce` is not needed: `Notice` text is read by the screen reader when it appears, and this ticket does not change that.

## Touches

- `src/data/index.ts`: add the friendly function, and keep `DataError` as it is.
- `src/App.tsx`: use the friendly message, and log the detail.
- `src/App.test.tsx`: the new tests.
- A new test file next to the new function, if you put the function in a new file.

## Steps

1. Add `friendlyDataMessage(error: unknown): string` in `src/data/index.ts` (or in a new file `src/data/errors.ts` exported from `index.ts`). It returns a short sentence, for example: "This data set could not be loaded. Choose another from the list, or reload the page." For the list itself: "The list of data sets could not be loaded. Reload the page." An unknown error gives the same generic sentence. Do not include a file name, a status code or a validation message in the sentence.
2. In `src/App.tsx`, where `failure` is set (lines 85 and 106), call `console.error(error)` so the detail stays in the console, and store the friendly sentence in `failure.message`.
3. Replace the empty-list error at line 82 with the friendly list sentence, and keep the `console.error`.
4. Keep the `Notice` at line 223 as it is, with the friendly text.
5. Leave `DataError` and its messages unchanged, so that developer tools and the check script keep their detail.
6. Write the tests below.

## Tests

In `src/App.test.tsx`, stub `fetch` with `vi.stubGlobal` and restore it in `afterEach`:

- The list answers with HTTP 500. Render `App`. Expect a `role="alert"` or the `Notice` text to say that the list could not be loaded, and to say "Reload the page". Expect no "HTTP", no "index.json" and no "public/data" in the page text (`expect(document.body).not.toHaveTextContent(/HTTP|index\.json|public\/data/)`).
- A data set's manifest is not valid JSON. The page says the data set could not be loaded. The same checks hold.
- The list is empty (`[]`). The friendly list sentence is shown.
- `friendlyDataMessage` (unit test) returns the same generic sentence for an unknown value, for example a string or `null`.
- `await expectNoA11yViolations(container)` on the error state.

## Guardrails

Not applicable: no sound or visual change. The message is text in the same box, with the same role.

## Done when

- A listener who cannot load a data set sees a sentence with no file name, status code or validation text.
- The detail still appears in the console once per failure.
- The tests above pass. `npm run lint && npm test && npm run build` pass.

## Checks

```bash
npm run lint && npm test && npm run build
npx vitest run src/App.test.tsx src/data
```

## Out of scope

- Retrying failed downloads.
- Changing the messages that `npm run check-data` prints.
- Errors inside a page (Listen, Compare), which have their own copy.

## Result

Built by agent D on `fix/I03-friendly-data-errors`, 12 Nov 2026.

- `src/data/index.ts`: `friendlyDataMessage(error)` returns "The list of data sets could not be loaded. Reload the page." for a `DataError` on `index.json`, and "This data set could not be loaded. Choose another from the list, or reload the page." for anything else (another file, a plain `Error`, a string, `null`). `DataError` and its messages are unchanged; `'index.json'` is now one constant.
- `src/App.tsx`: both load failures go through `failureOf`, which calls `console.error(error)` once and stores the friendly sentence. The empty list throws a `DataError` on `index.json`, so it gets the list sentence. The `Notice` shows only the sentence (it already starts with "Error:"); the old "The data could not be loaded." prefix is gone, since the sentence says that. `messageOf` was no longer used and is removed.
- `src/App.test.tsx`: the two tests that expected developer text now expect the sentences. New: list HTTP 500 (text, "Reload the page", no `HTTP`/`index.json`/`manifest.json`/`public/data` on the page, one console call carrying the detail, no a11y violations), manifest not valid JSON, empty list, and unit tests for `friendlyDataMessage` (list, data set, string, `null`, `undefined`, plain `Error`).

Checks, run again on 13 Nov 2026 after rebasing onto `main` at `5b82420` (the rebase was clean). On this laptop the default `npm test` (8 vmThreads workers) runs out of memory (about 650 MB free), so the suite ran as `npx vitest run --pool=forks --maxWorkers=1`. Same tests, one process.

```
$ npm run lint
> moon-heist@0.0.0 lint
> oxlint
(exit 0)

$ npx vitest run --pool=forks --maxWorkers=1
 Test Files  131 passed (131)
      Tests  2201 passed (2201)
   Duration  482.18s

$ npm run build
✓ built in 1.41s

$ npx vitest run src/App.test.tsx src/data --pool=forks --maxWorkers=1
 Test Files  14 passed (14)
      Tests  291 passed (291)
```
