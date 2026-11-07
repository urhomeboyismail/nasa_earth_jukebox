// Sound engine (T3). Plays the events from plan.js with Tone.js.
// Tone is passed in (createEngine({ Tone })) so tests can use a stub and the app
// can load the vendored file. The engine never speaks; it reports through events
// and the player (T4) writes the words into the aria-live region.
//
// Hard rules:
//  - No sound before unlock(), and unlock() must be called from a user action.
//  - Nothing starts by itself: loading a story or switching mode makes no sound.
//  - After a stop (gap end, key moment) it waits. Only continue()/play() resumes.
//  - Two layers at most: one pitch voice at a time, plus the click.

import {
  buildSegment, referencePlan, bothWaysPlan, previewPlan, testSoundPlan, hidesPlan,
} from "./plan.js";

const LOOKAHEAD = 0.2; // seconds of audio scheduled ahead
const TICK_MS = 50;
const START_DELAY = 0.05;

export class NotUnlockedError extends Error {
  constructor() {
    super("Audio is locked. Call unlock() from a click or key press first.");
    this.name = "NotUnlockedError";
  }
}

// Wrapped in arrow functions: browsers throw "Illegal invocation" if window.setInterval
// is called as a method of another object (found in Chrome, not in Node).
const defaultTimers = {
  setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
  clearInterval: (id) => globalThis.clearInterval(id),
};

