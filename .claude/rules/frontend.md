# Front end (React + TypeScript + Vite)

Adapted from ECC `rules/typescript`, `rules/react` and `rules/web`.

- Plain React with Vite. Ignore Next.js, server components and SSR advice.
- Each feature lives in `src/features/<name>/`. Shared parts go in `src/components/`, sound in `src/audio/`, image reading in `src/analysis/`, text in `src/describe/`.
- Use TypeScript strictly: no `any`, and no `as` casts to silence an error. Validate data from outside with the zod schemas in `src/data/schema.ts`.
- A file that exports components exports only components (fast refresh). Put hooks and helpers in their own files.
- Don't call `setState` synchronously in an effect. Derive the value during render, or set it in the event that causes it.
- Accessibility is the product, not an extra:
  - every control has a label and works by keyboard;
  - every sound has a text equivalent;
  - announce changes through `useAnnounce`.
- Tests sit next to the code (`x.ts` → `x.test.ts`) and run with Vitest. Copy `src/test/a11y.test.tsx`:
  - find things by role and name (`getByRole('button', { name: 'Play' })`), and use `userEvent` for input;
  - call `await expectNoA11yViolations(container)` on anything you render;
  - jsdom has no `AudioContext` or `Worker`, so use `installFakeAudioContext()` / `installFakeWorker()` from `src/test/fakes.ts`, then `uninstall()`;
  - mock `fetch` with `vi.stubGlobal` and undo it in `afterEach`.
- Keep the first load small: pages other than Home and heavy libraries (Tone.js) load on demand.
