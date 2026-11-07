// Browser bootstrap. Tone is loaded by index.html as a global from vendor/Tone.js,
// so the app has no network dependency.
import { createEngine } from "../sound/engine.js";
import { mountPlayer } from "./player.js";
import { makeRemoteProvider } from "../qa/remote.js";

const fetchJson = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not load ${url}: ${r.status}`);
  return r.json();
};

const stories = await fetchJson("stories/index.json");
let player = null;
let lastQa = null;
const endpoint = new URLSearchParams(location.search).get("agent"); // optional Tier 1, e.g. ?agent=http://127.0.0.1:8787
const applyProvider = () => player?.ask.setAnswerProvider(endpoint && lastQa ? makeRemoteProvider({ endpoint, qa: lastQa.qa, facts: lastQa.facts }) : null);
player = await mountPlayer({
  document,
  engine: createEngine({ Tone }),
  stories,
  fetchStory: (url) => fetchJson(`stories/${url}`),
  // T5: cited answers. Optional: a story without `answers` simply has no Ask section.
  loadQa: async (entry, story) => {
    if (!entry.answers || !entry.facts) return null;
    const [qa, facts] = await Promise.all([fetchJson(`qa/${entry.answers}`), fetchJson(`stories/${entry.facts}`)]);
    const data = { qa, facts, dates: story.steps.map((s) => s.label) };
    lastQa = data;
    applyProvider();
    return data;
  },
});
applyProvider(); // the first story loads before `player` exists
