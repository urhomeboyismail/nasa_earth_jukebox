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

- `src/data/index.ts`: add the friendly function, and keep `DataError` as it is. Review: Dhruv.
- `src/App.tsx`: use the friendly message, and log the detail. Review: Mohammad.
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
- Mohammad has reviewed `App.tsx`. Dhruv has reviewed `src/data/`.

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

Not started.
