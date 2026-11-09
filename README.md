# Earth Jukebox (NASA Guru's Moon Heist)

Hear NASA Earth data: dated maps turned into sound and text, so blind and low-vision people can explore them. Entry for the 2026 NASA Space Apps Challenge. Live site: https://nasagurusmoonheist.vercel.app. It runs on phones and desktops and can be installed from the browser.

- How to work on it: [`AGENTS.md`](AGENTS.md) and the rules in [`.claude/rules/`](.claude/rules/)
- What was built before and during the hackathon: [`docs/PRE-HACKATHON-WORK.md`](docs/PRE-HACKATHON-WORK.md)
- Adding a NASA data set: [`docs/DATASET-PLAYBOOK.md`](docs/DATASET-PLAYBOOK.md)
- Plan and tickets: [`docs/PLAN.md`](docs/PLAN.md), [`docs/TICKETS.md`](docs/TICKETS.md)

The full project README is part of T87. The notes below are from the Vite template.

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
