// Runs the real offline Ask matcher (src/features/ask/ask.ts) for the agent eval (G07). Run with `npx --no-install tsx`.
//   static-ask.ts --write-facts            write server/agent_eval/facts.json (fixture facts, from the same fixed results as ask.test.tsx)
//   static-ask.ts <questions.json> ...     print one JSON object: question id -> { matched, answer, factIds, guardsAllow }
//   static-ask.ts --list-aliases           print the stored QUESTIONS (id, factId, aliases) for the drafter
// Nothing here changes src/.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import fixture from '../../public/data/fixture/manifest.json'
import type { FrameAnalysis } from '../../src/analysis'
import type { Visualization } from '../../src/data'
import { ask, guardsAllow } from '../../src/features/ask/ask'
import { buildFacts, QUESTIONS } from '../../src/features/ask/facts'

const visualization = fixture as Visualization
const dates = visualization.frames.map(frame => frame.date)
// The fixture's four dates: cold, mild, hot, then not enough data (the same results as ask.test.tsx).
const results: FrameAnalysis[] = visualization.frames.map((frame, i) => ({
  frameId: frame.id, regionId: 'centre', sampled: 9, valid: i === 3 ? 0 : 9,
  category: (['cold', 'mild', 'hot', 'insufficient'] as const)[i],
  ...(i < 3 && { medianValue: [10, 20, 30][i] }),
}))
const facts = buildFacts(visualization, results)
const FACTS_PATH = fileURLToPath(new URL('../../server/agent_eval/facts.json', import.meta.url))

const args = process.argv.slice(2)
if (args.includes('--write-facts')) {
  writeFileSync(FACTS_PATH, JSON.stringify({ dates, facts }, null, 2) + '\n')
} else if (args.includes('--list-aliases')) {
  console.log(JSON.stringify(QUESTIONS.map(({ id, factId, question, aliases }) => ({ id, factId, question, aliases }))))
} else if (args[0]) {
  const file = JSON.parse(readFileSync(args[0], 'utf8')) as { real: { id: string; text: string }[]; adversarial?: { id: string; text: string }[] }
  const out: Record<string, unknown> = {}
  for (const q of [...file.real, ...(file.adversarial ?? [])]) {
    const { matched, answer, factIds } = ask(q.text, facts, dates)
    out[q.id] = { matched, answer, factIds, guardsAllow: guardsAllow(q.text, dates) }
  }
  console.log(JSON.stringify(out))
} else {
  console.error('usage: static-ask.ts --write-facts | --list-aliases | <questions.json>')
  process.exit(2)
}
