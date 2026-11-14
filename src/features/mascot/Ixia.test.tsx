import { act, render } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { expectNoA11yViolations } from '../../test/a11y'
import Ixia from './Ixia'
import { FACE_FOR, loadRobot, nextLine, resetRobotLoader, ROBOT_LOGO, ROBOT_SCRIPT, ROBOT_TAG, ROBOT_THREE } from './robot'

/** Stands in for public/robot/robot-companion.js, which jsdom cannot run (no WebGL): the same methods, as spies. */
class FakeRobot extends HTMLElement {
  configure = vi.fn(() => this)
  face = vi.fn(() => this)
  gesture = vi.fn(() => Promise.resolve(true))
  stopGesture = vi.fn()
  hush = vi.fn()
  setChestBands = vi.fn(() => this)
  say = vi.fn((_text: string, _options?: object) => Promise.resolve(true))
}

beforeAll(() => {
  customElements.define(ROBOT_TAG, FakeRobot)
})
afterEach(() => {
  resetRobotLoader()
})

function robotIn(container: HTMLElement): FakeRobot {
  const el = container.querySelector(ROBOT_TAG)
  if (!(el instanceof FakeRobot)) throw new Error('no robot')
  return el
}

/** Lets the loader's promise and the effects after it run. */
const settle = () => act(async () => { await Promise.resolve() })

describe('loadRobot', () => {
  it('adds the script from our own site once, and waits for the element', async () => {
    const whenDefined = vi.fn(() => new Promise<CustomElementConstructor>(() => {}))
    const registry = { get: () => undefined, whenDefined }
    const real = Object.getOwnPropertyDescriptor(window, 'customElements')
    Object.defineProperty(window, 'customElements', { configurable: true, value: registry })
    try {
      void loadRobot()
      void loadRobot()
      const scripts = document.querySelectorAll('script[data-robot]')
      expect(scripts).toHaveLength(1)
      expect(scripts[0]).toHaveAttribute('src', ROBOT_SCRIPT)
      expect(ROBOT_SCRIPT.startsWith('/')).toBe(true)
      expect(whenDefined).toHaveBeenCalledTimes(1)
    } finally {
      if (real) Object.defineProperty(window, 'customElements', real)
      document.querySelectorAll('script[data-robot]').forEach(script => script.remove())
    }
  })
})

describe('the robot', () => {
  it('is quiet, hidden from screen readers, takes three.js and the logo from our site, and keeps the name Echo with none of its own lines', async () => {
    const { container } = render(<Ixia pose="idle" expression="happy" />)
    await settle()
    const robot = robotIn(container)
    expect(robot).toHaveAttribute('aria-hidden', 'true')
    expect(robot).toHaveAttribute('quiet')
    expect(robot.getAttribute('three')).toBe(ROBOT_THREE)
    expect(robot.getAttribute('logo')).toBe(ROBOT_LOGO)
    expect(robot.configure).toHaveBeenCalledWith(expect.objectContaining({ name: 'Echo', faq: [], tips: [] }))
    await expectNoA11yViolations(container)
  })

  it('shows the face for the expression, and keeps it', async () => {
    const { container, rerender } = render(<Ixia pose="idle" expression="happy" />)
    await settle()
    const robot = robotIn(container)
    expect(robot.face).toHaveBeenLastCalledWith(FACE_FOR.happy, Infinity)
    rerender(<Ixia pose="idle" expression="alert" />)
    expect(robot.face).toHaveBeenLastCalledWith('surprised', Infinity)
  })

  it('nods when the guide listens, thinks while it connects, and stops when it is idle', async () => {
    const { container, rerender } = render(<Ixia pose="listening" expression="happy" />)
    await settle()
    const robot = robotIn(container)
    expect(robot.gesture).toHaveBeenLastCalledWith('nod')
    rerender(<Ixia pose="thinking" expression="searching" />)
    expect(robot.gesture).toHaveBeenLastCalledWith('think')
    rerender(<Ixia pose="idle" expression="happy" />)
    expect(robot.stopGesture).toHaveBeenCalled()
  })

  it("mouths the guide's line a piece at a time as it grows, and hushes when the guide stops", async () => {
    const { container, rerender } = render(<Ixia pose="talking" expression="eq_active" say="Hello." />)
    await settle()
    const robot = robotIn(container)
    expect(robot.say).toHaveBeenLastCalledWith('Hello.', expect.objectContaining({ speed: expect.any(Number) }))
    rerender(<Ixia pose="talking" expression="eq_active" say="Hello. The sea is warm here." />)
    await settle()
    expect(robot.say).toHaveBeenLastCalledWith('The sea is warm here.', expect.any(Object))
    rerender(<Ixia pose="idle" expression="happy" say="" />)
    expect(robot.hush).toHaveBeenCalledTimes(1)
  })

  it('opens our guide on a click instead of its own chat', async () => {
    const onActivate = vi.fn()
    const { container } = render(<Ixia pose="idle" expression="happy" onActivate={onActivate} />)
    await settle()
    const click = new Event('robot-click', { cancelable: true })
    robotIn(container).dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    expect(onActivate).toHaveBeenCalledTimes(1)
  })
})

describe('nextLine', () => {
  it('says only the new part of a line that carries on, and the whole of a new line', () => {
    expect(nextLine('', 'Hi.')).toBe('Hi.')
    expect(nextLine('Hi.', 'Hi. There.')).toBe('There.')
    expect(nextLine('Hi.', 'Hi.')).toBe('')
    expect(nextLine('Hi.', 'Something else.')).toBe('Something else.')
    expect(nextLine('Hi.', '')).toBe('')
  })
})
