// Shared helpers for the jsdom tests of T7/T8. Real index.html, real engine, stub Tone.
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { createEngine } from "../sound/engine.js";
import { mountPlayer } from "./player.js";

export const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
export const html = read("../index.html");
export const realStory = JSON.parse(read("../stories/mur-sst-mauritius-2023.story.json"));
export const fixtureStory = JSON.parse(read("../stories/fixture-a.story.json"));
export const flush = () => new Promise((r) => setImmediate(r));

export function makeStubTone() {
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
    Tone: { start: async () => {}, now: () => clock, Synth: voice("pitch"), NoiseSynth: voice("click") },
    timers, log, advance: (s) => { clock += s; timers.fn?.(); },
  };
}

// story: the story object the page loads. rng: optional, passed through window.__rng for hides.
export async function setupPage(story, { rng } = {}) {
  const dom = new JSDOM(html, { pretendToBeVisual: true });
  const { document } = dom.window;
  const stub = makeStubTone();
  const engine = createEngine({ Tone: stub.Tone, timers: stub.timers });
  const scrub = [];
  const timers = { setTimeout: (fn) => scrub.push(fn), clearTimeout: () => {} };
  let focusCalls = 0;
  dom.window.HTMLElement.prototype.focus = function () { focusCalls += 1; };
  const entry = { id: story.meta.story_id, title: story.meta.title, url: "x.json" };
  await mountPlayer({ document, engine, stories: [entry], fetchStory: async () => structuredClone(story), timers, rng });
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
