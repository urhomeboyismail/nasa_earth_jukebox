# V03 Voice client: parsed messages, quieter status, shared icons

| | |
|---|---|
| **Priority** | P1 |
| **Size** | S (under half a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | voice |
| **Branch** | `feature/V03-voice-client-hygiene` |

## Goal

Every message from the server is checked with a zod schema before the page uses it. The panel's status line is announced only when the status is connecting, an error or ended, so a screen reader is not told "Listening" or "Speaking" on every turn. The panel uses the shared icon component and the repo's code style, and a stale comment is gone.

## Why

- `src/hooks/useVoiceAssistant.ts` parses messages with `JSON.parse` and casts them: `as PlayerCommand` (about line 30), `as { setDate?: unknown }` (about line 33), `event.data as string` and `message` typed as `Record<string, unknown>` (about line 190). Nothing checks the shape of a `transcript` or an `error`.
- `src/VoiceAssistant.tsx:86` puts `role="status"` on the visible status line. Every change of status (Listening, Speaking, Listening again after each reply) is announced, which talks over the guide's own speech.
- `src/VoiceAssistant.tsx:11-18` draws six icons inline (`const icons = { ... }`, `function Icon`). `src/components/Icon.tsx` (`Icon`, `IconName`, line 28) is the shared component, and its file says it is not exported from the index on purpose.
- `src/VoiceAssistant.tsx:10` says "Switch to the shared src/components/Icon.tsx once T50 has merged." T50 has merged, so the comment is stale.
- `src/VoiceAssistant.tsx` and `src/hooks/useVoiceAssistant.ts` use double quotes and semicolons. The rest of the front end (for example `src/App.tsx`) uses single quotes and no semicolons.

## Design

### Parsed server messages (`src/hooks/voiceMessages.ts`, new)

- zod schemas for each server message the page handles: `ready`, `transcript` (`role` is `user` or `assistant`, `text` is a string), `interrupted`, `turn_complete`, `action` (`navigate` with a page, or `player` with a command), `error` (`code` and `message` strings), `ended` (`reason` string).
- The player command schema is a union: one of the six words, or an object with exactly one key `setDate` that is a real calendar date. It replaces the casts in `toPlayerCommand`. Its inferred type is `PlayerCommand` (`src/features/player/controls.ts`).
- `parseServerMessage(text: string)`: `JSON.parse` inside try, then the union of the schemas. Returns `null` for anything else. Unknown `type` values are ignored, as today.
- The hook calls `parseServerMessage` once per text message. Binary frames are not parsed.
- `toAssistantAction` keeps its allow-list and its own checks. It still runs on every `action` message (it is the browser's second check, as the comment at the top of the hook says).

### Quieter status (`src/VoiceAssistant.tsx`)

- The visible status line (`voice-assistant__status`) has **no** `role`. It shows the same text as today.
- A separate visually hidden `<p role="status">` (class `ui-visually-hidden`) is always in the panel. It holds text only when the status is `connecting`, `error` or `ended`, and is empty for `listening` and `speaking`. So only those three changes are announced.
- The text for `error` is the error text from the hook (V01 makes it plain). This ticket does not change any wording.

### Shared icons

- Replace the six inline icons with `Icon` from `src/components/Icon.tsx`. Map the names: `mic`, `micOff`, `volume`, `close`, `send`, `stop` to the shared names, and add any that are missing to `src/components/Icon.tsx`. If you add one, tell Roni on `docs/AGENT-BOARD.md`, since that folder is Roni's.
- Delete the `icons` object, the local `Icon` function and the stale comment on line 10.

### Code style

- Reformat `src/VoiceAssistant.tsx` and `src/hooks/useVoiceAssistant.ts` to the style of the surrounding code: single quotes, no semicolons, the same trailing-comma and line-length habits as `src/App.tsx`. Use the repo's formatter if one is configured; check `package.json` and the lint config first. Do not reformat other files.
- Behaviour must not change in this reformat. The diff should be easy to review: say in **Result** which parts were only reformatted.

## Reuse

- `src/components/Icon.tsx` (`Icon`, `IconName`).
- `zod` (already a dependency; `src/data/schema.ts` uses it).
- `src/features/player/controls.ts` (`PlayerCommand`).
- `toAssistantAction` in `src/hooks/useVoiceAssistant.ts`.
- `src/hooks/useVoiceAssistant.test.ts` and `src/VoiceAssistant.test.tsx` for the test style.

## Touches

- `src/hooks/voiceMessages.ts` (new), `src/hooks/voiceMessages.test.ts` (new)
- `src/hooks/useVoiceAssistant.ts` (parsing, the casts removed, formatting)
- `src/VoiceAssistant.tsx` (status region, icons, comment, formatting)
- `src/VoiceAssistant.test.tsx`, `src/hooks/useVoiceAssistant.test.ts` (new cases)
- `src/components/Icon.tsx` (only if a name is missing; tell Roni)

Do not touch the consent, the push-to-talk, the Echo did list or the errors. Those are V01 and V02, which use the same files: do not start this ticket while either is `claimed` (the queue's `voice` hotspot).

## Steps

1. Check that V01 and V02 are not claimed (the queue's `voice` hotspot).
2. Write `voiceMessages.ts` and its tests. Use it in the hook.
3. Replace the casts with the schemas and the union.
4. Change the status markup.
5. Switch to the shared icons and delete the local ones and the stale comment.
6. Reformat the two files. Check that the diff has no behaviour change beyond steps 2 to 5.
7. Run the checks.

## Tests

Vitest and Testing Library.

1. `parseServerMessage` returns the object for each valid server message in the protocol (`ready`, `transcript`, `interrupted`, `turn_complete`, `action`, `error`, `ended`), and `null` for: invalid JSON, a missing `type`, a transcript with `role` `"system"`, an action with a bad `setDate` (`"2024-02-30"`, `"2024-7-1"`), an error without `message`.
2. A `{"type":"transcript","role":"system","text":"x"}` message is ignored and does not add a line to the transcript.
3. A `setDate` command with an extra key is refused by `toAssistantAction`.
4. The status line text for each status is unchanged (listening, speaking, connecting, error, ended, and the muted listening text).
5. The status line itself has no `role` attribute.
6. The hidden status region has text for `connecting`, `error` and `ended`, and is empty for `listening` and `speaking`.
7. The panel renders its icons through the shared component (the icon elements carry the shared component's `class` name), and the close button still has the name "Close voice guide".
8. `expectNoA11yViolations` on the panel in the listening state and the error state.

Also run `grep -n "const icons" src/VoiceAssistant.tsx` and `grep -n "T50" src/VoiceAssistant.tsx`: both must print nothing.

## Guardrails

Not applicable: no sound is made or changed. The status region must not announce anything while the guide is speaking.

## Done when

- Every server message is checked by a schema before use, and the casts in the hook are gone.
- The status line is announced only for connecting, error and ended.
- The local icons and the stale comment are gone.
- The two files follow the repo's style, with no behaviour change beyond the listed items.
- Every test in the list passes.

## Checks

```bash
npm run lint && npm test && npm run build
```

No server change, so the server checks do not apply.

## Out of scope

- Any change to the wording of errors (V01), the consent and push-to-talk (V02).
- Any change to the protocol or the server.
- Other components' styles.

## Result

Not started.
