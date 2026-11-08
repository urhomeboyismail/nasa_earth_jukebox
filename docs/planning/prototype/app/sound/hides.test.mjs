// Tests for T8 ("What the sound hides") and the listener-test helper.
// These prove the mechanics. They are NOT a listener result: the "2 of 3" check in
// brainstorm/t0-lockin.md needs a person who does not know which version is which.
import test from "node:test";
import assert from "node:assert/strict";
import * as P from "./plan.js";
import { createEngine, NotUnlockedError } from "./engine.js";
import { setupPage, makeStubTone, realStory, fixtureStory } from "../player/testkit.mjs";

const stories = { real: realStory, fixture: fixtureStory };

// ---------- plan ----------

for (const [name, story] of Object.entries(stories)) {
  test(`${name}: the coarse version uses fewer distinct pitches than the fine one`, () => {
    const f = P.hidesFacts(story);
    assert.ok(f.distinctCoarse < f.distinctFine, JSON.stringify(f));
    const pitches = (v) => new Set(P.hidesPlan(story, v).events.filter((e) => e.layer === "pitch").map((e) => e.hz.toFixed(6))).size;
    assert.equal(pitches("coarse"), f.distinctCoarse);
    assert.equal(pitches("fine"), f.distinctFine);
  });

  test(`${name}: both versions have identical timing and steps, and the same silent rests`, () => {
    const a = P.hidesPlan(story, "coarse");
    const b = P.hidesPlan(story, "fine");
    assert.equal(a.duration, b.duration);
    const shape = (p) => p.events.map((e) => `${e.layer}@${e.t}#${e.step}`);
    assert.deepEqual(shape(a), shape(b));
    story.steps.forEach((s, i) => {
      if (s.state === "rest") {
        for (const p of [a, b]) assert.ok(p.events.filter((e) => e.step === i).every((e) => e.layer === "click"), `step ${i}`);
      }
    });
  });

  test(`${name}: only the two allowed layers are used`, () => {
    for (const v of ["coarse", "fine"]) {
      assert.ok(P.hidesPlan(story, v).events.every((e) => e.layer === "pitch" || e.layer === "click"));
    }
  });

  test(`${name}: every number in the explanation is computed from the story`, () => {
    const f = P.hidesFacts(story);
    const text = P.hidesExplanation(story, "Version 1", "Version 2");
    const allowed = new Set([
      f.levels, f.span, f.binSize, f.distinctCoarse, f.distinctFine, f.dataSteps, f.pairs,
      f.coarseSame, f.pairs - f.fineSame, f.first, f.last, f.change,
    ].map(String));
    const nums = text.replace(/Version [12]/g, "").match(/-?\d+(?:\.\d+)?/g) ?? [];
    assert.ok(nums.length >= 8);
    for (const n of nums) assert.ok(allowed.has(n), `unexpected number ${n} in: ${text}`);
  });
}

test("the real story's explanation figures are the ones in the story file", () => {
  const f = P.hidesFacts(realStory);
  const vals = realStory.steps.filter((s) => s.value !== null).map((s) => s.value);
  assert.equal(f.first, vals[0]);
  assert.equal(f.last, vals.at(-1));
  assert.equal(f.change, Math.round((vals.at(-1) - vals[0]) * 100) / 100);
  assert.equal(f.dataSteps, 19);
  assert.equal(f.levels, 3);
  assert.equal(f.binSize, Math.round(((realStory.encoding.domain_max - realStory.encoding.domain_min) / 3) * 100) / 100);
});

test("coarse pitch is flat inside a level and changes only across a level edge", () => {
  const s = realStory;
  const w = (s.encoding.domain_max - s.encoding.domain_min) / 3;
  const edge = s.encoding.domain_min + w;
  assert.equal(P.hzCoarse(s, edge + 0.1), P.hzCoarse(s, edge + w - 0.1));
  assert.notEqual(P.hzCoarse(s, edge - 0.1), P.hzCoarse(s, edge + 0.1));
});

// ---------- engine ----------

test("hides() needs an unlocked engine and a loaded story, and makes no sound by itself", async () => {
  const { Tone, timers, log } = makeStubTone();
  const e = createEngine({ Tone, timers });
  e.load(realStory);
  assert.throws(() => e.hides("coarse"), NotUnlockedError);
  await e.unlock();
  assert.equal(log.filter((l) => l.a).length, 0);
  assert.throws(() => e.hides("loud"), /version/);
});

test("hides() pauses live playback and plays only pitch and click voices", async () => {
  const { Tone, timers, log, advance } = makeStubTone();
  const e = createEngine({ Tone, timers });
  await e.unlock();
  e.load(realStory);
  e.play(2);
  for (let i = 0; i < 6; i++) advance(0.1);
  assert.equal(e.state, "playing");
  e.hides("coarse");
  assert.equal(e.state, "oneshot");
  for (let i = 0; i < 120; i++) advance(0.1);
  assert.equal(e.state, "paused", "back to paused when it ends");
  assert.deepEqual([...new Set(log.filter((l) => l.a).map((l) => l.voice))].sort(), ["click", "sine", "triangle"].filter((v) => v !== "triangle" || log.some((l) => l.voice === "triangle")));
});

