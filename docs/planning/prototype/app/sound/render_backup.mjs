// Pre-rendered backup clip (T3). Renders a whole story, straight through, to a mono WAV.
// Usage: node sound/render_backup.mjs STORY.json OUT.wav [A|B]
// It uses the same plan as the live engine, so pitches and gaps match. The timbre is a
// plain triangle (A) or sine (B) with a short envelope, so it will sound close to, not
// identical to, the Tone.js voice. Use it only as the stage fallback.
import { readFileSync, writeFileSync } from "node:fs";
import { buildFull } from "./plan.js";

const [storyPath, outPath, modeArg = "A"] = process.argv.slice(2);
if (!storyPath || !outPath || !["A", "B"].includes(modeArg)) {
  console.error("Usage: node sound/render_backup.mjs STORY.json OUT.wav [A|B]");
  process.exit(2);
}

const story = JSON.parse(readFileSync(storyPath, "utf8"));
const seg = buildFull(story, modeArg);
const RATE = 22050;
const total = Math.ceil(seg.duration * RATE);
const out = new Float32Array(total);

const triangle = (ph) => 2 * Math.abs(2 * (ph - Math.floor(ph + 0.5))) - 1;
let seed = 12345; // fixed seed: the same story always renders the same clip
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;

for (const ev of seg.events) {
  const start = Math.round(ev.t * RATE);
  if (ev.layer === "click") {
    const n = Math.round(0.03 * RATE);
    for (let k = 0; k < n && start + k < total; k++) out[start + k] += 0.12 * rand() * (1 - k / n) ** 2;
  } else {
    const n = Math.round((ev.dur + ev.release) * RATE);
    const atk = Math.round(0.01 * RATE);
    const rel = Math.round(ev.release * RATE);
    for (let k = 0; k < n && start + k < total; k++) {
      const ph = (ev.hz * k) / RATE;
      const wave = ev.timbre === "triangle" ? triangle(ph) : Math.sin(2 * Math.PI * ph);
      const env = Math.min(1, k / atk) * (k > n - rel ? Math.max(0, (n - k) / rel) : 1);
      out[start + k] += 0.35 * wave * env;
    }
  }
}

const pcm = Buffer.alloc(total * 2);
for (let i = 0; i < total; i++) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, out[i])) * 32767), i * 2);
const head = Buffer.alloc(44);
head.write("RIFF", 0); head.writeUInt32LE(36 + pcm.length, 4); head.write("WAVE", 8);
head.write("fmt ", 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22);
head.writeUInt32LE(RATE, 24); head.writeUInt32LE(RATE * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34);
head.write("data", 36); head.writeUInt32LE(pcm.length, 40);
writeFileSync(outPath, Buffer.concat([head, pcm]));
console.log(`wrote ${outPath}: ${seg.duration.toFixed(1)} s, Side ${modeArg}, ${seg.events.length} events`);
