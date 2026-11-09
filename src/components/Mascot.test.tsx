import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { expectNoA11yViolations } from '../test/a11y'
import { Echo, Sonny, type MascotPose } from './Mascot'

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

  it('gives each drawing its own clip path, so two on one page do not share one', () => {
    const { container } = render(<><Sonny /><Sonny /></>)
    const ids = [...container.querySelectorAll('clipPath')].map(clip => clip.id)
    expect(new Set(ids).size).toBe(2)
  })

  it('opens its mouth only while talking and shows sound waves only while listening or talking', () => {
    const drawn = (pose: MascotPose) => {
      const { container, unmount } = render(<Echo pose={pose} />)
      const result = { mouth: !!container.querySelector('.mascot__mouth'), waves: !!container.querySelector('.mascot__waves') }
      unmount()
      return result
    }
    expect(drawn('idle')).toEqual({ mouth: false, waves: false })
    expect(drawn('listening')).toEqual({ mouth: false, waves: true })
    expect(drawn('talking')).toEqual({ mouth: true, waves: true })
    expect(drawn('thinking')).toEqual({ mouth: false, waves: false })
  })
})