test("both versions play every data step once, and the gap step only clicks", async () => {
  for (const v of ["coarse", "fine"]) {
    const { Tone, timers, log, advance } = makeStubTone();
    const e = createEngine({ Tone, timers });
    await e.unlock();
    e.load(realStory);
    e.hides(v);
    for (let i = 0; i < 120; i++) advance(0.1);
    assert.equal(log.filter((l) => l.a && l.voice === "sine").length, 19, v);
    assert.equal(log.filter((l) => l.a && l.voice === "click").length, 20, v);
  }
});

// ---------- UI and the listener helper ----------

const hzOfFirstNote = (log) => log.find((l) => l.a && l.voice === "sine").a[0];

test("nothing in the page reveals which version is coarse before Reveal", async () => {
  const { dom, $ } = await setupPage(realStory, { rng: () => 0.1 });
  const sectionHtml = dom.window.document.getElementById("hides-section").outerHTML.toLowerCase();
  assert.ok(!sectionHtml.includes("coarse") && !sectionHtml.includes("fine"));
  assert.equal($("hides-result").hidden, true);
  assert.equal($("hides-result").textContent, "");
});

test("the order is shuffled: rng decides which button plays the coarse version", async () => {
  const coarse = P.hzCoarse(realStory, realStory.steps[0].value);
  const fine = P.hzSideB(realStory, realStory.steps[0].value);
  for (const [rngValue, v1, v2] of [[0.1, coarse, fine], [0.9, fine, coarse]]) {
    const a = await setupPage(realStory, { rng: () => rngValue });
    await a.click("hides-play-1");
    assert.ok(Math.abs(hzOfFirstNote(a.stub.log) - v1) < 1e-9, `rng ${rngValue} version 1`);
    const b = await setupPage(realStory, { rng: () => rngValue });
    await b.click("hides-play-2");
    assert.ok(Math.abs(hzOfFirstNote(b.stub.log) - v2) < 1e-9, `rng ${rngValue} version 2`);
  }
});

test("a correct guess is logged, reveals the text, and says so once in the live region", async () => {
  const { $, click, live, liveChanges } = await setupPage(realStory, { rng: () => 0.1 }); // Version 1 is coarse
  $("hides-guess-1").checked = true;
  await click("hides-reveal");
  assert.equal($("hides-result").hidden, false);
  assert.match($("hides-result").textContent, /^Version 1 is the coarse one and it hides the change\./);
  assert.match($("hides-result").textContent, /Version 2 is Strict data mode/);
  assert.equal(live.textContent, "Correct. Version 1 hides the change.");
  assert.equal(await liveChanges(), 1);
  const rows = [...$("hides-log-body").querySelectorAll("tr")].map((r) => [...r.children].map((c) => c.textContent));
  assert.deepEqual(rows, [["1", "Version 1", "Version 1", "Yes"]]);
  assert.match($("hides-summary").textContent, /^1 of 1 rounds correct\. This is a practice log on this page only\. It is not a study result\.$/);
});

test("a wrong guess is logged as No, and revealing twice does not log twice", async () => {
  const { $, click } = await setupPage(realStory, { rng: () => 0.9 }); // Version 2 is coarse
  $("hides-guess-1").checked = true;
  await click("hides-reveal");
  await click("hides-reveal");
  const rows = [...$("hides-log-body").querySelectorAll("tr")].map((r) => [...r.children].map((c) => c.textContent));
  assert.deepEqual(rows, [["1", "Version 1", "Version 2", "No"]]);
  assert.match($("hides-summary").textContent, /^0 of 1 /);
});

test("revealing without a guess shows the text but logs nothing", async () => {
  const { $, click, live } = await setupPage(realStory, { rng: () => 0.1 });
  await click("hides-reveal");
  assert.equal($("hides-result").hidden, false);
  assert.equal($("hides-log-body").children.length, 0);
  assert.match(live.textContent, /not logged/);
});

test("a new round clears the guess and the result, and counts three rounds for the red team", async () => {
  const { $, click } = await setupPage(realStory, { rng: () => 0.1 });
  for (let r = 1; r <= 3; r++) {
    assert.equal($("hides-round").textContent, `Round ${r}`);
    $(r === 2 ? "hides-guess-2" : "hides-guess-1").checked = true; // right, wrong, right
    await click("hides-reveal");
    await click("hides-next");
    assert.equal($("hides-result").hidden, true);
    assert.equal($("hides-guess-1").checked || $("hides-guess-2").checked, false);
  }
  assert.match($("hides-summary").textContent, /^2 of 3 rounds correct\./);
});

test("Play version 1 unlocks audio from the click and no focus is moved", async () => {
  const { click, engine, focusCalls } = await setupPage(realStory, { rng: () => 0.1 });
  assert.equal(engine.unlocked, false);
  await click("hides-play-1");
  assert.equal(engine.unlocked, true);
  assert.equal(focusCalls(), 0);
});

test("the section is plain native controls: two buttons, a radio group with a legend, two buttons", async () => {
  const { document } = await setupPage(realStory);
  const sec = document.getElementById("hides-section");
  assert.equal(sec.querySelectorAll("button").length, 4);
  assert.equal(sec.querySelector("fieldset legend").textContent, "Which version hides the change?");
  assert.equal(sec.querySelectorAll('input[type="radio"]').length, 2);
  assert.equal(sec.querySelectorAll("[tabindex], [onclick], [role=button]").length, 0);
});
