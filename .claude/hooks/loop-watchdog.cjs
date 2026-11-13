// Blocks a shell command after its base form fails MAX_FAILURES times in a row.
// Counts are per session and per agent; any user prompt clears them.
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MAX_FAILURES = 3;
const MAX_TOKENS_PER_SEGMENT = 3;
const STALE_MS = 7 * 24 * 60 * 60 * 1000;

const input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
if (!input.session_id) process.exit(0);

const root = path.join(os.tmpdir(), 'claude-loop-watchdog');
const safe = (value) => String(value).replace(/[^\w-]/g, '');
const sessionDir = path.join(root, safe(input.session_id));
const agentDir = path.join(sessionDir, safe(input.agent_id ?? 'main'));

if (input.hook_event_name === 'UserPromptSubmit') {
  fs.rmSync(sessionDir, { recursive: true, force: true });
  try {
    for (const entry of fs.readdirSync(root)) {
      const dir = path.join(root, entry);
      if (Date.now() - fs.statSync(dir).mtimeMs > STALE_MS) fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch {}
  process.exit(0);
}

// "cd src && npx vitest run a.spec.ts --reporter=dot 2>&1 | tail -20" -> "cd && npx vitest run | tail"
const baseCommand = (command) =>
  command
    .replace(/^rtk\s+/, '')
    .split(/(\|\||&&|[|;])/)
    .map((segment, index) => {
      if (index % 2) return segment;
      const kept = [];
      for (const token of segment.match(/"[^"]*"|'[^']*'|\S+/g) ?? []) {
        if (token === '--') break;
        const isFlag = /^-/.test(token);
        const isRedirect = /^\d*[<>]/.test(token);
        const isArgument = /^["'$@]|[\\/=:*~,]|\.\w+$|^\d+$/.test(token);
        if (!isFlag && !isRedirect && !isArgument) kept.push(token.replace(/^rtk$/, ''));
      }
      return kept.filter(Boolean).slice(0, MAX_TOKENS_PER_SEGMENT).join(' ');
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

const key = baseCommand(String(input.tool_input?.command ?? ''));
if (!key) process.exit(0);

const counterFile = path.join(agentDir, crypto.createHash('sha1').update(key).digest('hex'));
const failures = () => {
  try {
    return fs.statSync(counterFile).size;
  } catch {
    return 0;
  }
};
const reply = (hookSpecificOutput) =>
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: input.hook_event_name, ...hookSpecificOutput } }));

switch (input.hook_event_name) {
  case 'PreToolUse':
    if (failures() >= MAX_FAILURES) {
      reply({
        permissionDecision: 'deny',
        permissionDecisionReason: `Loop watchdog: "${key}" failed ${MAX_FAILURES} times in a row. Stop retrying variants of it; find the root cause, change approach, or ask the user. Any user message clears the block.`,
      });
    }
    break;
  case 'PostToolUseFailure':
    fs.mkdirSync(agentDir, { recursive: true });
    fs.appendFileSync(counterFile, '1');
    if (failures() === MAX_FAILURES) {
      reply({ additionalContext: `Loop watchdog: "${key}" has failed ${MAX_FAILURES} times in a row and is blocked until the user sends a message.` });
    }
    break;
  case 'PostToolUse':
    fs.rmSync(counterFile, { force: true });
    break;
}
