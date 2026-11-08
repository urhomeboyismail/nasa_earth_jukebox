// Runs the real T5 matcher (app/qa/match.js) over the eval questions and prints JSON.
// Used by run_eval.py so the comparison uses the code the app actually ships.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ask } from "../../app/qa/match.js";

const p = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const read = (rel) => JSON.parse(readFileSync(p(rel), "utf8"));
const questions = read("./questions.json");
const qa = read("../../app/qa/answers.json");
const facts = read("../../app/stories/mur-sst-mauritius-2023.facts.json");
const story = read("../../app/stories/mur-sst-mauritius-2023.story.json");
const dates = story.steps.map((s) => s.label);

const out = {};
for (const q of [...questions.real, ...questions.adversarial]) {
  const r = ask(q.text, qa, facts, dates);
  out[q.id] = { matched: r.matched, factIds: r.factIds, answer: r.answer, more: r.more, reason: r.reason || "" };
}
console.log(JSON.stringify(out));
