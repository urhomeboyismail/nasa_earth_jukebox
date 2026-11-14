// The app's small motion layer (docs/tickets/UI05-motion-layer.md): CSS-friendly helpers on the Web Animations API (`element.animate`), with no
// animation library. One gate, `reducedMotion()`, stops all of it. Every helper returns a promise that resolves when its animation ends; it
// resolves at once, and never throws, under reduced motion or where `element.animate` is missing. Motion never delays a sound or an announcement.

/** True when the listener asked for less motion, or the browser cannot tell us (then we stay still). */
export function reducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** An elastic ease that overshoots a little and settles (a spring, as a cubic-bezier). */
export const SPRING_EASE = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

export const PRESS_MS = 300
export const DRAWER_MS = 240
export const SWEEP_MS = 420

/** Runs one animation and waits for it. Quiet under reduced motion, without `animate`, or if the browser throws. */
async function run(el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions): Promise<void> {
  if (reducedMotion() || typeof el.animate !== 'function') return
  try {
    const animation = el.animate(keyframes, options)
    await animation?.finished
  } catch {
    // A cancelled or unsupported animation is not an error for the listener.
  }
}

/** A springy press: scale 0.94 back to 1, 300 ms. */
export function pressRecoil(el: Element): Promise<void> {
  return run(el, [{ transform: 'scale(0.94)' }, { transform: 'scale(1)' }], { duration: PRESS_MS, easing: SPRING_EASE })
}

/** A drawer sliding in from, or out to, `side`: a short move and a fade, 240 ms. The caller hides or shows the drawer itself. */
export function slideDrawer(el: Element, side: 'left' | 'right' | 'top' | 'bottom', open: boolean): Promise<void> {
  const distance = side === 'left' || side === 'top' ? '-24px' : '24px'
  const away = side === 'left' || side === 'right' ? `translateX(${distance})` : `translateY(${distance})`
  const shown: Keyframe = { transform: 'translate(0, 0)', opacity: 1 }
  const hidden: Keyframe = { transform: away, opacity: 0 }
  return run(el, open ? [hidden, shown] : [shown, hidden], { duration: DRAWER_MS, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'forwards' })
}

/**
 * A short horizon sweep across the screen while `apply()` switches the theme underneath. `apply()` always runs, with or without motion.
 * The sweep is a soft band that moves once; it never flashes.
 */
export async function themeSweep(apply: () => void): Promise<void> {
  if (reducedMotion() || typeof document === 'undefined' || typeof document.body.animate !== 'function') {
    apply()
    return
  }
  const band = document.createElement('div')
  band.setAttribute('aria-hidden', 'true')
  band.style.cssText =
    'position:fixed;inset:0;z-index:60;pointer-events:none;opacity:0.18;background:linear-gradient(180deg,transparent 0%,var(--md-sys-color-primary,currentColor) 50%,transparent 100%)'
  document.body.append(band)
  apply()
  try {
    await run(band, [{ transform: 'translateY(-100%)' }, { transform: 'translateY(100%)' }], { duration: SWEEP_MS, easing: 'ease-in-out' })
  } finally {
    band.remove()
  }
}

/** Draws an SVG path from its start to its end (the stroke grows). */
export function drawPath(svgPath: SVGPathElement, ms: number): Promise<void> {
  svgPath.setAttribute('pathLength', '1')
  svgPath.style.strokeDasharray = '1'
  return run(svgPath, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: ms, easing: 'ease-out', fill: 'forwards' })
}

/** Moves an element along an SVG path `d` (the tour's flight). The element should be positioned at the path's own coordinate origin. */
export function flyAlong(el: HTMLElement, path: string, ms: number): Promise<void> {
  if (reducedMotion() || typeof el.animate !== 'function') return Promise.resolve()
  el.style.setProperty('offset-path', `path("${path}")`)
  el.style.setProperty('offset-rotate', '0deg')
  return run(el, [{ offsetDistance: '0%' }, { offsetDistance: '100%' }], { duration: ms, easing: 'ease-in-out', fill: 'forwards' })
}