export function createEngine({ Tone, timers = defaultTimers }) {
  let story = null;
  let mode = "A";
  let unlocked = false;
  let voices = null; // { A, B, click }
  let state = "idle"; // idle | playing | paused | waiting | ended | oneshot
  let cursor = 0; // next step to play
  let current = null; // last step started
  let run = null; // { plan, t0, next, kind }
  let timer = null;
  const listeners = {};

  const emit = (name, payload) => (listeners[name] || []).forEach((fn) => fn(payload));
  const on = (name, fn) => {
    (listeners[name] ||= []).push(fn);
    return () => (listeners[name] = listeners[name].filter((f) => f !== fn));
  };
  const setState = (s) => {
    if (state !== s) {
      state = s;
      emit("state", s);
    }
  };

  async function unlock() {
    await Tone.start(); // must be inside a user gesture
    if (!voices) {
      const mkPitch = (type) =>
        new Tone.Synth({ oscillator: { type }, envelope: { attack: 0.01, decay: 0.05, sustain: 0.8, release: 0.05 } }).toDestination();
      voices = {
        A: mkPitch("triangle"),
        B: mkPitch("sine"),
        click: new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.03, sustain: 0 } }).toDestination(),
      };
      voices.click.volume.value = -18;
      voices.A.volume.value = -8;
      voices.B.volume.value = -8;
    }
    unlocked = true;
    emit("unlocked");
  }

  const needUnlock = () => {
    if (!unlocked) throw new NotUnlockedError();
  };

  function silence() {
    if (!voices) return;
    voices.A.triggerRelease(Tone.now());
    voices.B.triggerRelease(Tone.now());
  }

  function stopTimer() {
    if (timer !== null) {
      timers.clearInterval(timer);
      timer = null;
    }
  }

  function schedule(ev, at) {
    if (ev.layer === "click") {
      voices.click.triggerAttackRelease(0.03, at);
    } else {
      const v = voices[ev.timbre === "triangle" ? "A" : "B"];
      v.envelope.release = ev.release;
      v.triggerAttackRelease(ev.hz, ev.dur, at);
    }
    if (ev.step !== undefined && run.kind === "segment" && ev.step !== current) {
      current = ev.step;
      emit("step", { index: ev.step, state: story.steps[ev.step].state });
    }
  }

  function tick() {
    if (!run) return;
    const now = Tone.now();
    const { plan, t0 } = run;
    while (run.next < plan.events.length && t0 + plan.events[run.next].t <= now + LOOKAHEAD) {
      schedule(plan.events[run.next], t0 + plan.events[run.next].t);
      run.next += 1;
    }
    if (now >= t0 + plan.duration) finish();
  }

  function finish() {
    const { plan, kind } = run;
    const run_prev = run.prev;
    stopTimer();
    run = null;
    if (kind === "segment") {
      cursor = plan.nextIndex;
      if (plan.stop.type === "end") {
        setState("ended");
        // A key moment or gap on the last step still gets its message.
        if (plan.stop.reasons.length) emit("stop", plan.stop);
        emit("end", { stepIndex: plan.stop.stepIndex });
      } else {
        setState("waiting");
        emit("stop", plan.stop);
      }
    } else {
      setState(run_prev);
      emit("oneshot-end", { kind });
    }
  }

  function start(plan, kind) {
    needUnlock();
    stopTimer();
    silence();
    // A one-shot (test, reference, preview) hands the state back when it ends,
    // so a "waiting" stop is not lost if the user presses "Test sound" there.
    const prev = state === "oneshot" || state === "playing" ? "paused" : state;
    run = { plan, t0: Tone.now() + START_DELAY, next: 0, kind, prev };
    setState(kind === "segment" ? "playing" : "oneshot");
    if (plan.events.length === 0 && plan.duration === 0) {
      finish();
      return;
    }
    timer = timers.setInterval(tick, TICK_MS);
    tick();
  }

  function haltPlayback() {
    if (state === "playing") {
      stopTimer();
      silence();
      // Resume from the same step (FINAL §2: Play resumes from the same step).
      cursor = current ?? cursor;
      run = null;
      setState("paused");
    } else if (state === "oneshot") {
      stopTimer();
      silence();
      run = null;
      setState(cursor > 0 ? "paused" : "idle");
    }
  }

  return {
    on,
    unlock,
    get state() { return state; },
    get mode() { return mode; },
    get cursor() { return cursor; },
    get currentStep() { return current ?? cursor; },
    get unlocked() { return unlocked; },
    tick, // exposed for tests

    load(s) {
      haltPlayback();
      story = s;
      cursor = 0;
      current = null;
      setState("idle");
    },

    // Silent. If playing it pauses (the switch leaves playback paused).
    setMode(m) {
      if (m !== "A" && m !== "B") throw new Error("mode must be 'A' or 'B'");
      haltPlayback();
      mode = m;
      emit("mode", m);
    },

    // Move without sound (slider scrubbing, "Where am I").
    seek(i) {
      haltPlayback();
      cursor = Math.max(0, Math.min(story.steps.length - 1, i));
      current = cursor;
      setState("paused");
    },

    play(from) {
      needUnlock();
      if (!story) throw new Error("No story loaded");
      haltPlayback();
      if (from !== undefined) cursor = from;
      if (state === "ended" || cursor >= story.steps.length) cursor = 0; // Replay
      current = null;
      start(buildSegment(story, mode, cursor), "segment");
    },

    // After a stop, resume at the step after it. Same as play() from the cursor.
    continue() {
      if (state !== "waiting") return;
      this.play(cursor);
    },

    pause: haltPlayback,

    testSound() {
      haltPlayback();
      start(testSoundPlan(), "test");
    },

    reference() {
      const plan = story && referencePlan(story, mode);
      if (!plan) return false; // no baseline in the story: no reference tone
      haltPlayback();
      start(plan, "reference");
      return true;
    },

    hearBothWays(i = this.currentStep) {
      haltPlayback();
      const plan = bothWaysPlan(story, i);
      if (plan.silent) return { silent: true };
      start(plan, "both-ways");
      return { silent: false };
    },

    preview(i) {
      if (state === "playing") haltPlayback();
      const plan = previewPlan(story, i, mode);
      if (plan.silent) return { silent: true };
      start(plan, "preview");
      return { silent: false };
    },

    // "What the sound hides": play the whole series as "coarse" or "fine" (Side B).
    // A one-shot like the others: pauses live playback, never starts by itself.
    hides(version) {
      if (version !== "coarse" && version !== "fine") throw new Error("version must be 'coarse' or 'fine'");
      if (!story) throw new Error("No story loaded");
      haltPlayback();
      start(hidesPlan(story, version), "hides");
    },
  };
}
