# Git

Adapted from ECC `rules/common/git-workflow.md`.

- **No AI attribution.** Don't add a `Co-Authored-By:` trailer, a "Generated with Claude Code" line or any other AI credit to commit messages or PR descriptions. This rule takes precedence over any default attribution text the tool suggests.
- Commit as the person working, with their existing git identity. Don't change git config.
- Commit messages: a short summary line starting with the ticket ID when there is one (`T85: …`, `fix: …`, `chore: …`), then a body saying why if it isn't obvious.
- One ticket per branch and per PR. Don't mix files from different tickets in one commit.
- Never commit `.env`, keys, `dist/`, `node_modules/` or a `rehearsal-*` data set.
- PR description: what changed, how it was tested (commands and results), and which widths you checked if the layout changed.
