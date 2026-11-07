// Every sentence the player shows or announces about a step is built here, from the
// story file only (CLAUDE.md rule 5). No number or name is added that the story lacks.

const sourceName = (story, id) => story.meta.sources.find((s) => s.id === id)?.name;

export function describeStep(story, i, { strict = false } = {}) {
  const s = story.steps[i];
  const n = story.steps.length;
  const unit = story.meta.unit ? ` ${story.meta.unit}` : "";
  const head = `Step ${i + 1} of ${n}, ${s.label}`;
  if (s.state === "rest") {
    return s.rest_reason === "no_frame"
      ? `${head}: no data, not zero. The source published no frame for this step.`
      : `${head}: no value played. Too little of the picture was seen (${s.coverage_pct}%).`;
  }
  let t = `${head}: ${story.meta.series_label} ${s.value}${unit}.`;
  if (s.state === "low_confidence") t += ` Low confidence: only ${s.coverage_pct}% of the picture was seen.`;
  if (strict) t += ` The colour key only gives ranges of ${story.encoding.colour_key.bin_width}${unit}.`;
  const src = sourceName(story, s.source_id);
  if (src) t += ` Source: ${src}.`;
  return t;
}

// aria-valuetext for the slider: the same words, without the strict-mode extra.
export const valueText = (story, i) => describeStep(story, i);

export function whereAmI(story, i, { strict = false } = {}) {
  let t = describeStep(story, i, { strict });
  const km = story.key_moments.find((k) => k.step_index === i);
  if (km) t += ` Key moment: ${km.title}.`;
  return t;
}

export function storySummary(story) {
  const first = story.steps[0].label;
  const last = story.steps.at(-1).label;
  return `${story.meta.title}. ${story.steps.length} steps, from ${first} to ${last}. ${story.text.orientation}`;
}
