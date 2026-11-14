import { describe, expect, it } from 'vitest'
import { createPlanetMotion, dragPlanet, IDLE_BEFORE_ROAM, poseAt, stepPlanet, turn } from './orbitMotion'

const run = (seconds: number, step: () => void) => { for (let i = 0; i < seconds * 120; i++) step() }

describe('the globe motion', () => {
  it('rests at first, then wanders by itself', () => {
    const m = createPlanetMotion()
    run(IDLE_BEFORE_ROAM - 0.5, () => stepPlanet(m, 1 / 120, false))
    expect(Math.hypot(m.rollVelocity, m.pitchVelocity)).toBeCloseTo(0)
    run(3, () => stepPlanet(m, 1 / 120, false))
    expect(Math.hypot(m.rollVelocity, m.pitchVelocity)).toBeGreaterThan(0.1)
  })

  it('never wanders with reduced motion', () => {
    const m = createPlanetMotion()
    run(10, () => stepPlanet(m, 1 / 120, true))
    expect(m.roll).toBe(0)
    expect(m.pitch).toBe(0)
  })

  it('follows a drag on a spring, a flick pulling only so far ahead', () => {
    const m = createPlanetMotion()
    m.dragging = true
    dragPlanet(m, 10_000, 0, 800)
    expect(m.rollTarget).toBe(0.5)
    run(2, () => stepPlanet(m, 1 / 120, false))
    expect(m.roll).toBeCloseTo(0.5, 2)
  })

  it('turns the short way round', () => {
    expect(turn(3, -3)).toBeCloseTo(2 * Math.PI - 6)
    expect(turn(0, 1)).toBeCloseTo(1)
  })

  it('swings the arms while running, and raises the right one to wave', () => {
    const running = poseAt(0, 1, 1, 0)
    expect(running.lean).toBeGreaterThan(0)
    expect(running.armL).toBeCloseTo(-running.armR)
    expect(running.raise).toBeCloseTo(0)

    const waving = poseAt(0, 1, 0, 1)
    expect(waving.lean).toBe(0)
    expect(waving.armR).toBeCloseTo(0)
    expect(waving.raise).toBeLessThan(-2)
  })
})
