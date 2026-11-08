// Tests for T7 (sighted view). Run: cd app && npm test
// Automated checks only. They do not replace a look at the page in a real browser or a
// screen-reader pass (NVDA/TalkBack), which a person still has to do.
import test from "node:test";
import assert from "node:assert/strict";
import { setupPage, realStory, fixtureStory } from "./testkit.mjs";
import { valueCell } from "./picture.js";

const REST = realStory.steps.findIndex((s) => s.state === "rest");

test("step 1 shows its own frame with the short alt and a long description", async () => {
  const { $, document } = await setupPage(realStory);
  const img = $("pic-frame");
  assert.equal(img.hidden, false);
  assert.equal(img.getAttribute("src"), "stories/" + realStory.steps[0].frame);
  assert.equal(img.alt, realStory.text.alt_short);
  const desc = document.getElementById(img.getAttribute("aria-describedby"));
  assert.equal(desc.textContent, realStory.text.alt_long);
  assert.equal($("pic-panel").hidden, true);
});

test("the picture follows the slider when the user moves it", async () => {
  const { $, setValue } = await setupPage(realStory);
  setValue(4);
  assert.equal($("pic-frame").getAttribute("src"), "stories/" + realStory.steps[4].frame);
  assert.match($("pic-caption").textContent, /^Step 5 of 20: 2023-03-04$/);
});

test("a rest step shows the no-map panel and no image, never a stale frame", async () => {
  const { $, setValue } = await setupPage(realStory);
  setValue(0);
  setValue(REST);
  const img = $("pic-frame");
  assert.equal(img.hidden, true);
  assert.equal(img.hasAttribute("src"), false);
  assert.equal($("pic-panel").hidden, false);
  assert.match($("pic-panel").textContent, /No map was published for this date\. No data, not zero\./);
  assert.equal($("pic-box").hidden, true);
  setValue(REST + 1); // and it comes back
  assert.equal($("pic-frame").hidden, false);
});

test("a story without images says so and the table still has every value", async () => {
  const { $ } = await setupPage(fixtureStory);
  assert.equal($("pic-frame").hidden, true);
  assert.match($("pic-panel").textContent, /no map images/);
});

test("the indicator is aria-hidden, says whole box, and no point marker is drawn", async () => {
  const { $, document } = await setupPage(realStory);
  const box = $("pic-box");
  assert.equal(box.getAttribute("aria-hidden"), "true");
  assert.equal(box.textContent, "Whole box");
  assert.equal(document.querySelectorAll("#picture-section [aria-hidden]").length, 1, "only the box is aria-hidden");
  assert.match($("pic-region").textContent, /Each value is the average of the whole box\./);
});

test("legend and region text use only the story's numbers", async () => {
  const { $ } = await setupPage(realStory);
  assert.ok($("pic-legend").textContent.startsWith(realStory.text.legend));
  assert.match($("pic-legend").textContent, /range of 0\.15 °C/);
  const r = realStory.meta.region;
  for (const n of [r.bbox.west, r.bbox.east, r.bbox.south, r.bbox.north, r.grid.width, r.grid.height]) {
    assert.ok($("pic-region").textContent.includes(String(n)), String(n));
  }
});

// ---------- the data table ----------

test("the table has a caption, column headers, and one row per step with the story's values", async () => {
  const { $ } = await setupPage(realStory);
  const t = $("pic-table");
  assert.match(t.querySelector("caption").textContent, /^Data table: /);
  const heads = [...t.querySelectorAll("thead th")];
  assert.ok(heads.length === 6 && heads.every((h) => h.getAttribute("scope") === "col"));
  const rows = [...t.querySelectorAll("tbody tr")];
  assert.equal(rows.length, realStory.steps.length);
  rows.forEach((tr, i) => {
    const s = realStory.steps[i];
    const cells = [...tr.children].map((c) => c.textContent);
    assert.equal(tr.children[0].getAttribute("scope"), "row");
    assert.deepEqual(cells.slice(0, 2), [String(i + 1), s.label]);
    assert.equal(cells[2], s.state === "rest" ? "No data, not zero" : String(s.value));
    assert.equal(cells[3], String(s.coverage_pct));
  });
});

test("the rest row reads No data, not zero, and shows no number", async () => {
  const { $ } = await setupPage(realStory);
  const row = $("pic-table").querySelectorAll("tbody tr")[REST];
  assert.equal(row.children[2].textContent, "No data, not zero");
  assert.equal(row.children[4].textContent, "Rest (silent)");
  assert.equal(valueCell({ state: "rest", rest_reason: "low_coverage" }, "°C"), "No value played");
});

test("the table toggle flips aria-expanded, keeps one constant label, and never moves focus", async () => {
  const { $, click, focusCalls } = await setupPage(realStory);
  const b = $("pic-table-toggle");
  assert.equal(b.textContent, "Show data table");
  assert.equal(b.getAttribute("aria-expanded"), "false");
  assert.equal($("pic-table-wrap").hidden, true);
  await click("pic-table-toggle");
  assert.equal(b.getAttribute("aria-expanded"), "true");
  assert.equal($("pic-table-wrap").hidden, false);
  assert.equal(b.textContent, "Show data table", "label stays constant; the state is aria-expanded");
  await click("pic-table-toggle");
  assert.equal($("pic-table-wrap").hidden, true);
  assert.equal(focusCalls(), 0);
});

test("the current step's table row is marked", async () => {
  const { $, setValue } = await setupPage(realStory);
  setValue(3);
  const marked = [...$("pic-table").querySelectorAll("tr[aria-current]")];
  assert.equal(marked.length, 1);
  assert.equal(marked[0].children[0].textContent, "4");
});

// ---------- quiet rules ----------

test("during Play the picture and table write nothing; the live region changes only at the stop", async () => {
  const { $, click, run, setValue, liveChanges, engine } = await setupPage(realStory);
  setValue(2);
  const before = $("pic-frame").getAttribute("src");
  await click("play");
  assert.equal(engine.state, "playing");
  run(1);
  assert.equal($("pic-frame").getAttribute("src"), before, "picture does not move while playing");
  assert.equal(await liveChanges(), 0);
  await click("pic-table-toggle"); // opening the table mid-play must not write to the live region either
  assert.equal(await liveChanges(), 0);
  run(8);
  assert.equal(engine.state, "waiting");
  assert.equal(await liveChanges(), 1, "exactly one message: the stop");
});

test("exactly one live region, and axe finds no serious or critical problems with the table open", async () => {
  const { dom, document, click } = await setupPage(realStory);
  await click("pic-table-toggle");
  assert.equal(document.querySelectorAll('[aria-live], [role="status"], [role="alert"], [role="log"]').length, 1);
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  const axe = (await import("axe-core")).default;
  const res = await axe.run(dom.window.document.documentElement, { rules: { "color-contrast": { enabled: false } } });
  const bad = res.violations.filter((v) => ["serious", "critical"].includes(v.impact));
  assert.deepEqual(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`), []);
});

test("the app never moves focus while the picture changes", async () => {
  const { setValue, click, focusCalls } = await setupPage(realStory);
  for (const v of [1, 5, 9]) setValue(v);
  await click("pic-table-toggle");
  assert.equal(focusCalls(), 0);
});
