// Tests for T3. Run: cd app && npm test
// The plan is tested directly. The engine is tested with a stub Tone and a fake clock,
// so no audio device or browser is needed.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import * as P from "./plan.js";
import { createEngine, NotUnlockedError } from "./engine.js";

const story = JSON.parse(readFileSync(new URL("../../contract/fixture.story.json", import.meta.url), "utf8"));

// ---------- plan ----------

test("rest steps have no pitch, only the click", () => {
  for (const mode of ["A", "B"]) {
    const seg = P.buildSegment(story, mode, 9);
    const restEvents = seg.events.filter((e) => [9, 10, 11].includes(e.step));
    assert.ok(restEvents.length >= 3);
    assert.ok(restEvents.every((e) => e.layer === "click" && e.hz === undefined), `mode ${mode}`);
  }
});

test("the click runs through a whole gap, one per step", () => {
  const seg = P.buildSegment(story, "A", 9);
  assert.deepEqual(seg.events.map((e) => e.step), [9, 10, 11]);
  assert.equal(seg.duration, 3 * P.DEFAULTS.stepSeconds);
});

test("a gap ends in a stop carrying the story's gap message", () => {
  const seg = P.buildSegment(story, "A", 9);
  assert.equal(seg.stop.type, "stop");
  assert.equal(seg.stop.stepIndex, 11);
  assert.equal(seg.stop.reasons[0].type, "gap");
  assert.equal(seg.stop.reasons[0].message, story.gaps[0].message);
});

test("every key moment is a stop, with its message", () => {
  let from = 0;
  const seen = [];
  for (let guard = 0; guard < 30; guard++) {
    const seg = P.buildSegment(story, "A", from);
    for (const r of seg.stop.reasons) if (r.type === "key_moment") seen.push(r.moment.step_index);
    if (seg.stop.type === "end") break;
    from = seg.nextIndex;
  }
  assert.deepEqual(seen, story.key_moments.map((k) => k.step_index));
});

test("walking stop to stop covers every step once, with no step skipped", () => {
  const played = [];
  let from = 0;
  for (let guard = 0; guard < 30; guard++) {
    const seg = P.buildSegment(story, "B", from);
    for (let i = seg.fromIndex; i <= seg.endIndex; i++) played.push(i);
    if (seg.stop.type === "end") break;
    from = seg.nextIndex;
  }
  assert.deepEqual(played, story.steps.map((s) => s.index));
});

test("the last note before a stop gets the 150 ms fade", () => {
  const seg = P.buildSegment(story, "A", 4); // step 8 is a key moment on a data step
  const lastNote = seg.events.filter((e) => e.layer === "pitch").at(-1);
  assert.equal(seg.stop.stepIndex, 8);
  assert.equal(lastNote.release, P.DEFAULTS.fadeSeconds);
  assert.ok(lastNote.t + lastNote.dur + lastNote.release <= seg.duration + 1e-9, "fade must finish inside the step");
});

test("never more than two layers, and notes never overlap", () => {
  for (const mode of ["A", "B"]) {
    const seg = P.buildFull(story, mode);
    assert.ok(new Set(seg.events.map((e) => e.layer)).size <= 2);
    const notes = seg.events.filter((e) => e.layer === "pitch").sort((a, b) => a.t - b.t);
    for (let i = 1; i < notes.length; i++) {
      assert.ok(notes[i - 1].t + notes[i - 1].dur + notes[i - 1].release <= notes[i].t + 1e-9, "overlap");
    }
  }
});

test("Side A pitches sit on the scale, Side B pitches are continuous", () => {
  const semis = (hz) => 12 * Math.log2(hz / P.DEFAULTS.baseHz);
  for (const s of story.steps.filter((x) => x.value !== null)) {
    const m = ((semis(P.hzSideA(story, s.value)) % 12) + 12) % 12;
    assert.ok(P.DEFAULTS.scaleSemitones.some((x) => Math.abs(x - m) < 1e-9), `A off scale at ${s.value}`);
  }
  assert.ok(Math.abs(semis(P.hzSideB(story, 63)) - semis(P.hzSideB(story, 62))) > 0, "B must change with the value");
});

