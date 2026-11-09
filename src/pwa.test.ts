import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(fileURLToPath(import.meta.url), '../..')
const manifest = JSON.parse(readFileSync(`${root}/public/manifest.webmanifest`, 'utf8')) as {
  name: string; start_url: string; display: string; theme_color: string; icons: { src: string; sizes: string; purpose?: string }[]
}
const html = readFileSync(`${root}/index.html`, 'utf8')

describe('installable on a phone (T120)', () => {
  it('has what a browser needs to offer "add to home screen"', () => {
    expect(manifest.name).toBeTruthy()
    expect(manifest.start_url).toBe('/')
    expect(manifest.display).toBe('standalone')
    const sizes = manifest.icons.map(icon => icon.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
    expect(manifest.icons.some(icon => icon.purpose === 'maskable')).toBe(true)
  })

  it('points at icon files that exist', () => {
    // A PNG starts with its signature, so this also checks the file is a real image and not empty.
    const isPng = (path: string) => Array.from(readFileSync(`${root}/public${path}`).subarray(1, 4)).join() === [80, 78, 71].join()
    for (const icon of manifest.icons) expect(isPng(icon.src), icon.src).toBe(true)
    expect(isPng('/icons/apple-touch-icon.png')).toBe(true)
  })

  it('links the manifest, the theme colour and the iOS icon from the page', () => {
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"')
    expect(html).toContain(`name="theme-color" content="${manifest.theme_color}"`)
    expect(html).toContain('rel="apple-touch-icon"')
    expect(html).toContain('viewport-fit=cover')
  })
})
