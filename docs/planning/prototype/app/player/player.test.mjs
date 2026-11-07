// Tests for T4 (accessible player). Run: cd app && npm test
// Real index.html in jsdom, real engine, stub Tone, real axe-core.
// These are automated checks. They do NOT replace the screen-reader tests in
// FINAL §13 (NVDA, TalkBack), which still have to be done by a person.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

import { createEngine } from "../sound/engine.js";
import { mountPlayer } from "./player.js";
import { describeStep, whereAmI } from "./text.js";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const story = JSON.parse(read("../stories/fixture-a.story.json"));
const html = read("../index.html");
const index = JSON.parse(read("../stories/index.json")).filter((s) => s.id === "fixture-a"); // the player tests use the invented fixture

function makeStubTone() {
  const log = [];
  let clock = 100;
  const voice = (kind) => class {
    constructor(o) { this.kind = kind === "pitch" ? o.oscillator.type : "click"; this.volume = { value: 0 }; this.envelope = { release: 0 }; }
    toDestination() { return this; }
    triggerAttackRelease(...a) { log.push({ voice: this.kind, a }); }
    triggerRelease() {}
  };
  const timers = { setInterval: (fn) => { timers.fn = fn; return 1; }, clearInterval: () => { timers.fn = null; } };
  return {
    Tone: { start: async () => { log.push({ started: true }); }, now: () => clock, Synth: voice("pitch"), NoiseSynth: voice("click") },
    timers, log, advance: (s) => { clock += s; timers.fn?.(); },
  };
}

const flush = () => new Promise((r) => setImmediate(r));

async function setup() {
  const dom = new JSDOM(html, { pretendToBeVisual: true });
  const { document } = dom.window;
  const stub = makeStubTone();
  const engine = createEngine({ Tone: stub.Tone, timers: stub.timers });
  const scrub = [];
  const timers = { setTimeout: (fn) => scrub.push(fn), clearTimeout: () => {} };
  let focusCalls = 0;
  dom.window.HTMLElement.prototype.focus = function () { focusCalls += 1; };
  await mountPlayer({ document, engine, stories: index, fetchStory: async () => structuredClone(story), timers });
  const $ = (id) => document.getElementById(id);
  const live = $("live");
  let changes = 0;
  new dom.window.MutationObserver(() => { changes += 1; }).observe(live, { childList: true, characterData: true, subtree: true });
  return {
    dom, document, $, live, engine, stub, scrub,
    click: async (id) => { $(id).click(); await flush(); },
    setValue: (v) => { $("step").value = String(v); $("step").dispatchEvent(new dom.window.Event("input", { bubbles: true })); },
    run: (seconds) => { for (let t = 0; t < seconds; t += 0.1) stub.advance(0.1); },
    liveChanges: async () => { await flush(); return changes; },
    focusCalls: () => focusCalls,
  };
}

// ---------- structure ----------

test("story choice is a real radio group with a legend", async () => {
  const { document } = await setup();
  const fs = document.getElementById("story-picker");
  assert.equal(fs.querySelector("legend").textContent, "Choose a story");
  const radios = fs.querySelectorAll('input[type="radio"]');
  assert.ok(radios.length >= 1);
  assert.ok([...radios].every((r) => r.name === "story" && document.querySelector(`label[for="${r.id}"]`)));
});

test("exactly one live region on the page", async () => {
  const { document } = await setup();
  assert.equal(document.querySelectorAll('[aria-live], [role="status"], [role="alert"], [role="log"]').length, 1);
});

test("the switch is a real checkbox with role=switch, a constant label and a description", async () => {
  const { document, $ } = await setup();
  const sw = $("strict");
  assert.equal(sw.tagName, "INPUT");
  assert.equal(sw.getAttribute("role"), "switch");
  assert.equal(document.querySelector('label[for="strict"]').textContent, "Strict data mode");
  assert.ok(document.getElementById(sw.getAttribute("aria-describedby")).textContent.length > 10);
});

test("every control is a native element with an accessible name", async () => {
  const { document } = await setup();
  for (const b of document.querySelectorAll("button")) assert.ok(b.textContent.trim().length > 0);
  assert.equal(document.querySelectorAll("[tabindex]").length, 0, "no custom tab order");
  assert.equal(document.querySelectorAll('[onclick], [role="button"]').length, 0);
});

