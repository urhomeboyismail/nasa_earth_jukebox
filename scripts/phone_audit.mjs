// Phone layout audit (LY01): opens each page at phone sizes in a real browser and measures what breaks.
// Needs the dev server running (`npm run dev`), then: `npm run phone-audit [-- <baseUrl> <outDir>]`.
// It uses Playwright's own Chromium if installed (`npx playwright install chromium`), else Chrome, else Edge.
// Writes a screenshot of the first screen per page and size, a full-page shot at 360 px, and report.json, then prints a summary.

import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'

const base = process.argv[2] || 'http://localhost:5173/'
const out = process.argv[3] || join(tmpdir(), 'phone-audit')
mkdirSync(out, { recursive: true })

const sizes = [
  { name: '360', width: 360, height: 740 },
  { name: '320', width: 320, height: 640 },
  { name: '390', width: 390, height: 844 },
]
const routes = ['welcome', 'home', 'learn', 'listen', 'compare', 'compare?test=1', 'about']

// Runs in the page.
function measure() {
  const vw = document.documentElement.clientWidth
  const vh = window.innerHeight
  const visible = el => {
    const s = getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  const label = el => {
    const name = el.getAttribute('aria-label') || el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40) || el.getAttribute('title') || ''
    const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''
    return `${el.tagName.toLowerCase()}${cls} "${name}"`
  }
  // Sticking out of a scrolling or clipping box is fine (the only allowed sideways scroll, WCAG 1.4.10).
  const clipped = el => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) return true
    return false
  }
  const offscreen = r => r.right > vw + 1 || r.left < -1
  const res = { vw, scrollWidth: document.documentElement.scrollWidth, pageHeight: document.documentElement.scrollHeight }

  res.overflow = []
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || clipped(el)) continue
    const r = el.getBoundingClientRect()
    if (offscreen(r) && !(el.parentElement && offscreen(el.parentElement.getBoundingClientRect()))) res.overflow.push(`${label(el)} left=${Math.round(r.left)} right=${Math.round(r.right)}`)
  }

  res.smallTargets = []
  const sel = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=slider], [role=tab], [role=switch], [role=radio], [role=checkbox], [tabindex="0"]'
  for (const el of document.querySelectorAll(sel)) {
    if (!visible(el)) continue
    // Keyboard-only buttons that appear on focus (visually hidden until then) have no touch target to measure.
    if (getComputedStyle(el).clipPath.startsWith('inset(50%')) continue
    // Links inside running text are exempt from target size (WCAG 2.5.8).
    if (el.tagName === 'A' && getComputedStyle(el).display === 'inline' && el.closest('p, li')) continue
    let r = el.getBoundingClientRect()
    if (el.matches('input[type=checkbox], input[type=radio]') && el.closest('label')) r = el.closest('label').getBoundingClientRect()
    const w = Math.round(r.width), h = Math.round(r.height)
    if (w < 44 || h < 44) res.smallTargets.push(`${w}x${h}${w < 24 || h < 24 ? ' (FAILS WCAG 2.5.8)' : ''} ${label(el)}`)
  }

  // Under 16 px, iOS zooms the page when the field gets focus.
  res.smallInputs = []
  for (const el of document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]), select, textarea')) {
    if (visible(el) && parseFloat(getComputedStyle(el).fontSize) < 16) res.smallInputs.push(`${getComputedStyle(el).fontSize} ${label(el)}`)
  }

  const tiny = new Set()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const el = walker.currentNode.parentElement
    if (walker.currentNode.textContent.trim() && el && visible(el) && parseFloat(getComputedStyle(el).fontSize) < 12) tiny.add(`${getComputedStyle(el).fontSize} ${label(el)}`)
  }
  res.tinyText = [...tiny].slice(0, 15)

  // Fixed things (bars, floating buttons, the mascot), which of them overlap, and how much of the first screen they cover.
  const fixed = []
  for (const el of document.querySelectorAll('body *')) {
    if (visible(el) && getComputedStyle(el).position === 'fixed' && getComputedStyle(el).pointerEvents !== 'none' && !fixed.some(f => f.el.contains(el))) fixed.push({ el, r: el.getBoundingClientRect() })
  }
  res.fixed = fixed.map(f => `${label(f.el)} ${Math.round(f.r.left)},${Math.round(f.r.top)} ${Math.round(f.r.width)}x${Math.round(f.r.height)}`)
  res.fixedOverlaps = []
  for (let i = 0; i < fixed.length; i++) for (let j = i + 1; j < fixed.length; j++) {
    const a = fixed[i].r, b = fixed[j].r
    if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) res.fixedOverlaps.push(`${label(fixed[i].el)} × ${label(fixed[j].el)}`)
  }
  const area = r => Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)) * Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0))
  res.fixedCoverPct = Math.round((100 * fixed.reduce((s, f) => s + area(f.r), 0)) / (vw * vh))

  // Where the page starts, and where its main action is.
  const h1 = document.querySelector('main h1, h1')
  res.h1Top = h1 ? Math.round(h1.getBoundingClientRect().top + scrollY) : null
  const play = [...document.querySelectorAll('main button')].find(b => /^play$/i.test(b.textContent.trim()) && visible(b))
  res.playTop = play ? Math.round(play.getBoundingClientRect().top + scrollY) : null
  return res
}

async function launch() {
  for (const channel of [undefined, 'chrome', 'msedge']) {
    try { return await chromium.launch(channel ? { channel } : {}) } catch { /* try the next browser */ }
  }
  throw new Error('No browser found. Run `npx playwright install chromium`, or install Chrome or Edge.')
}

const browser = await launch()
const report = {}
for (const size of sizes) {
  const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e.message).slice(0, 160)))
  for (const route of routes) {
    errors.length = 0
    await page.goto(base + '#' + route, { waitUntil: 'networkidle' }).catch(() => {})
    await page.waitForTimeout(1500)
    const file = `${size.name}-${route.replace(/[?=]/g, '_')}`
    await page.screenshot({ path: join(out, `${file}-fold.png`) })
    if (size.name === '360') await page.screenshot({ path: join(out, `${file}-full.png`), fullPage: true })
    report[`${size.name} #${route}`] = { ...(await page.evaluate(measure)), errors: [...errors] }
  }
  await ctx.close()
}
await browser.close()
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2))

for (const [key, v] of Object.entries(report)) {
  const screens = (v.pageHeight / Number(key.split(' ')[0] === '390' ? 844 : key.startsWith('320') ? 640 : 740)).toFixed(1)
  console.log(`\n${key}: h1 at ${v.h1Top}px, Play at ${v.playTop ?? '-'}px, ${screens} screens long, fixed things cover ${v.fixedCoverPct}%${v.scrollWidth > v.vw ? `, SCROLLS SIDEWAYS (${v.scrollWidth}/${v.vw})` : ''}`)
  for (const field of ['overflow', 'smallTargets', 'smallInputs', 'tinyText', 'fixedOverlaps', 'errors']) {
    if (v[field].length) console.log(`  ${field}:\n    ${v[field].slice(0, 10).join('\n    ')}${v[field].length > 10 ? `\n    …and ${v[field].length - 10} more` : ''}`)
  }
}
console.log(`\nScreenshots and report.json: ${out}`)
