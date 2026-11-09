#!/usr/bin/env bash
# PostToolUse hook (Edit|Write): when a layout file changes, tell the agent to apply the
# responsive-layout skill. Reminds once per file per session so routine edits stay quiet.
set -euo pipefail

input="$(cat)"
file="$(jq -r '.tool_input.file_path // .tool_response.filePath // empty' <<<"$input")"
[[ -n "$file" ]] || exit 0

# Only this project's files; skip node_modules, build output and anything outside the repo.
project="${CLAUDE_PROJECT_DIR:-$PWD}"
case "$file" in
  "$project"/node_modules/*|"$project"/dist/*) exit 0 ;;
  "$project"/*) ;;
  *) exit 0 ;;
esac

case "$file" in
  *.css|*/index.html) ;;
  *.tsx)
    # Only markup or styling edits count, not pure logic.
    changed="$(jq -r '(.tool_input.new_string // .tool_input.content // "")' <<<"$input")"
    grep -qE 'className=|style=\{|<[a-z][a-z0-9]*[ />]' <<<"$changed" || exit 0
    ;;
  *) exit 0 ;;
esac

session="$(jq -r '.session_id // "unknown"' <<<"$input")"
marker_dir="${TMPDIR:-/tmp}/claude-layout-hook-$session"
mkdir -p "$marker_dir"
marker="$marker_dir/$(printf '%s' "$file" | md5sum | cut -d' ' -f1)"
[[ -e "$marker" ]] && exit 0
touch "$marker"

rel="${file#"$project"/}"
jq -n --arg rel "$rel" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: ("Layout file changed: " + $rel + ". Before finishing, apply the responsive-layout skill (.claude/skills/responsive-layout/SKILL.md): pick the pattern for this content and check the rules. For now the app is desktop first: verify at 1280 px (and 768 px where width matters), and do not block phones later (flexible widths, 44 px targets, nothing hover-only). The phone pass at 360 px with the bottom navigation bar is ticket T120 (.claude/rules/platform.md). Report the widths checked.")
  }
}'
