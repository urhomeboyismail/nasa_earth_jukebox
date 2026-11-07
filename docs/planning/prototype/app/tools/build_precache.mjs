// Builds app/precache.json: the list of every file the service worker must cache so the
// whole app works offline. Run it after any change to the app: `cd app && npm run build`.
// The version is a hash of the file contents, so a changed file makes browsers refresh.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const APP = fileURLToPath(new URL("..", import.meta.url));

// Not shipped to users: tests, tooling, dev pages, big backup clips, node_modules.
const SKIP_DIR = new Set(["node_modules", "tools", "backup", "cache"]);
const SKIP_FILE = (name) =>
  name.endsWith(".test.mjs") || name === "package.json" || name === "package-lock.json" ||
  name === "precache.json" || name === "listen.html" || name === ".gitignore" || name.endsWith(".md") ||
  name === "Tone.js.LICENSE.txt";

function walk(dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIR.has(name)) walk(full, out);
    } else if (!SKIP_FILE(name)) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(APP).map((f) => relative(APP, f).split(sep).join("/"));
const hash = createHash("sha256");
for (const f of files) hash.update(f).update(readFileSync(join(APP, f)));
const version = hash.digest("hex").slice(0, 12);

// "./" is the page itself when opened at the folder URL.
const urls = ["./", ...files];
writeFileSync(join(APP, "precache.json"), JSON.stringify({ version, urls }, null, 2) + "\n");
console.log(`precache.json: ${urls.length} urls, version ${version}`);
