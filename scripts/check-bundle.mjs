// Fails when the app's entry chunk grows past its budget, so the first load cannot grow without someone noticing (I10).
//
//   npm run build && npm run check-bundle
//
// It measures dist/assets/index-*.js, gzipped as a server would send it. Other pages, the voice guide and Tone.js load
// on demand in chunks of their own and are not counted. To raise the budget, change BUDGET_BYTES and say why in the PR.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

/** The entry chunk's gzip size after I10 (80,344 bytes, 13 Nov 2026), plus 5%. */
const BUDGET_BYTES = 84_362

const assets = fileURLToPath(new URL('../dist/assets/', import.meta.url))
let entries = []
try {
  entries = readdirSync(assets).filter(name => /^index-.*\.js$/.test(name))
} catch {
  // No dist/ yet; reported below.
}
if (entries.length !== 1) {
  console.error(`Expected one entry chunk (index-*.js) in dist/assets, found ${entries.length}. Run npm run build first.`)
  process.exit(1)
}

const name = entries[0]
const size = gzipSync(readFileSync(join(assets, name))).length
const kb = bytes => `${(bytes / 1024).toFixed(1)} KB`
if (size > BUDGET_BYTES) {
  console.error(`${name}: ${size} bytes gzip (${kb(size)}), over the budget of ${BUDGET_BYTES} bytes (${kb(BUDGET_BYTES)}) by ${size - BUDGET_BYTES}.`)
  process.exit(1)
}
console.log(`${name}: ${size} bytes gzip (${kb(size)}), within the budget of ${BUDGET_BYTES} bytes (${kb(BUDGET_BYTES)}).`)
