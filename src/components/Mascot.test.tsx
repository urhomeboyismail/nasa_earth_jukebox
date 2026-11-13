import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { expectNoA11yViolations } from '../test/a11y'
import { Echo, Sonny, type MascotExpression, type MascotMotion, type MascotPose } from './Mascot'
import { expressionForPose } from './mascotTypes'

const EXPRESSIONS: MascotExpression[] = ['happy', 'searching', 'eq_active', 'alert', 'resting']
const barHeights = (container: HTMLElement) => [...container.querySelectorAll('[data-part="eq-bar"]')].map(bar => Number(bar.getAttribute('height')))

describe('the mascot', () => {
  it('is hidden from screen readers, so a button keeps the name its text gives it', async () => {
    const { container } = render(<button type="button"><Sonny /> Voice guide</button>)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('button', { name: 'Voice guide' })).toBeInTheDocument()
    await expectNoA11yViolations(container)
  })

  it.each<MascotPose>(['idle', 'listening', 'talking', 'thinking'])('draws Echo %s, hidden from screen readers', async pose => {
    const { container } = render(<Echo pose={pose} />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    await expectNoA11yViolations(container)
  })

  it('gives each drawing its own clip path and glow filter, so two on one page do not share them', () => {
    const { container } = render(<><Sonny /><Sonny /><Echo /><Echo /></>)
    for (const tag of ['clipPath', 'filter']) {
      const ids = [...container.querySelectorAll(tag)].map(node => node.id)
      expect(ids).toHaveLength(4)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('lights the ear-cup LEDs and shows sound waves only while listening or talking', () => {
    const drawn = (pose: MascotPose) => {
      const { container, unmount } = render(<Echo pose={pose} />)
      const result = {
        lit: [...container.querySelectorAll('[data-part="led"]')].every(led => led.getAttribute('data-lit') === 'true'),
        waves: !!container.querySelector('.mascot__waves'),
      }
      unmount()
      return result
    }
    expect(drawn('idle')).toEqual({ lit: false, waves: false })
    expect(drawn('listening')).toEqual({ lit: true, waves: true })
    expect(drawn('talking')).toEqual({ lit: false, waves: true })
    expect(drawn('thinking')).toEqual({ lit: false, waves: false })
  })

  describe('visor expressions', () => {
    it.each(EXPRESSIONS)('draws %s as its own visor shape', async expression => {
      const { container } = render(<Echo expression={expression} />)
      const parts = [...container.querySelectorAll('[data-part^="visor-"]')].map(part => part.getAttribute('data-part'))
      expect(parts).toEqual([`visor-${expression}`])
      expect(container.querySelector('svg')).toHaveAttribute('data-expression', expression)
      await expectNoA11yViolations(container)
    })

    it('picks the old look from the pose alone', () => {
      const shown = (pose: MascotPose) => {
        const { container, unmount } = render(<Echo pose={pose} />)
        const part = container.querySelector('[data-part^="visor-"]')?.getAttribute('data-part')
        unmount()
        return part
      }
      expect(shown('idle')).toBe('visor-happy')
      expect(shown('listening')).toBe('visor-happy')
      expect(shown('talking')).toBe('visor-eq_active')
      expect(shown('thinking')).toBe('visor-searching')
      expect(expressionForPose('talking')).toBe('eq_active')
    })

    it('lets the expression prop win over the pose', () => {
      const { container } = render(<Echo pose="talking" expression="resting" />)
      expect(container.querySelector('[data-part="visor-resting"]')).toBeInTheDocument()
      expect(container.querySelector('[data-part="visor-eq_active"]')).not.toBeInTheDocument()
    })

    it('shows the happy visor on Sonny unless told otherwise', () => {
      const { container } = render(<><Sonny /><Sonny expression="alert" /></>)
      expect(container.querySelectorAll('[data-part="visor-happy"]')).toHaveLength(1)
      expect(container.querySelectorAll('[data-part="visor-alert"]')).toHaveLength(1)
    })
  })

  describe('chest bars', () => {
    it('sets a height for each level', () => {
      const { container } = render(<Echo levels={[255, 0, 128, 64]} />)
      const heights = barHeights(container)
      expect(heights).toHaveLength(4)
      expect(new Set(heights).size).toBe(4)
      expect(heights[0]).toBeGreaterThan(heights[2])
      expect(heights[2]).toBeGreaterThan(heights[3])
      expect(heights[3]).toBeGreaterThan(heights[1])
    })

    it('draws a resting shape without levels, and fills missing bars from it', () => {
      const resting = barHeights(render(<Echo />).container)
      expect(new Set(resting).size).toBeGreaterThan(1)
      const partial = barHeights(render(<Echo levels={[255]} />).container)
      expect(partial.slice(1)).toEqual(resting.slice(1))
      expect(partial[0]).toBeGreaterThan(resting[0])
    })
  })

  describe('motion', () => {
    const flames = (motion: MascotMotion) => {
      const { container, unmount } = render(<Echo motion={motion} />)
      const count = container.querySelectorAll('[data-part="flame"]').length
      const attr = container.querySelector('svg')?.getAttribute('data-motion')
      unmount()
      return { count, attr }
    }

    it('shows the boot flames only while boosting or in a retro burn', () => {
      expect(flames('idle')).toEqual({ count: 0, attr: 'idle' })
      expect(flames('pointing')).toEqual({ count: 0, attr: 'pointing' })
      expect(flames('boosting')).toEqual({ count: 2, attr: 'boosting' })
      expect(flames('retro')).toEqual({ count: 2, attr: 'retro' })
    })

    it('hands thrust and globe spin to the stylesheet, clamped to 0..1', () => {
      const { container } = render(<Echo motion="boosting" thrust={3} globeSpin={0.5} />)
      const svg = container.querySelector('svg')
      expect(svg?.style.getPropertyValue('--thrust')).toBe('1')
      expect(svg?.style.getPropertyValue('--globe-spin')).toBe('0.5')
      expect(svg).toHaveAttribute('data-globe', 'spinning')
    })

    it('keeps the globe still by default', () => {
      const { container } = render(<Echo />)
      expect(container.querySelector('svg')).toHaveAttribute('data-globe', 'still')
    })

    it('has a pointing arm', async () => {
      const { container } = render(<Echo motion="pointing" />)
      expect(container.querySelector('[data-part="arm-right"]')).toBeInTheDocument()
      await expectNoA11yViolations(container)
    })
  })

  describe('colours (VIS3)', () => {
    const PAINT = ['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color', 'color']

    it.each(EXPRESSIONS)('paints Echo %s only with the --mascot-* tokens, with no hex left in the art', async expression => {
      const { container } = render(<><Echo expression={expression} motion="boosting" /><Sonny expression={expression} /></>)
      const painted = [...container.querySelectorAll('svg, svg *')].flatMap(node => PAINT.map(name => node.getAttribute(name)).filter(value => value !== null))
      expect(painted.length).toBeGreaterThan(10)
      for (const value of painted) expect(value).toMatch(/^(none|currentColor|url\(#[\w-]+\)|var\(--mascot-[a-z-]+\))$/)
      for (const node of container.querySelectorAll('svg, svg *')) {
        for (const { name, value } of node.attributes) expect(value, `${node.tagName} ${name}`).not.toMatch(/(^|[^(])#[0-9a-f]{3,8}\b/i)
      }
      await expectNoA11yViolations(container)
    })
  })
})
