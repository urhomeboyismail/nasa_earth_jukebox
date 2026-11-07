// Static question matcher (T5). Pure functions: no DOM, no network, no AI.
// A question matches only if it is close to a stored question or alias. Anything else
// gets the fixed answer "Not in this record." (CLAUDE.md rule 5: nothing is invented.)

export const NOT_FOUND = "Not in this record.";
export const MAX_QUESTION_CHARS = 200;
const THRESHOLD = 0.5;

const STOP = new Set(("a an and are as at be been by did do does for from had has have how i in is it its me my of on or " +
  "that the their there this to was were what when where which who why will with you your about tell please can could").split(" "));

// Words that try to steer the assistant instead of asking about the record.
const STEERING = /\b(ignore|disregard|pretend|override|jailbreak|system prompt|forget your|act as|you are now)\b/i;

// Requests the record cannot serve: arithmetic, unit conversion, forecasts, superlatives beyond the record.
const OUT_OF_SCOPE = /\b(add|sum|multiply|divide|average of|convert|fahrenheit|kelvin|miles?|forecast|predict|will be|in the future|ever|always|never|worst|best|confirm)\b|record[- ]?(breaking|high|low)/i;

export const normalise = (s) =>
  String(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\-\s.]/g, " ").replace(/\s+/g, " ").trim();

// Light stemming so "dropped/drops/dropping" and "readings/reading" meet.
const stem = (w) => w.replace(/(ing|ed|es|s)$/, (m, _x, off) => (off >= 3 ? "" : m));

export function tokens(s) {
  return normalise(s)
    .replace(/(?<!\d)\.|\.(?!\d)/g, " ")
    .split(" ")
    .filter((w) => w && !STOP.has(w))
    .map(stem);
}

const DATE = /\b\d{4}-\d{2}-\d{2}\b/g;
const YEAR = /\b(1[0-9]{3}|2[0-9]{3})\b/g;

// A question that names a date or year the record does not contain cannot be answered from it.
export function mentionsUnknownTime(question, knownDates) {
  const q = String(question);
  const known = new Set(knownDates);
  const years = new Set([...known].map((d) => d.slice(0, 4)));
  for (const d of q.match(DATE) || []) if (!known.has(d)) return true;
  for (const y of q.replace(DATE, " ").match(YEAR) || []) if (!years.has(y)) return true;
  return false;
}

const jaccard = (a, b) => {
  const A = new Set(a), B = new Set(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const x of A) if (B.has(x)) n += 1;
  return n / (A.size + B.size - n);
};

// Rare words count more than common ones: "reading" appears in many questions and says little;
// "minimum" or "dataset" say a lot. Weight = log(1 + N / df), df = stored questions that use the word.
function weights(qa) {
  const df = new Map();
  for (const e of qa.answers) {
    const seen = new Set([e.question, ...e.aliases].flatMap(tokens));
    for (const w of seen) df.set(w, (df.get(w) || 0) + 1);
  }
  const N = qa.answers.length;
  return (w) => Math.log(1 + N / (df.get(w) || 0.5));
}

function weightedScores(q, phrase, wt) {
  const Q = new Set(q), P = new Set(phrase);
  let inter = 0, p = 0, u = 0;
  for (const x of P) { p += wt(x); if (Q.has(x)) inter += wt(x); }
  u = p;
  for (const x of Q) if (!P.has(x)) u += wt(x);
  return { cov: p ? inter / p : 0, jac: u ? inter / u : 0 };
}

export function score(query, entry, wt = () => 1) {
  const qt = tokens(query);
  if (!qt.length) return 0;
  const nq = normalise(query);
  let best = 0;
  for (const phrase of [entry.question, ...entry.aliases]) {
    if (normalise(phrase) === nq) return 1;
    const pt = tokens(phrase);
    if (!pt.length) continue;
    // A one-word phrase only counts for a very short question; otherwise it matches too much.
    if (pt.length === 1 && qt.length > 2) continue;
    const { cov, jac } = weightedScores(qt, pt, wt);
    best = Math.max(best, Math.min(cov, 0.5 + 0.5 * jac));
  }
  return best;
}

