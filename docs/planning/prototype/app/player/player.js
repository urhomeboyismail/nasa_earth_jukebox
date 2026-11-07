// Accessible player (T4). Binds index.html to the sound engine and a story.
//
// Rules (FINAL rev 3 §2, CLAUDE.md rule 6):
//  - One live region. Quiet during Play: no per-step messages.
//  - At a gap end or key moment: one message, then Continue. Nothing resumes by itself.
//  - The mode switch announces itself through the screen reader. The app adds no message.
//  - Focus is never moved by the app. Buttons are never made `disabled` while they may
//    hold focus (a disabled focused button drops focus); Continue uses aria-disabled.
//  - Every control is a native button, checkbox-switch or range input.
//  - The slider moves only when playback is not running, so it does not make the
//    screen reader read out values while the user listens.
import { valueText, whereAmI, storySummary } from "./text.js";
import { mountPicture } from "./picture.js";
import { mountHides } from "./hides.js";
import { mountAsk } from "../qa/ask.js";

const SCRUB_DELAY_MS = 400;

export async function mountPlayer({ document: doc, engine, stories, fetchStory, loadQa, rng, timers = {
  // arrow functions: calling window.setTimeout as a method of another object throws in browsers
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id),
} }) {
  const $ = (id) => doc.getElementById(id);
  const el = {
    picker: $("story-picker"), play: $("play"), pause: $("pause"), cont: $("continue"), replay: $("replay"),
    where: $("where"), step: $("step"), strict: $("strict"), modeDesc: $("mode-desc"), both: $("both"),
    reference: $("reference"), test: $("test"), live: $("live"),
    orientation: $("about-orientation"), legend: $("about-legend"), sideA: $("about-side-a"), sideB: $("about-side-b"),
    eic: $("about-eic"), sources: $("about-sources"),
  };

  let story = null;
  let scrubTimer = null;
  let endHandledByStop = false;

  // ---- helpers ----
  function say(text) {
    // Setting identical text again would not be announced, so add a no-break space.
    el.live.textContent = el.live.textContent === text ? text + " " : text;
  }
  const strict = () => el.strict.checked;
  const index = () => Number(el.step.value);
  const askUi = mountAsk({ document: doc, say }); // T5: cited answers; loadQa is optional
  const picture = mountPicture({ document: doc });
  const hides = mountHides({ document: doc, engine, say, ensureUnlocked, rng }); // rng is only set by tests

  async function ensureUnlocked() {
    if (!engine.unlocked) await engine.unlock(); // inside the click that called us
  }

  function setContinue(on) {
    el.cont.setAttribute("aria-disabled", on ? "false" : "true");
  }

  function setSlider(i) {
    el.step.value = String(i);
    el.step.setAttribute("aria-valuetext", valueText(story, i));
    picture.update(i); // only called when playback is not running, so the picture stays quiet too
  }

  function showModeText() {
    el.modeDesc.textContent = strict() ? story.encoding.side_b.coarseness_statement : story.encoding.side_a.rounding_statement;
  }

  function showAbout() {
    el.orientation.textContent = story.text.orientation;
    el.legend.textContent = story.text.legend;
    el.sideA.textContent = `Musical mode: ${story.encoding.side_a.rounding_statement}`;
    el.sideB.textContent = `Strict data mode: ${story.encoding.side_b.coarseness_statement}`;
    el.eic.textContent = story.meta.eic_visualization.text;
    el.sources.replaceChildren(
      ...story.meta.sources.map((s) => {
        const li = doc.createElement("li");
        li.textContent = `${s.name}. ${s.credit}`;
        return li;
      }),
    );
  }

  async function chooseStory(entry, { announce }) {
    story = await fetchStory(entry.url);
    engine.load(story);
    picture.setStory(story);
    hides.setStory(story);
    askUi.set(loadQa ? await loadQa(entry, story) : null);
    el.step.max = String(story.steps.length - 1);
    setSlider(0);
    showModeText();
    showAbout();
    setContinue(false);
    if (announce) say(storySummary(story));
  }

  // ---- story radio group ----
  stories.forEach((entry, k) => {
    const wrap = doc.createElement("div");
    const input = doc.createElement("input");
    input.type = "radio";
    input.name = "story";
    input.id = `story-${entry.id}`;
    input.value = entry.id;
    input.checked = k === 0;
    const label = doc.createElement("label");
    label.htmlFor = input.id;
    label.textContent = entry.title;
    wrap.append(input, label);
    el.picker.append(wrap);
    input.addEventListener("change", () => input.checked && chooseStory(entry, { announce: true }));
  });

  // ---- engine events ----
  engine.on("stop", (stop) => {
    const parts = stop.reasons.map((r) => r.message);
    const isEnd = stop.type === "end";
    parts.push(isEnd ? "End of story. Press Replay to hear it again." : "Press Continue.");
    endHandledByStop = isEnd;
    setContinue(!isEnd);
    setSlider(stop.stepIndex);
    say(parts.join(" "));
  });
  engine.on("end", () => {
    if (!endHandledByStop) say("End of story. Press Replay to hear it again.");
    endHandledByStop = false;
    setContinue(false);
  });
  engine.on("state", (s) => {
    if (s === "playing") setContinue(false);
    if (s === "paused") setSlider(engine.cursor);
    // No other output: during Play nothing is written or announced.
  });

  // ---- controls ----
  el.play.addEventListener("click", async () => {
    await ensureUnlocked();
    engine.play(engine.state === "waiting" ? undefined : index());
  });
  el.pause.addEventListener("click", () => engine.pause());
  el.replay.addEventListener("click", async () => {
    await ensureUnlocked();
    setSlider(0);
    engine.play(0);
  });
  el.cont.addEventListener("click", () => {
    if (el.cont.getAttribute("aria-disabled") === "true") return say("Nothing is waiting. Press Play.");
    engine.continue();
  });
  el.where.addEventListener("click", () => {
    engine.pause(); // asked-for text pauses; resume only on Play or Continue
    say(whereAmI(story, index(), { strict: strict() }));
  });

  el.step.addEventListener("input", () => {
    const i = index();
    engine.seek(i); // moves silently; pauses if playing
    el.step.setAttribute("aria-valuetext", valueText(story, i));
    picture.update(i); // the picture follows the slider (the user is moving it, not playing)
    timers.clearTimeout(scrubTimer);
    scrubTimer = timers.setTimeout(() => {
      if (engine.unlocked) engine.preview(i); // one short note after 400 ms of no change
    }, SCRUB_DELAY_MS);
  });

  el.strict.addEventListener("change", () => {
    engine.setMode(strict() ? "B" : "A"); // silent; leaves playback paused
    showModeText();
    // No say(): the screen reader announces the switch itself.
  });

  el.both.addEventListener("click", async () => {
    await ensureUnlocked();
    const i = index();
    const r = engine.hearBothWays(i);
    say(r.silent ? `Step ${i + 1} has no value, so there is nothing to play.` : `Step ${i + 1}: Musical mode, then Strict data mode.`);
  });
  el.reference.addEventListener("click", async () => {
    await ensureUnlocked();
    say(engine.reference() ? story.baseline.statement : "This story has no reference tone.");
  });
  el.test.addEventListener("click", async () => {
    await ensureUnlocked();
    engine.testSound();
    say("Test tone played. If you heard it, sound is working.");
  });

  await chooseStory(stories[0], { announce: false });
  return { say, chooseStory, ask: askUi };
}
