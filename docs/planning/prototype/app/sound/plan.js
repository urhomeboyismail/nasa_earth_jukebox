// Sound plan (T3). Pure functions: story.json in, timed sound events out.
// No audio, no browser, no Tone. The engine plays these events; tests check them;
// render_backup.mjs turns them into the pre-rendered backup clip.
//
// Rules this file enforces (FINAL rev 3, CLAUDE.md rules 4 and 7):
//  - A rest step has no pitch. A short click keeps time through the gap.
//  - Only two layers ever exist: "pitch" and "click". Notes never overlap.
//  - After a gap run, and at each key moment, the segment ends in a stop.
//    The caller waits for the user (Continue). Nothing resumes on a timer.
//  - The last note before a stop gets a 150 ms release (the fade).

export const DEFAULTS = Object.freeze({
  stepSeconds: 0.5, // 20 steps = 10 s, the length of the backup clip
  fadeSeconds: 0.15,
  noteFraction: 0.8, // note length as a share of one step
  quickRelease: 0.05,
  baseHz: 220,
  octaves: 2,
  scaleSemitones: Object.freeze([0, 2, 4, 7, 9]), // major pentatonic: no clashing notes
  referenceSeconds: 2,
  bothWaysSeconds: 2,
  bothWaysGapSeconds: 0.2,
  previewSeconds: 0.4,
});

const clamp01 = (x) => Math.min(1, Math.max(0, x));

export function normalise(story, value) {
  const { domain_min: lo, domain_max: hi } = story.encoding;
  return clamp01((value - lo) / (hi - lo));
}

// Side B: continuous pitch, so equal value steps are equal musical distances.
export function hzSideB(story, value, o = DEFAULTS) {
  return o.baseHz * 2 ** (normalise(story, value) * o.octaves);
}

// Side A: the same pitch range, but snapped to a pentatonic scale.
export function hzSideA(story, value, o = DEFAULTS) {
  const degrees = o.octaves * o.scaleSemitones.length;
  const d = Math.round(normalise(story, value) * degrees);
  const oct = Math.floor(d / o.scaleSemitones.length);
  const semis = oct * 12 + o.scaleSemitones[d % o.scaleSemitones.length];
  return o.baseHz * 2 ** (semis / 12);
}

export const hzFor = (story, value, mode, o = DEFAULTS) =>
  mode === "A" ? hzSideA(story, value, o) : hzSideB(story, value, o);

// Value change that moves Side A by one scale note, on average. The story's own
// rounding statement must state this number (checked in the tests).
export function sideARoundingStep(story, o = DEFAULTS) {
  const { domain_min: lo, domain_max: hi } = story.encoding;
  return (hi - lo) / (o.octaves * o.scaleSemitones.length);
}

// Side B states the coarseness of the colour key, never "exact".
export const sideBCoarseness = (story) => story.encoding.colour_key.bin_width;

export const timbreFor = (mode) => (mode === "A" ? "triangle" : "sine");

function gapOf(story, stepIndex) {
  return story.gaps.find((g) => stepIndex >= g.start_index && stepIndex <= g.end_index);
}

// One segment: play from step `from` until the next stop (or the end).
// opts.noStops = true plays straight through (used for the backup clip only).
export function buildSegment(story, mode, from = 0, opts = {}, o = DEFAULTS) {
  const { steps } = story;
  if (from < 0 || from >= steps.length) throw new RangeError(`step ${from} is outside 0..${steps.length - 1}`);
  const events = [];
  let stop = null;
  let last = from;

  for (let i = from; i < steps.length; i++) {
    const s = steps[i];
    const t = (i - from) * o.stepSeconds;
    last = i;

    // Does this step end in a stop?
    const reasons = [];
    if (!opts.noStops) {
      const gap = gapOf(story, i);
      if (gap && gap.end_index === i) reasons.push({ type: "gap", gap, message: gap.message });
      const km = story.key_moments.find((k) => k.step_index === i);
      if (km) reasons.push({ type: "key_moment", moment: km, message: km.message });
    }
    const stopsHere = reasons.length > 0;

    if (s.state === "rest") {
      events.push({ layer: "click", t, step: i, kind: "gap_click" });
    } else {
      if (mode === "B") events.push({ layer: "click", t, step: i, kind: "step_click" });
      events.push({
        layer: "pitch",
        t,
        step: i,
        hz: hzFor(story, s.value, mode, o),
        timbre: timbreFor(mode),
        dur: o.stepSeconds * o.noteFraction - (stopsHere ? o.fadeSeconds - o.quickRelease : 0),
        release: stopsHere ? o.fadeSeconds : o.quickRelease,
        lowConfidence: s.state === "low_confidence",
      });
    }

    if (stopsHere) {
      // A stop on the very last step is the end, but its message is still shown.
      stop = { type: i === steps.length - 1 ? "end" : "stop", stepIndex: i, reasons };
      break;
    }
  }

  if (!stop) stop = { type: "end", stepIndex: last, reasons: [] };
  return {
    fromIndex: from,
    endIndex: last,
    nextIndex: last + 1,
    events,
    duration: (last - from + 1) * o.stepSeconds,
    stop,
  };
}

export const buildFull = (story, mode, o = DEFAULTS) => buildSegment(story, mode, 0, { noStops: true }, o);

// 2 s reference tone at the story's baseline, in the current mode's mapping.
export function referencePlan(story, mode, o = DEFAULTS) {
  if (!story.baseline) return null;
  return {
    events: [
      { layer: "pitch", t: 0, hz: hzFor(story, story.baseline.value, mode, o), timbre: timbreFor(mode), dur: o.referenceSeconds - o.fadeSeconds, release: o.fadeSeconds },
    ],
    duration: o.referenceSeconds,
  };
}

