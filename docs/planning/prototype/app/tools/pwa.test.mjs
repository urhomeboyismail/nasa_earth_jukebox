// T9 tests: is the app installable and complete offline? Run after `npm run build`.
// These check files. The real offline run (airplane mode on a phone) is a manual step in DEPLOY.md.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const APP = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(APP, p), "utf8");

// Rebuild first so the test checks what a deploy would ship.
execFileSync(process.execPath, [join(APP, "tools/build_precache.mjs")], { stdio: "pipe" });
const pre = JSON.parse(read("precache.json"));

test("precache lists the page, script, styles, Tone.js, manifest and icons", () => {
  for (const must of ["./", "index.html", "player/main.js", "player/player.js", "player/styles.css", "sound/engine.js", "sound/plan.js", "vendor/Tone.js", "manifest.webmanifest", "sw.js", "icons/icon-192.png", "icons/icon-512.png", "stories/index.json"]) {
    assert.ok(pre.urls.includes(must), `missing from precache: ${must}`);
  }
});

test("every listed file exists, and nothing for tests or dev is shipped", () => {
  for (const u of pre.urls.filter((x) => x !== "./")) assert.ok(existsSync(join(APP, u)), `listed but missing: ${u}`);
  assert.ok(!pre.urls.some((u) => /\.test\.mjs$|node_modules|^tools\/|listen\.html|^sound\/backup|package(-lock)?\.json$/.test(u)));
});

test("every story in the index, with its facts and frames, is precached", () => {
  const list = JSON.parse(read("stories/index.json"));
  for (const e of list) {
    assert.ok(pre.urls.includes(`stories/${e.url}`), e.url);
    if (e.facts) assert.ok(pre.urls.includes(`stories/${e.facts}`), e.facts);
    const story = JSON.parse(read(`stories/${e.url}`));
    for (const s of story.steps) if (s.frame) assert.ok(pre.urls.includes(`stories/${s.frame}`), `frame ${s.frame}`);
  }
});

test("every local module imported by the shipped scripts is precached", () => {
  const seen = new Set();
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    assert.ok(pre.urls.includes(file), `import not precached: ${file}`);
    if (!file.endsWith(".js")) return;
    for (const m of read(file).matchAll(/(?:import|from)\s*["'](\.{1,2}\/[^"']+)["']/g)) {
      walk(normalize(join(dirname(file), m[1])).split("\\").join("/"));
    }
  };
  walk("player/main.js");
});

test("index.html links the manifest and registers the service worker", () => {
  const html = read("index.html");
  assert.match(html, /<link[^>]+rel="manifest"[^>]+manifest\.webmanifest/);
  assert.match(html, /serviceWorker\.register\(["']sw\.js["']/);
  for (const m of html.matchAll(/(?:src|href)="([^"#?:]+)"/g)) {
    if (m[1].startsWith("http")) assert.fail(`external resource in index.html: ${m[1]}`);
  }
});

test("manifest is installable: name, start_url, standalone, 192 and 512 icons that exist", () => {
  const m = JSON.parse(read("manifest.webmanifest"));
  assert.ok(m.name && m.short_name && m.start_url && m.display === "standalone");
  const sizes = m.icons.map((i) => i.sizes);
  assert.ok(sizes.includes("192x192") && sizes.includes("512x512"));
  for (const i of m.icons) assert.ok(existsSync(join(APP, i.src)), i.src);
});

test("the service worker only handles same-origin GET requests", () => {
  const sw = read("sw.js");
  assert.match(sw, /origin !== self\.location\.origin/);
  assert.match(sw, /req\.method !== "GET"/);
});

test("the app loads nothing from the network that it does not ship (no CDN, no API key)", () => {
  for (const f of ["index.html", "player/main.js", "player/player.js", "sound/engine.js"]) {
    const code = read(f).replace(/\s\/\/ .*$/gm, ""); // ignore trailing comments (e.g. the ?agent= example)
    assert.ok(!/https?:\/\/(?!www\.w3\.org)/.test(code), `${f} references an external URL`);
  }
});
