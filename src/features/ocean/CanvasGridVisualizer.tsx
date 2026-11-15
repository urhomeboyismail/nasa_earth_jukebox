// The picture for a track that has no video: one step's 16 by 8 grid smoothed into a thermal map on a <canvas>, with the wind drawn over it.
// While the track plays (and motion is allowed) streaks drift along the flow; otherwise the flow is shown as a still set of short ticks, so
// nothing moves on its own (WCAG 2.2.2) and the direction can still be read. The canvas is only a picture: exploring it (reticle, keys,
// pointer) and what is said about a cell live in OceanStage, over it, exactly as they do over a video.

import { useEffect, useMemo, useRef } from 'react'
import { reducedMotion } from '../../motion'
import type { GridCell, OceanCalibration } from './schema'
import { fieldOf, mixFields, sampleField, thermalGradient, thermalRgb, THERMAL_MAX_C, type Field } from './thermal'
import './canvas-grid.css'

/** The canvas is drawn this wide whatever its size on the page; the CSS scales it. */
const WIDTH = 512
/** Pixels of the smoothed heat map for each grid cell, each way. */
const HEAT_PER_CELL = 8
const STREAKS = 120
/** How far a streak travels in a second at full speed, as a share of the map's width. */
const PULL = 0.9
/** The tail of a streak is this many seconds of its travel long. */
const TRAIL_S = 0.5

type Props = {
  /** The step on show, and the one after it: the picture eases from the first towards the second by `mix` (0 to 1). */
  grid: GridCell[][] | null
  next?: GridCell[][] | null
  mix?: number
  calibration: Pick<OceanCalibration, 'temp_min_c' | 'temp_max_c'>
  playing: boolean
  /** What the picture shows, for people who cannot see it. */
  label: string
}

type Streak = { x: number; y: number; age: number; life: number }

function paintHeat(target: HTMLCanvasElement, field: Field) {
  const w = field.cols * HEAT_PER_CELL
  const h = field.rows * HEAT_PER_CELL
  target.width = w
  target.height = h
  const ctx = target.getContext('2d')
  if (!ctx) return
  const image = ctx.createImageData(w, h)
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const [r, g, b] = thermalRgb(sampleField(field.celsius, field.rows, field.cols, (px + 0.5) / w, (py + 0.5) / h))
      const i = (py * w + px) * 4
      image.data[i] = r
      image.data[i + 1] = g
      image.data[i + 2] = b
      image.data[i + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
}

/**
 * A streak from its head (where the air is going) back to its tail, with a dot at the head so the direction can be read. A dark line
 * under a light one, so it shows on blue and on yellow alike.
 */
function strokeStreak(ctx: CanvasRenderingContext2D, headX: number, headY: number, tailX: number, tailY: number, alpha: number) {
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(headX, headY)
  ctx.lineTo(tailX, tailY)
  ctx.lineWidth = 4
  ctx.strokeStyle = `rgba(0, 0, 0, ${0.45 * alpha})`
  ctx.stroke()
  ctx.lineWidth = 2
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * alpha})`
  ctx.stroke()
  for (const [radius, shade, opacity] of [[4.5, 0, 0.45], [3, 255, 0.95]] as const) {
    ctx.beginPath()
    ctx.arc(headX, headY, radius, 0, 2 * Math.PI)
    ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${opacity * alpha})`
    ctx.fill()
  }
}

/** The flow as a still lattice of short ticks, one for every other cell, each pointing the way the air goes. */
function paintTicks(ctx: CanvasRenderingContext2D, field: Field, w: number, h: number) {
  for (let r = 0; r < field.rows; r += 2) {
    for (let c = 0; c < field.cols; c += 2) {
      const i = r * field.cols + c
      const x = ((c + 0.5) / field.cols) * w
      const y = ((r + 0.5) / field.rows) * h
      // Both axes by the width, as the streaks move, so a direction looks the same still or moving. The tick is centred on its cell.
      const dx = field.u[i] * PULL * TRAIL_S * w
      const dy = field.v[i] * PULL * TRAIL_S * w
      strokeStreak(ctx, x + dx / 2, y + dy / 2, x - dx / 2, y - dy / 2, 1)
    }
  }
}

export function CanvasGridVisualizer({ grid, next, mix = 0, calibration, playing, label }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const heat = useRef<HTMLCanvasElement | null>(null)
  const latest = useRef<Field | null>(null)
  const animate = playing && !reducedMotion()

  const field = useMemo(() => {
    if (!grid) return null
    const now = fieldOf(grid, calibration)
    return next && mix > 0 ? mixFields(now, fieldOf(next, calibration), mix) : now
  }, [grid, next, mix, calibration])
  const rows = field?.rows ?? 8
  const cols = field?.cols ?? 16
  const height = Math.round((WIDTH * rows) / cols)

  // Redraw when the numbers change. While streaks are drifting the animation below redraws every frame from `latest` instead.
  useEffect(() => {
    latest.current = field
    const ctx = canvas.current?.getContext('2d')
    if (!ctx || !field) return
    heat.current ??= document.createElement('canvas')
    paintHeat(heat.current, field)
    if (animate) return
    ctx.drawImage(heat.current, 0, 0, WIDTH, height)
    paintTicks(ctx, field, WIDTH, height)
  }, [field, animate, height])

  useEffect(() => {
    if (!animate) return
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    const respawn = (s: Streak) => { s.x = Math.random(); s.y = Math.random(); s.age = 0; s.life = 1.5 + Math.random() * 1.5 }
    const streaks: Streak[] = Array.from({ length: STREAKS }, () => {
      const s = { x: 0, y: 0, age: 0, life: 1 }
      respawn(s)
      s.age = Math.random() * s.life
      return s
    })
    let last = performance.now()
    let id = 0
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const f = latest.current
      if (f && heat.current) {
        ctx.drawImage(heat.current, 0, 0, WIDTH, height)
        for (const s of streaks) {
          const u = sampleField(f.u, f.rows, f.cols, s.x, s.y) * PULL
          const v = sampleField(f.v, f.rows, f.cols, s.x, s.y) * PULL
          s.x += u * dt
          s.y += v * dt * (WIDTH / height)
          s.age += dt
          if (s.age > s.life || s.x < 0 || s.x > 1 || s.y < 0 || s.y > 1) { respawn(s); continue }
          if (Math.hypot(u, v) < 0.02) continue
          const fade = Math.sin((Math.PI * s.age) / s.life)
          strokeStreak(ctx, s.x * WIDTH, s.y * height, (s.x - u * TRAIL_S) * WIDTH, (s.y - v * TRAIL_S * (WIDTH / height)) * height, fade)
        }
      }
      id = requestAnimationFrame(frame)
    }
    id = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(id)
  }, [animate, height])

  return <canvas ref={canvas} className="grid-canvas" width={WIDTH} height={height} role="img" aria-label={label} />
}

/** The colour key under the map: 0 °C deep blue, 20 °C green, 32 °C and above red. */
export function ThermalScale() {
  return (
    <div className="thermal-scale">
      <div className="thermal-scale__bar" style={{ background: thermalGradient() }} aria-hidden="true" />
      <p className="thermal-scale__labels">
        <span style={{ left: '0%' }}>0 °C</span>
        <span style={{ left: `${(20 / THERMAL_MAX_C) * 100}%` }}>20 °C</span>
        <span style={{ left: '100%' }}>{THERMAL_MAX_C} °C and above</span>
      </p>
    </div>
  )
}
