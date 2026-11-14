import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { expectNoA11yViolations } from '../test/a11y'
import { SkyBackdrop } from './SkyBackdrop'
import { drawSky, makeStars, SKY_ALPHA } from './sky'

let matching: string[] = []
let raf: ReturnType<typeof vi.fn>
let cancel: ReturnType<typeof vi.fn>

const setHidden = (hidden: boolean) => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(hidden ? 'hidden' : 'visible')
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  matching = []
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: matching.some(item => query.includes(item)), addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  raf = vi.fn(() => 1)
  cancel = vi.fn()
  vi.stubGlobal('requestAnimationFrame', raf)
  vi.stubGlobal('cancelAnimationFrame', cancel)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect: vi.fn() } as unknown as CanvasRenderingContext2D)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('SkyBackdrop', () => {
  it('is aria-hidden, decoration only', async () => {
    const { container } = render(<SkyBackdrop />)
    const canvas = container.querySelector('canvas')
    expect(canvas).toHaveAttribute('aria-hidden', 'true')
    expect(canvas).toHaveStyle({ pointerEvents: 'none', position: 'fixed' })
    await expectNoA11yViolations(container)
  })

  it('asks for animation frames when motion is allowed', () => {
    render(<SkyBackdrop />)
    expect(raf).toHaveBeenCalled()
  })

  it.each(['prefers-reduced-motion', 'prefers-reduced-transparency', 'prefers-contrast'])('asks for no animation frame under %s', query => {
    matching = [query]
    render(<SkyBackdrop />)
    expect(raf).not.toHaveBeenCalled()
  })

  it('stops on visibilitychange to hidden and starts again when shown', () => {
    render(<SkyBackdrop />)
    raf.mockClear()
    cancel.mockClear()
    setHidden(true)
    expect(cancel).toHaveBeenCalled()
    expect(raf).not.toHaveBeenCalled()
    setHidden(false)
    expect(raf).toHaveBeenCalledOnce()
  })

  it('cancels its frame when it unmounts', () => {
    const { unmount } = render(<SkyBackdrop />)
    cancel.mockClear()
    unmount()
    expect(cancel).toHaveBeenCalled()
  })
})

describe('drawSky', () => {
  const fake = () => {
    const alphas: number[] = []
    const context = {
      clearRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), fillRect: vi.fn(),
      createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      fillStyle: '',
      set globalAlpha(value: number) { alphas.push(value) },
    }
    return { context, alphas }
  }
  const as2d = (context: object) => context as unknown as CanvasRenderingContext2D

  it('never paints above 12% alpha, dark or light', () => {
    for (const dark of [true, false]) {
      const { context, alphas } = fake()
      drawSky(as2d(context), 800, 600, 12.5, dark, makeStars(), { ink: '#fff' })
      expect(alphas.at(-1)).toBe(1) // the reset after painting
      expect(Math.max(...alphas.slice(0, -1))).toBeLessThanOrEqual(SKY_ALPHA)
    }
  })

  it('draws every star on a dark scheme, and none on a light one', () => {
    const dark = fake()
    drawSky(as2d(dark.context), 800, 600, 1, true, makeStars(10), { ink: '#fff' })
    expect(dark.context.arc).toHaveBeenCalledTimes(10)
    const light = fake()
    drawSky(as2d(light.context), 800, 600, 1, false, makeStars(10), { ink: '#33f' })
    expect(light.context.arc).not.toHaveBeenCalled()
    expect(light.context.fillRect).toHaveBeenCalledOnce()
  })

  it('makes the same sky every time', () => {
    expect(makeStars(5)).toEqual(makeStars(5))
  })
})
