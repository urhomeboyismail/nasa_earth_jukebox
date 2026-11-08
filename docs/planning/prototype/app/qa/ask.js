// "Ask a question" UI (T5). Binds the #ask-* elements to the static matcher.
// Rules (FINAL §2, §4): user-initiated only; text first; never takes focus; the answer goes
// to the one shared live region through `say`; every answer shows its source and a tag set by
// code; anything unmatched says "Not in this record."; "Read more" shows the cited facts.
import { ask as askStatic, filterQuestions, NOT_FOUND } from "./match.js";

export function mountAsk({ document: doc, say }) {
  const $ = (id) => doc.getElementById(id);
  const el = { section: $("ask-section"), form: $("ask-form"), filter: $("ask-filter"), more: $("ask-more"), list: $("ask-list") };
  let data = null; // { qa, facts, dates }
  let last = null;
  let answerProvider = null; // optional async Tier 1 (T6); falls back to the static matcher

  const setMore = (on) => el.more.setAttribute("aria-disabled", on ? "false" : "true");

  function show(result) {
    last = result;
    setMore(result.matched);
    say(result.matched ? `${result.answer} ${result.source}. ${result.confidence}.` : `${NOT_FOUND} Try one of the listed questions.`);
  }

  async function answer(question) {
    const staticResult = askStatic(question, data.qa, data.facts, data.dates);
    if (!answerProvider) return show(staticResult);
    try {
      const r = await answerProvider(question, staticResult);
      show(r || staticResult);
    } catch {
      show(staticResult);
    }
  }

  function renderList() {
    const items = filterQuestions(el.filter.value, data.qa);
    el.list.replaceChildren(
      ...items.map((e) => {
        const li = doc.createElement("li");
        const b = doc.createElement("button");
        b.type = "button";
        b.textContent = e.question;
        b.addEventListener("click", () => answer(e.question));
        li.append(b);
        return li;
      }),
    );
  }

  el.filter.addEventListener("input", () => data && renderList());
  el.form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (!data) return;
    const q = el.filter.value.trim();
    if (!q) return say("Type a question first, or choose one from the list.");
    answer(q);
  });
  el.more.addEventListener("click", () => {
    if (el.more.getAttribute("aria-disabled") === "true" || !last?.matched) return say("Ask a question first.");
    say(`${last.more} (${last.confidence})`);
  });

  return {
    // qa = { qa, facts, dates } for the chosen story, or null if it has no questions.
    set(next) {
      data = next;
      last = null;
      setMore(false);
      el.section.hidden = !next;
      el.filter.value = "";
      if (next) renderList();
      else el.list.replaceChildren();
    },
    setAnswerProvider(fn) { answerProvider = fn; },
  };
}
