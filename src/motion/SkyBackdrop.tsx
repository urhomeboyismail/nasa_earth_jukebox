import { useEffect, useRef, type CSSProperties } from 'react'
import { drawSky, makeStars, SKY_FRAME_MS } from './sky'

// Inline, because the theme files are another ticket's hotspot. The gradient is the still sky; the canvas paints over it.
const STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  inlineSize: '100%',
  blockSize: '100%',
  zIndex: -1,
  pointerEvents: 'none',
  background: 'linear-gradient(180deg, transparent 55%, color-mix(in srgb, var(--md-sys-color-primary, transparent) 7%, transparent) 100%)',
}

const query = (q: string): MediaQueryList | null => (typeof window.matchMedia === 'function' ? window.matchMedia(q) : null)

/**
 * A fixed, decorative canvas behind the app: a slow starfield on dark colour schemes, an atmosphere glow on light ones, at most 30 frames a
 * second. It stops while the tab is hidden. Under reduced motion, reduced transparency or more contrast it draws nothing and the still
 * gradient stays. Hidden from assistive technology.
 */
export function SkyBackdrop() {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const stars = makeStars()
    const watched = [query('(prefers-reduced-motion: reduce)'), query('(prefers-reduced-transparency: reduce)'), query('(prefers-contrast: more)')]
    const darkScheme = query('(prefers-color-scheme: dark)')
    let frame = 0
    let last = 0

    const still = () => watched.some(item => item === null || item.matches)
    const isDark = () => {
      const chosen = document.documentElement.dataset.theme
      return chosen ? chosen === 'dark' : (darkScheme?.matches ?? true)
    }
    const stop = () => {
      cancelAnimationFrame(frame)
      frame = 0
    }
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      if (now - last < SKY_FRAME_MS) return
      last = now
      const ctx = el.getContext('2d')
      if (!ctx) return
      const dark = isDark()
      const ink = getComputedStyle(document.documentElement).getPropertyValue(dark ? '--md-sys-color-on-surface' : '--md-sys-color-primary').trim()
      drawSky(ctx, el.width, el.height, now / 1000, dark, stars, { ink: ink || (dark ? '#ffffff' : '#3b3bd6') })
    }
    const sync = () => {
      stop()
      if (document.visibilityState === 'hidden') return
      if (still()) {
        el.getContext('2d')?.clearRect(0, 0, el.width, el.height)
        return
      }
      frame = requestAnimationFrame(tick)
    }
    const resize = () => {
      el.width = window.innerWidth
      el.height = window.innerHeight
    }

    resize()
    sync()
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', sync)
    for (const item of watched) item?.addEventListener?.('change', sync)
    return () => {
      stop()
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', sync)
      for (const item of watched) item?.removeEventListener?.('change', sync)
    }
  }, [])

  return <canvas ref={canvas} className="sky-backdrop" style={STYLE} aria-hidden="true" />
}