// "Hear this step both ways": Side A, then Side B. A rest step stays silent.
export function bothWaysPlan(story, stepIndex, o = DEFAULTS) {
  const s = story.steps[stepIndex];
  if (!s || s.state === "rest") return { events: [], duration: 0, silent: true };
  const d = o.bothWaysSeconds;
  const mk = (mode, t) => ({
    layer: "pitch", t, step: stepIndex, mode,
    hz: hzFor(story, s.value, mode, o), timbre: timbreFor(mode),
    dur: d - o.fadeSeconds, release: o.fadeSeconds,
  });
  return { events: [mk("A", 0), mk("B", d + o.bothWaysGapSeconds)], duration: 2 * d + o.bothWaysGapSeconds, silent: false };
}

// One short note for a step, for slider scrubbing and spot checks.
export function previewPlan(story, stepIndex, mode, o = DEFAULTS) {
  const s = story.steps[stepIndex];
  if (!s || s.state === "rest") return { events: [], duration: 0, silent: true };
  return {
    events: [{ layer: "pitch", t: 0, step: stepIndex, hz: hzFor(story, s.value, mode, o), timbre: timbreFor(mode), dur: o.previewSeconds - o.quickRelease, release: o.quickRelease }],
    duration: o.previewSeconds,
    silent: false,
  };
}

// ---------- T8: "What the sound hides" ----------
// The same series twice. "fine" is Side B (continuous pitch). "coarse" squeezes the whole
// pitch range into HIDES.levels levels, so small changes stop moving the pitch.
// The rule is fixed here (3 levels across the story's own domain), not tuned per story.
export const HIDES = Object.freeze({ levels: 3 });

export function coarseLevel(story, value, levels = HIDES.levels) {
  return Math.min(levels - 1, Math.floor(normalise(story, value) * levels));
}

export function hzCoarse(story, value, levels = HIDES.levels, o = DEFAULTS) {
  const mid = (coarseLevel(story, value, levels) + 0.5) / levels;
  return o.baseHz * 2 ** (mid * o.octaves);
}

// version: "coarse" | "fine". Plays straight through (no stops); rests stay silent with the click.
export function hidesPlan(story, version, levels = HIDES.levels, o = DEFAULTS) {
  const events = [];
  story.steps.forEach((s, i) => {
    const t = i * o.stepSeconds;
    events.push({ layer: "click", t, step: i, kind: s.state === "rest" ? "gap_click" : "step_click" });
    if (s.state !== "rest") {
      events.push({
        layer: "pitch", t, step: i, timbre: "sine",
        hz: version === "coarse" ? hzCoarse(story, s.value, levels, o) : hzSideB(story, s.value, o),
        dur: o.stepSeconds * o.noteFraction, release: o.quickRelease,
      });
    }
  });
  return { events, duration: story.steps.length * o.stepSeconds };
}

const round2 = (x) => Math.round(x * 100) / 100;

// Every number used in the explanation, computed from the story only.
export function hidesFacts(story, levels = HIDES.levels) {
  const data = story.steps.filter((s) => s.state !== "rest");
  const { domain_min: lo, domain_max: hi } = story.encoding;
  const pairs = [];
  for (let i = 1; i < story.steps.length; i++) {
    const a = story.steps[i - 1], b = story.steps[i];
    if (a.state !== "rest" && b.state !== "rest") pairs.push([a, b]);
  }
  const key = (hz) => hz.toFixed(6);
  return {
    levels,
    unit: story.meta.unit ?? "",
    span: round2(hi - lo),
    binSize: round2((hi - lo) / levels),
    dataSteps: data.length,
    pairs: pairs.length,
    distinctCoarse: new Set(data.map((s) => key(hzCoarse(story, s.value, levels)))).size,
    distinctFine: new Set(data.map((s) => key(hzSideB(story, s.value)))).size,
    coarseSame: pairs.filter(([a, b]) => coarseLevel(story, a.value, levels) === coarseLevel(story, b.value, levels)).length,
    fineSame: pairs.filter(([a, b]) => key(hzSideB(story, a.value)) === key(hzSideB(story, b.value))).length,
    first: data[0].value,
    last: data.at(-1).value,
    change: round2(data.at(-1).value - data[0].value),
  };
}

// The text shown on "Reveal". Numbers come only from hidesFacts. `coarseLabel` and
// `fineLabel` are the names the listener saw ("Version 1" / "Version 2").
export function hidesExplanation(story, coarseLabel, fineLabel, levels = HIDES.levels) {
  const f = hidesFacts(story, levels);
  const u = f.unit ? ` ${f.unit}` : "";
  return [
    `${coarseLabel} is the coarse one and it hides the change.`,
    `It squeezes the ${f.span}${u} pitch range into ${f.levels} levels of ${f.binSize}${u} each, so it uses only ${f.distinctCoarse} different pitches for ${f.dataSteps} readings.`,
    `${f.coarseSame} of the ${f.pairs} changes between neighbouring readings make no difference you can hear.`,
    `${fineLabel} is Strict data mode (Side B). It uses ${f.distinctFine} different pitches, and ${f.pairs - f.fineSame} of the ${f.pairs} changes move the pitch.`,
    `From the first reading (${f.first}${u}) to the last (${f.last}${u}) the series changes by ${f.change}${u}.`,
  ].join(" ");
}

export const TEST_SOUND = Object.freeze({ hz: 440, seconds: 0.5 });
export function testSoundPlan(o = DEFAULTS) {
  return { events: [{ layer: "pitch", t: 0, hz: TEST_SOUND.hz, timbre: "sine", dur: TEST_SOUND.seconds - o.fadeSeconds, release: o.fadeSeconds }], duration: TEST_SOUND.seconds };
}