test("axe finds no serious or critical problems (colour contrast is not testable in jsdom)", async () => {
  const { dom } = await setup();
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  const axe = (await import("axe-core")).default;
  const res = await axe.run(dom.window.document.documentElement, { rules: { "color-contrast": { enabled: false } } });
  const bad = res.violations.filter((v) => ["serious", "critical"].includes(v.impact));
  assert.deepEqual(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`), []);
});

// ---------- the slider ----------

test("slider has sourced aria-valuetext and spans every step", async () => {
  const { $ } = await setup();
  assert.equal($("step").max, String(story.steps.length - 1));
  assert.match($("step").getAttribute("aria-valuetext"), /^Step 1 of 20, Fixture step 01: fixture amount 80 fixture units\. Source: Hand-made fixture/);
});

test("a rest step reads as no data, not zero", async () => {
  const { $, setValue } = await setup();
  setValue(10);
  assert.match($("step").getAttribute("aria-valuetext"), /no data, not zero/);
});

test("the sentence builders use only words and numbers from the story", () => {
  const sentence = whereAmI(story, 14, { strict: true });
  assert.match(sentence, /Low confidence: only 65%/);
  assert.match(sentence, /ranges of 5 fixture units/);
  assert.match(describeStep(story, 16), /Too little of the picture was seen \(30%\)/);
});

// ---------- the live-region rules ----------

test("nothing is announced on load, and no sound starts before a user action", async () => {
  const { stub, live, liveChanges } = await setup();
  assert.equal(live.textContent, "");
  assert.equal(await liveChanges(), 0);
  assert.equal(stub.log.length, 0);
});

test("quiet during Play: the only message is the one at the stop", async () => {
  const { click, run, live, liveChanges, stub, engine, setValue } = await setup();
  setValue(1);
  await click("play");
  assert.equal(engine.state, "playing");
  run(2); // steps 2 to 5 play, no stop yet
  assert.equal(await liveChanges(), 0, "nothing may be written while playing");
  run(5); // reaches the key moment at step 9
  assert.equal(engine.state, "waiting");
  assert.equal(await liveChanges(), 1);
  assert.match(live.textContent, /^Step 9: the value has fallen to 63 fixture units\. Next come three steps with no data\. Press Continue\.$/);
  assert.ok(stub.log.some((l) => l.a), "sound did play");
});

test("at a gap end: one message with the gap text, then Continue works", async () => {
  const { $, click, run, live, engine, setValue } = await setup();
  setValue(9);
  await click("play");
  run(2);
  assert.equal(engine.state, "waiting");
  assert.match(live.textContent, /^Steps 10 to 12: no data, not zero\./);
  assert.equal($("continue").getAttribute("aria-disabled"), "false");
  await click("continue");
  assert.equal(engine.state, "playing");
  assert.equal($("continue").getAttribute("aria-disabled"), "true");
});

test("Continue with nothing waiting says so and does nothing else", async () => {
  const { click, live, engine } = await setup();
  await click("continue");
  assert.match(live.textContent, /Nothing is waiting/);
  assert.notEqual(engine.state, "playing");
});

test("the app never moves focus", async () => {
  const { click, run, focusCalls, setValue } = await setup();
  setValue(9);
  for (const id of ["play", "pause", "where", "both", "reference", "test", "replay"]) await click(id);
  setValue(9);
  await click("play");
  run(5);
  await click("continue");
  assert.equal(focusCalls(), 0);
});

// ---------- the switch ----------

test("the switch changes mode silently and leaves playback paused", async () => {
  const { $, click, run, live, engine, liveChanges, setValue } = await setup();
  setValue(1);
  await click("play");
  run(1);
  assert.equal(engine.state, "playing");
  const before = await liveChanges();
  $("strict").click();
  assert.equal(engine.mode, "B");
  assert.equal(engine.state, "paused");
  assert.equal(await liveChanges(), before, "the app must add no message");
  assert.match($("mode-desc").textContent, /ranges of 5 fixture units/);
  assert.equal(live.textContent, "");
});

// ---------- asked-for text ----------

test("Where am I pauses playback, then writes the step", async () => {
  const { click, run, live, engine, setValue } = await setup();
  setValue(2);
  await click("play");
  run(0.6);
  await click("where");
  assert.equal(engine.state, "paused");
  assert.match(live.textContent, /^Step \d+ of 20, Fixture step \d\d: fixture amount/);
});

test("Where am I on a key moment names it", async () => {
  const { click, live, setValue } = await setup();
  setValue(8);
  await click("where");
  assert.match(live.textContent, /Key moment: Before the silence\.$/);
});

test("Hear this step both ways on a rest step says there is nothing to play", async () => {
  const { click, live, stub, setValue } = await setup();
  setValue(10);
  await click("both");
  assert.match(live.textContent, /Step 11 has no value, so there is nothing to play/);
  assert.equal(stub.log.filter((l) => l.a).length, 0);
});

test("Test sound unlocks audio and says what it did", async () => {
  const { click, live, engine } = await setup();
  await click("test");
  assert.equal(engine.unlocked, true);
  assert.match(live.textContent, /Test tone played/);
});

test("scrubbing plays one short note only after the 400 ms delay", async () => {
  const { click, scrub, stub, setValue } = await setup();
  await click("test");
  const before = stub.log.filter((l) => l.a).length;
  for (const v of [3, 4, 5]) setValue(v);
  assert.equal(stub.log.filter((l) => l.a).length, before, "no sound while scrubbing");
  scrub.at(-1)(); // the timer fires
  assert.equal(stub.log.filter((l) => l.a).length, before + 1);
});

test("the story shipped in app/ is the same as the contract fixture", () => {
  assert.equal(read("../stories/fixture-a.story.json"), read("../../contract/fixture.story.json"));
});