test("higher value gives higher pitch in both modes", () => {
  for (const f of [P.hzSideA, P.hzSideB]) assert.ok(f(story, 80) > f(story, 44));
});

test("the story's stated rounding and coarseness match what the engine does", () => {
  const step = P.sideARoundingStep(story);
  assert.ok(story.encoding.side_a.rounding_statement.includes(String(step)), `statement must contain ${step}`);
  assert.ok(story.encoding.side_b.coarseness_statement.includes(String(P.sideBCoarseness(story))));
});

test("low-confidence steps are flagged on their note, not hidden", () => {
  const seg = P.buildSegment(story, "A", 13); // step 13 is a data step, 14 is low confidence
  assert.ok(seg.events.find((e) => e.step === 14).lowConfidence);
});

test("reference tone: baseline in the mapping, absent if no baseline", () => {
  const ref = P.referencePlan(story, "B");
  assert.equal(ref.duration, 2);
  assert.ok(Math.abs(ref.events[0].hz - P.hzSideB(story, story.baseline.value)) < 1e-9);
  const noBase = structuredClone(story);
  delete noBase.baseline;
  assert.equal(P.referencePlan(noBase, "A"), null);
});

test("both ways: A then B for the same step; a rest step stays silent", () => {
  const p = P.bothWaysPlan(story, 7);
  assert.deepEqual(p.events.map((e) => e.mode), ["A", "B"]);
  assert.ok(p.events[1].t >= p.events[0].t + p.events[0].dur);
  assert.equal(P.bothWaysPlan(story, 10).silent, true);
});

test("the full-length render is 10 s for the fixture (the backup clip length)", () => {
  assert.equal(P.buildFull(story, "A").duration, 10);
});

// ---------- engine with a stub Tone ----------

function makeStub() {
  const log = [];
  let clock = 100;
  const voice = (kind) => class {
    constructor(o) {
      this.kind = kind === "pitch" ? o.oscillator.type : "click";
      this.volume = { value: 0 };
      this.envelope = { release: 0 };
    }
    toDestination() { return this; }
    triggerAttackRelease(...a) { log.push({ voice: this.kind, a, release: this.envelope.release }); }
    triggerRelease() { log.push({ voice: this.kind, released: true }); }
  };
  const Tone = {
    start: async () => { log.push({ started: true }); },
    now: () => clock,
    Synth: voice("pitch"),
    NoiseSynth: voice("click"),
  };
  const timers = { setInterval: (fn) => { timers.fn = fn; return 1; }, clearInterval: () => { timers.fn = null; } };
  return { Tone, timers, log, advance: (s) => { clock += s; timers.fn?.(); } };
}

const noteCalls = (log) => log.filter((l) => l.a && l.voice !== "click");
const clickCalls = (log) => log.filter((l) => l.a && l.voice === "click");

test("no sound before unlock, and play() throws", () => {
  const { Tone, timers, log } = makeStub();
  const e = createEngine({ Tone, timers });
  e.load(story);
  assert.throws(() => e.play(), NotUnlockedError);
  assert.throws(() => e.testSound(), NotUnlockedError);
  assert.equal(log.length, 0, "stub must have seen nothing");
});

test("loading a story or switching mode makes no sound", async () => {
  const { Tone, timers, log } = makeStub();
  const e = createEngine({ Tone, timers });
  await e.unlock();
  e.load(story);
  e.setMode("B");
  e.setMode("A");
  assert.equal(log.filter((l) => l.a).length, 0);
});

