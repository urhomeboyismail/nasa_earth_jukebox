// How the Home globe moves (OrbitGlobe). Adapted from "Orbit Delivery Hero" by Maxim (@fadeichev2121 on 21st.dev, MIT licence):
// drag pulls the planet on a spring, it wanders by itself once left alone, and Echo runs to stay on top of it.

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
/** Moves `value` towards `target` at rate `lambda`, the same at any frame rate. */
export const damp = (value: number, target: number, lambda: number, dt: number) => value + (target - value) * (1 - Math.exp(-lambda * dt))
export const smoothstep = (value: number, min: number, max: number) => {
  const t = clamp((value - min) / (max - min), 0, 1)
  return t * t * (3 - 2 * t)
}
/** The shortest turn from angle `a` to angle `b`, in (-π, π]. */
export const turn = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a))

/** Seconds after the last touch before the planet starts wandering again. */
export const IDLE_BEFORE_ROAM = 3.5

export type PlanetMotion = {
  time: number
  roll: number
  rollVelocity: number
  rollTarget: number
  pitch: number
  pitchVelocity: number
  pitchTarget: number
  dragging: boolean
  lastInteraction: number
  /** Where the wander has got to: it steers the roll and pitch round a slow circle. */
  route: number
}

export const createPlanetMotion = (): PlanetMotion => ({
  time: 0, roll: 0, rollVelocity: 0, rollTarget: 0, pitch: 0, pitchVelocity: 0, pitchTarget: 0, dragging: false, lastInteraction: 0, route: 0,
})

/**
 * Advances the planet by `dt` seconds and returns its spin as [x, y, z] radians a second. While dragged, roll and pitch follow the pointer
 * on a spring; let go, they ease to rest, then to the wander. With reduced motion it never wanders and settles faster.
 */
export function stepPlanet(m: PlanetMotion, dt: number, reduced: boolean): [number, number, number] {
  m.time += dt
  const roaming = !reduced && !m.dragging && m.time - m.lastInteraction > IDLE_BEFORE_ROAM
  if (roaming) m.route += 0.24 * dt
  if (m.dragging) {
    m.rollVelocity += (90 * (m.rollTarget - m.roll) - 18 * m.rollVelocity) * dt
    m.pitchVelocity += (70 * (m.pitchTarget - m.pitch) - 17 * m.pitchVelocity) * dt
  } else {
    m.rollVelocity = damp(m.rollVelocity, roaming ? -0.24 * Math.cos(m.route) : 0, reduced ? 12 : 5, dt)
    m.pitchVelocity = damp(m.pitchVelocity, roaming ? 0.24 * Math.sin(m.route) : 0, 6, dt)
  }
  m.rollVelocity = clamp(m.rollVelocity, -1.15, 1.15)
  m.pitchVelocity = clamp(m.pitchVelocity, -0.55, 0.55)
  m.roll += m.rollVelocity * dt
  m.pitch += m.pitchVelocity * dt
  return [m.pitchVelocity, m.rollVelocity * 0.45, -m.rollVelocity]
}

/** Moves the drag targets by a pointer move of (dx, dy) pixels on a canvas `width` wide; a fast flick can pull only so far ahead. */
export function dragPlanet(m: PlanetMotion, dx: number, dy: number, width: number): void {
  const sensitivity = 5 / Math.max(360, width)
  m.rollTarget = clamp(m.rollTarget + dx * sensitivity, m.roll - 0.5, m.roll + 0.5)
  m.pitchTarget = clamp(m.pitchTarget + dy * sensitivity * 0.7, m.pitch - 0.4, m.pitch + 0.4)
  m.lastInteraction = m.time
}

/**
 * Echo's pose. `phase` is the stride, `run` 0 (standing) to 1 (running), `wave` 0 to 1 how far the right arm is up in a wave, and `t`
 * the clock for the idle bob and the hand going to and fro (pass 0 to hold them still).
 */
export function poseAt(t: number, phase: number, run: number, wave: number) {
  const stride = Math.sin(phase)
  return {
    lift: 0.05 + run * 0.035 * Math.abs(stride) + (1 - run) * 0.01 * Math.sin(t * 2.5),
    lean: 0.28 * run,
    armL: 0.9 * stride * run,
    armR: -0.9 * stride * run * (1 - wave),
    raise: wave * (-2.5 + 0.35 * Math.sin(t * 11)),
  }
}
