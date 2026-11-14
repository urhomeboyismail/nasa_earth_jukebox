import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { drawPath, flyAlong, pressRecoil, reducedMotion, slideDrawer, themeSweep } from '.'

let reduced = false
let animate: ReturnType<typeof vi.fn>
const original = Object.getOwnPropertyDescriptor(Element.prototype, 'animate')
const removeAnimate = () => { delete (Element.prototype as { animate?: unknown }).animate }

beforeEach(() => {
  reduced = false
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') && reduced }))
  animate = vi.fn(() => ({ finished: Promise.resolve() }))
  Object.defineProperty(Element.prototype, 'animate', { value: animate, configurable: true, writable: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
  if (original) Object.defineProperty(Element.prototype, 'animate', original)
  else removeAnimate()
  document.body.innerHTML = ''
})

const svgPath = () => document.createElementNS('http://www.w3.org/2000/svg', 'path')

describe('reducedMotion', () => {
  it('follows prefers-reduced-motion', () => {
    expect(reducedMotion()).toBe(false)
    reduced = true
    expect(reducedMotion()).toBe(true)
  })

  it('is true where matchMedia is missing', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(reducedMotion()).toBe(true)
  })
})

describe('each helper', () => {
  const helpers: [string, () => Promise<void>, Keyframe[]][] = [
    ['pressRecoil', () => pressRecoil(document.createElement('button')), [{ transform: 'scale(0.94)' }, { transform: 'scale(1)' }]],
    [
      'slideDrawer (open, from the left)',
      () => slideDrawer(document.createElement('div'), 'left', true),
      [{ transform: 'translateX(-24px)', opacity: 0 }, { transform: 'translate(0, 0)', opacity: 1 }],
    ],
    [
      'slideDrawer (close, to the right)',
      () => slideDrawer(document.createElement('div'), 'right', false),
      [{ transform: 'translate(0, 0)', opacity: 1 }, { transform: 'translateX(24px)', opacity: 0 }],
    ],
    ['drawPath', () => drawPath(svgPath(), 500), [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }]],
    ['flyAlong', () => flyAlong(document.createElement('div'), 'M0 0 C10 10 20 20 30 30', 900), [{ offsetDistance: '0%' }, { offsetDistance: '100%' }]],
  ]

  it.each(helpers)('%s calls animate once with its keyframes', async (_name, call, keyframes) => {
    await call()
    expect(animate).toHaveBeenCalledOnce()
    expect(animate.mock.calls[0][0]).toEqual(keyframes)
  })

  it.each(helpers)('%s resolves at once under reduced motion and never animates', async (_name, call) => {
    reduced = true
    await expect(call()).resolves.toBeUndefined()
    expect(animate).not.toHaveBeenCalled()
  })

  it.each(helpers)('%s resolves quietly where animate is missing', async (_name, call) => {
    removeAnimate()
    await expect(call()).resolves.toBeUndefined()
  })

  it.each(helpers)('%s does not throw when animate throws', async (_name, call) => {
    animate.mockImplementation(() => { throw new Error('no') })
    await expect(call()).resolves.toBeUndefined()
  })

  it('uses the durations in the ticket', async () => {
    await pressRecoil(document.createElement('button'))
    await slideDrawer(document.createElement('div'), 'left', true)
    expect(animate.mock.calls[0][1]).toMatchObject({ duration: 300 })
    expect(animate.mock.calls[1][1]).toMatchObject({ duration: 240 })
  })
})

describe('themeSweep', () => {
  it('applies the theme and sweeps a band that it then removes', async () => {
    const apply = vi.fn()
    await themeSweep(apply)
    expect(apply).toHaveBeenCalledOnce()
    expect(animate).toHaveBeenCalledOnce()
    expect(document.body.children).toHaveLength(0)
  })

  it('still applies the theme under reduced motion, with no sweep', async () => {
    reduced = true
    const apply = vi.fn()
    await themeSweep(apply)
    expect(apply).toHaveBeenCalledOnce()
    expect(animate).not.toHaveBeenCalled()
  })

  it('still applies the theme where animate is missing', async () => {
    removeAnimate()
    const apply = vi.fn()
    await themeSweep(apply)
    expect(apply).toHaveBeenCalledOnce()
  })
})
