// "What the sound hides" (T8) and the listener-test helper.
//
// Two versions of the same series: a coarse one (pitch squeezed into a few levels) and
// Side B (fine). Their order is shuffled each round, and the answer stays inside this
// module until the listener presses Reveal. Guesses are logged on the page only: no network,
// no storage. The log is a practice log for the red team's "2 of 3" check in
// brainstorm/t0-lockin.md. It is NOT a study result and the page says so.
import { hidesExplanation } from "../sound/plan.js";

export function mountHides({ document: doc, engine, say, ensureUnlocked, rng = Math.random }) {
  const $ = (id) => doc.getElementById(id);
  const el = {
    play1: $("hides-play-1"), play2: $("hides-play-2"), g1: $("hides-guess-1"), g2: $("hides-guess-2"),
    reveal: $("hides-reveal"), next: $("hides-next"), result: $("hides-result"), logBody: $("hides-log-body"),
    summary: $("hides-summary"), round: $("hides-round"),
  };
  let story = null;
  let order = ["coarse", "fine"]; // order[0] is what "Version 1" plays
  let round = 0;
  let revealed = false;
  let correct = 0;
  let logged = 0;

  const label = (version) => `Version ${order.indexOf(version) + 1}`;
  const guess = () => (el.g1.checked ? 1 : el.g2.checked ? 2 : null);

  function showSummary() {
    el.summary.textContent = `${correct} of ${logged} rounds correct. This is a practice log on this page only. It is not a study result.`;
  }

  function newRound() {
    order = rng() < 0.5 ? ["coarse", "fine"] : ["fine", "coarse"];
    round += 1;
    revealed = false;
    el.g1.checked = false;
    el.g2.checked = false;
    el.result.textContent = "";
    el.result.hidden = true;
    el.round.textContent = `Round ${round}`;
  }

  async function play(k) {
    await ensureUnlocked();
    engine.hides(order[k - 1]);
  }

  function doReveal() {
    const g = guess();
    el.result.textContent = hidesExplanation(story, label("coarse"), label("fine"));
    el.result.hidden = false;
    if (g === null) {
      say("Revealed. You did not choose a version, so this round is not logged.");
      revealed = true;
      return;
    }
    const truth = order.indexOf("coarse") + 1;
    const ok = g === truth;
    if (!revealed) {
      revealed = true;
      logged += 1;
      if (ok) correct += 1;
      const tr = doc.createElement("tr");
      [String(round), `Version ${g}`, `Version ${truth}`, ok ? "Yes" : "No"].forEach((c, k) => {
        const cell = doc.createElement(k === 0 ? "th" : "td");
        if (k === 0) cell.scope = "row";
        cell.textContent = c;
        tr.append(cell);
      });
      el.logBody.append(tr);
      showSummary();
    }
    say(`${ok ? "Correct" : "Not this time"}. ${label("coarse")} hides the change.`);
  }

  el.play1.addEventListener("click", () => play(1));
  el.play2.addEventListener("click", () => play(2));
  el.reveal.addEventListener("click", doReveal);
  el.next.addEventListener("click", () => newRound());

  return {
    setStory(s) {
      story = s;
      round = 0;
      correct = 0;
      logged = 0;
      el.logBody.replaceChildren();
      newRound();
      showSummary();
    },
  };
}
