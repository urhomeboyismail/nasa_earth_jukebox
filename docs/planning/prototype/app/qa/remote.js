// Optional Tier 1 client (T6). Asks the agent endpoint which fact IDs answer a question,
// then renders the words HERE from the reviewed files. If the endpoint is missing, slow,
// returns anything unexpected, or the question is one the static guards refuse, the
// static result is used. The app never depends on this.
import { render } from "./match.js";

// Static refusals that must never be overridden by a model.
const HARD = new Set(["empty", "too long", "steering words", "outside what the record can answer", "date or year not in the record", "number not in the record"]);

export function makeRemoteProvider({ endpoint, qa, facts, fetchFn = (...a) => fetch(...a), timeoutMs = 2500 }) {
  const byId = Object.fromEntries(facts.facts.map((f) => [f.id, f]));
  return async function provider(question, staticResult) {
    if (!staticResult.matched && HARD.has(staticResult.reason)) return staticResult;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetchFn(`${endpoint.replace(/\/$/, "")}/ask`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question }), signal: ctl.signal,
      });
      if (!res.ok) return staticResult;
      const data = await res.json();
      const ids = Array.isArray(data.fact_ids) ? [...new Set(data.fact_ids)] : [];
      if (!ids.length || !ids.every((i) => typeof i === "string" && byId[i]) || ids.length > 3) return staticResult;
      const stored = qa.answers.find((a) => a.fact_ids.length === ids.length && ids.every((i) => a.fact_ids.includes(i)));
      const entry = stored || { id: "T1", fact_ids: ids, answer: ids.map((i) => byId[i].text).join(" ") };
      return { ...render(entry, byId), tier: "adk" };
    } catch {
      return staticResult;
    } finally {
      clearTimeout(timer);
    }
  };
}