export function confidenceTag(kinds) {
  if (kinds.every((k) => k === "data")) return "From data";
  if (kinds.includes("limit")) return "Description, not measured";
  return "From a cited fact";
}

// Build everything shown to the user from the cited facts. The answer text itself is
// stored text; the citation, the tag and the "more" text are made by code.
export function render(entry, factsById) {
  const cited = entry.fact_ids.map((id) => {
    const f = factsById[id];
    if (!f) throw new Error(`answer ${entry.id} cites unknown fact ${id}`);
    return f;
  });
  return {
    matched: true,
    id: entry.id,
    answer: entry.answer,
    factIds: entry.fact_ids,
    confidence: confidenceTag(cited.map((f) => f.kind)),
    source: `Source: ${entry.fact_ids.join(", ")}`,
    more: cited.map((f) => `${f.id}: ${f.text}`).join(" "),
  };
}

export function notFound(reason) {
  return { matched: false, id: null, answer: NOT_FOUND, factIds: [], confidence: "No answer", source: "", more: "", reason };
}

// Every number the user types (apart from dates) must already be in the facts, or be a step number.
function mentionsUnknownNumber(question, facts, stepCount) {
  const known = new Set();
  for (const f of facts.facts) for (const m of f.text.replace(DATE, " ").match(/-?\d+(?:\.\d+)?/g) || []) known.add(String(Number(m)));
  for (let i = 1; i <= stepCount; i++) known.add(String(i));
  for (const m of String(question).replace(DATE, " ").match(/\d+(?:\.\d+)?/g) || []) {
    if (/^(19|20)\d\d$/.test(m)) continue; // years are handled by mentionsUnknownTime
    if (!known.has(String(Number(m)))) return true;
  }
  return false;
}

export function ask(question, qa, facts, knownDates, stepCount = knownDates.length) {
  const q = String(question ?? "").trim();
  if (!q) return notFound("empty");
  if (q.length > MAX_QUESTION_CHARS) return notFound("too long");
  if (STEERING.test(q)) return notFound("steering words");
  if (OUT_OF_SCOPE.test(q)) return notFound("outside what the record can answer");
  if (mentionsUnknownTime(q, knownDates)) return notFound("date or year not in the record");
  if (mentionsUnknownNumber(q, facts, stepCount)) return notFound("number not in the record");
  const factsById = Object.fromEntries(facts.facts.map((f) => [f.id, f]));
  // A date that appears in exactly one fact is a lookup of that fact ("value on 2023-07-22").
  const asked = new Set(q.match(DATE) || []);
  if (asked.size === 1) {
    const [d] = asked;
    const holders = facts.facts.filter((f) => f.text.includes(d));
    const entry = holders.length === 1 && qa.answers.find((a) => a.fact_ids.length === 1 && a.fact_ids[0] === holders[0].id);
    if (entry) return { ...render(entry, factsById), score: 1 };
  }
  const wt = weights(qa);
  let best = null, bestScore = 0;
  for (const entry of qa.answers) {
    const s = score(q, entry, wt);
    if (s > bestScore) { best = entry; bestScore = s; }
  }
  if (!best || bestScore < THRESHOLD) return notFound("no close match");
  return { ...render(best, factsById), score: bestScore };
}

// Which stored questions to show for a typed filter (substring or any shared word).
export function filterQuestions(text, qa) {
  const t = tokens(text);
  const raw = normalise(text);
  if (!raw) return qa.answers;
  return qa.answers.filter((e) => {
    const hay = normalise([e.question, ...e.aliases].join(" "));
    return hay.includes(raw) || t.some((w) => tokens(hay).includes(w));
  });
}