test("play runs to the first key moment, then waits and does not resume by itself", async () => {
  const { Tone, timers, log, advance } = makeStub();
  const e = createEngine({ Tone, timers });
  const stops = [];
  e.on("stop", (s) => stops.push(s));
  await e.unlock();
  e.load(story);
  e.play();
  for (let i = 0; i < 40; i++) advance(0.1);
  assert.equal(stops.length, 1);
  assert.equal(stops[0].stepIndex, 0); // step 0 is a key moment
  assert.equal(e.state, "waiting");
  const before = log.length;
  for (let i = 0; i < 100; i++) advance(0.1); // 10 s of nothing
  assert.equal(log.length, before, "must not play anything while waiting");
  assert.equal(e.state, "waiting");
});

test("Continue walks the whole story, stopping at every key moment and gap end", async () => {
  const { Tone, timers, advance } = makeStub();
  const e = createEngine({ Tone, timers });
  const stops = [];
  let ended = false;
  e.on("stop", (s) => stops.push(s.stepIndex));
  e.on("end", () => { ended = true; });
  await e.unlock();
  e.load(story);
  e.play();
  for (let guard = 0; guard < 20 && !ended; guard++) {
    for (let i = 0; i < 80; i++) advance(0.1);
    if (e.state === "waiting") e.continue();
  }
  assert.ok(ended);
  // key moments at 0, 8, 12 and 19 (19 is the last step, so it ends the story); gap runs end at 11 and 16.
  assert.deepEqual(stops, [0, 8, 11, 12, 16, 19]);
});

test("gap steps produce clicks and no pitch in the engine", async () => {
  const { Tone, timers, log, advance } = makeStub();
  const e = createEngine({ Tone, timers });
  await e.unlock();
  e.load(story);
  e.play(9);
  for (let i = 0; i < 40; i++) advance(0.1);
  assert.equal(noteCalls(log).length, 0);
  assert.equal(clickCalls(log).length, 3);
});

test("switching mode while playing pauses silently; the cursor stays on the same step", async () => {
  const { Tone, timers, advance } = makeStub();
  const e = createEngine({ Tone, timers });
  await e.unlock();
  e.load(story);
  e.play(1);
  for (let i = 0; i < 8; i++) advance(0.1);
  const at = e.currentStep;
  assert.equal(e.state, "playing");
  e.setMode("B");
  assert.equal(e.state, "paused");
  assert.equal(e.cursor, at);
});

test("Test sound while waiting at a stop leaves the engine waiting", async () => {
  const { Tone, timers, advance } = makeStub();
  const e = createEngine({ Tone, timers });
  await e.unlock();
  e.load(story);
  e.play(9);
  for (let i = 0; i < 40; i++) advance(0.1);
  assert.equal(e.state, "waiting");
  e.testSound();
  for (let i = 0; i < 10; i++) advance(0.1);
  assert.equal(e.state, "waiting");
});

test("reference returns false when the story has no baseline", async () => {
  const { Tone, timers } = makeStub();
  const e = createEngine({ Tone, timers });
  await e.unlock();
  const s = structuredClone(story);
  delete s.baseline;
  e.load(s);
  assert.equal(e.reference(), false);
});

// ---------- every story the app ships ----------

test("every shipped story states the rounding and coarseness the engine really uses", () => {
  const list = JSON.parse(readFileSync(new URL("../stories/index.json", import.meta.url), "utf8"));
  assert.ok(list.length >= 1);
  for (const entry of list) {
    const s = JSON.parse(readFileSync(new URL(`../stories/${entry.url}`, import.meta.url), "utf8"));
    assert.ok(s.encoding.side_a.rounding_statement.includes(String(P.sideARoundingStep(s))), `${entry.id}: rounding`);
    assert.ok(s.encoding.side_b.coarseness_statement.includes(String(P.sideBCoarseness(s))), `${entry.id}: coarseness`);
    const seg = P.buildFull(s, "A");
    assert.equal(seg.events.filter((e) => e.layer === "pitch").length, s.steps.filter((x) => x.state !== "rest").length, `${entry.id}: one note per data step`);
  }
});
