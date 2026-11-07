// Sighted view (T7): the map frame for the current step, a "whole box" indicator, a text
// legend and a real data table. Everything shown here comes from the story file.
//
// Rules:
//  - Never writes to the live region and never moves focus.
//  - The player calls update() only when playback is not running (same quiet rule as the slider).
//  - The indicator is aria-hidden and says "whole box": each value is an average over the
//    whole area, so no point on the map is marked as if a place were measured.
//  - A step with no frame shows an explicit "no map" panel, never a stale picture.
//  - The data table is the screen-reader and braille equivalent of the picture.

const STATE_TEXT = { data: "Data", low_confidence: "Low confidence", rest: "Rest (silent)" };

export function valueCell(step, unit) {
  if (step.state !== "rest") return `${step.value}${unit ? " " + unit : ""}`;
  return step.rest_reason === "no_frame" ? "No data, not zero" : "No value played";
}

export function mountPicture({ document: doc, storiesBase = "stories/" }) {
  const $ = (id) => doc.getElementById(id);
  const el = {
    frame: $("pic-frame"), panel: $("pic-panel"), caption: $("pic-caption"), desc: $("pic-desc"),
    legend: $("pic-legend"), region: $("pic-region"), toggle: $("pic-table-toggle"), tableWrap: $("pic-table-wrap"),
    table: $("pic-table"), box: $("pic-box"),
  };
  let story = null;
  let rows = [];

  function buildTable() {
    const unit = story.meta.unit ? ` (${story.meta.unit})` : "";
    const t = el.table;
    t.replaceChildren();
    const cap = doc.createElement("caption");
    cap.textContent = `Data table: ${story.meta.title}`;
    const thead = doc.createElement("thead");
    const hr = doc.createElement("tr");
    for (const h of ["Step", "Date", `Value${unit}`, "Coverage (%)", "State", "Source"]) {
      const th = doc.createElement("th");
      th.scope = "col";
      th.textContent = h;
      hr.append(th);
    }
    thead.append(hr);
    const tbody = doc.createElement("tbody");
    rows = story.steps.map((s) => {
      const tr = doc.createElement("tr");
      const cells = [String(s.index + 1), s.label, valueCell(s, ""), String(s.coverage_pct), STATE_TEXT[s.state], s.source_id ?? "None"];
      cells.forEach((c, k) => {
        const cell = doc.createElement(k === 0 ? "th" : "td");
        if (k === 0) cell.scope = "row";
        cell.textContent = c;
        tr.append(cell);
      });
      tbody.append(tr);
      return tr;
    });
    t.append(cap, thead, tbody);
    const used = [...new Set(story.steps.map((s) => s.source_id).filter(Boolean))];
    const names = used.map((id) => `${id} is ${story.meta.sources.find((x) => x.id === id)?.name}`);
    $("pic-sources").textContent = names.length ? `Sources in this table: ${names.join(". ")}.` : "";
  }

  function setStory(s) {
    story = s;
    buildTable();
    const unit = s.meta.unit ? ` ${s.meta.unit}` : "";
    el.legend.textContent = `${s.text.legend} Each colour stands for a range of ${s.encoding.colour_key.bin_width}${unit}.`;
    const r = s.meta.region;
    el.region.textContent = r
      ? `The picture shows ${r.name}: west ${r.bbox.west} to east ${r.bbox.east} degrees, south ${r.bbox.south} to north ${r.bbox.north} degrees (${r.grid.width} by ${r.grid.height} map points). Each value is the average of the whole box.`
      : "";
    el.desc.textContent = s.text.alt_long;
    el.toggle.setAttribute("aria-expanded", "false");
    el.tableWrap.hidden = true;
    update(0);
  }

  function update(i) {
    if (!story) return;
    const s = story.steps[i];
    const hasFrames = story.steps.some((x) => x.frame);
    rows.forEach((tr, k) => (k === i ? tr.setAttribute("aria-current", "true") : tr.removeAttribute("aria-current")));
    el.caption.textContent = `Step ${i + 1} of ${story.steps.length}: ${s.label}`;
    if (s.frame) {
      el.frame.src = storiesBase + s.frame;
      el.frame.alt = story.text.alt_short;
      el.frame.hidden = false;
      el.box.hidden = false;
      el.panel.hidden = true;
    } else {
      el.frame.removeAttribute("src");
      el.frame.alt = "";
      el.frame.hidden = true;
      el.box.hidden = true;
      el.panel.hidden = false;
      el.panel.textContent = !hasFrames
        ? "This story has no map images. The data table has every value."
        : s.rest_reason === "no_frame"
          ? "No map was published for this date. No data, not zero."
          : "Too little of the area was seen, so no map is shown.";
    }
  }

  el.toggle.addEventListener("click", () => {
    const open = el.toggle.getAttribute("aria-expanded") !== "true";
    el.toggle.setAttribute("aria-expanded", String(open));
    el.tableWrap.hidden = !open;
  });

  return { setStory, update };
}
