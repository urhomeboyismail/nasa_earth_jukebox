// The sky behind the app (docs/tickets/UI05-motion-layer.md): pure drawing helpers for SkyBackdrop. Stars are fixed points that drift slowly;
// the atmosphere is a soft glow at the horizon. Everything is drawn at no more than SKY_ALPHA, so text keeps its 4.5:1 contrast.

export const SKY_ALPHA = 0.12
/** At most this many frames a second. */
export const SKY_FPS = 30
export const SKY_FRAME_MS = 1000 / SKY_FPS
export const STAR_COUNT = 90

export type Star = { x: number; y: number; r: number; speed: number; phase: number }

/** A small deterministic generator, so the same sky is drawn every time (and tests are steady). */
function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

/** Star positions as fractions of the screen (0 to 1). */
export function makeStars(count = STAR_COUNT): Star[] {
  const next = seeded(7)
  return Array.from({ length: count }, () => ({ x: next(), y: next(), r: 0.5 + next() * 1.2, speed: 0.004 + next() * 0.012, phase: next() * Math.PI * 2 }))
}

type Ink = { ink: string }

/** One frame of stars (dark) or atmosphere (light). `t` is seconds. Never paints above SKY_ALPHA. */
export function drawSky(ctx: CanvasRenderingContext2D, width: number, height: number, t: number, dark: boolean, stars: Star[], { ink }: Ink): void {
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = ink
  if (dark) {
    for (const star of stars) {
      const twinkle = 0.55 + 0.45 * Math.sin(t * 0.6 + star.phase)
      ctx.globalAlpha = SKY_ALPHA * twinkle
      const x = ((star.x + t * star.speed * 0.1) % 1) * width
      ctx.beginPath()
      ctx.arc(x, star.y * height, star.r, 0, Math.PI * 2)
      ctx.fill()
    }
  } else {
    const drift = 0.5 + 0.5 * Math.sin(t * 0.15)
    const glow = ctx.createRadialGradient(width * (0.3 + 0.4 * drift), height * 1.05, 0, width * 0.5, height * 1.05, Math.max(width, height) * 0.7)
    glow.addColorStop(0, ink)
    glow.addColorStop(1, 'transparent')
    ctx.globalAlpha = SKY_ALPHA
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, width, height)
  }
  ctx.globalAlpha = 1
}
