// Example: how to test a component for accessibility, and a check that the helper catches real problems.
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import fixture from '../../public/data/fixture/manifest.json'
import type { Visualization } from '../data'
import HomePage from '../features/home'
import { expectNoA11yViolations } from './a11y'
import { installFakeAudioContext, installFakeWorker } from './fakes'

afterEach(() => { installFakeAudioContext().uninstall() })

describe('the Home page', () => {
  it('has no accessibility violations while loading', async () => {
    const { container } = render(<HomePage visualization={null} />)
    await expectNoA11yViolations(container)
  })

  it('has no accessibility violations once the data has loaded', async () => {
    const { container } = render(<HomePage visualization={fixture as Visualization} />)
    await expectNoA11yViolations(container)
  })
})

describe('expectNoA11yViolations', () => {
  it('fails, naming the rule, for an image without alternative text', async () => {
    const { container } = render(<img src="x.png" />)
    await expect(expectNoA11yViolations(container)).rejects.toThrow(/image-alt/)
  })

  it('fails for a button with no name', async () => {
    const { container } = render(<button type="button" />)
    await expect(expectNoA11yViolations(container)).rejects.toThrow(/button-name/)
  })
})

describe('fakes', () => {
  it('fake AudioContext starts suspended, runs after resume() and records oscillators', async () => {
    const audio = installFakeAudioContext()
    const context = new AudioContext()
    expect(context.state).toBe('suspended')
    await context.resume()
    expect(context.state).toBe('running')
    const oscillator = context.createOscillator()
    oscillator.start()
    expect(audio.contexts).toHaveLength(1)
    expect((audio.contexts[0] as unknown as { oscillators: { started: number[] }[] }).oscillators[0].started).toEqual([0])
  })

  it('fake Worker answers postMessage through onmessage and can be terminated', async () => {
    const workers = installFakeWorker(message => ({ echoed: message }))
    const worker = new Worker('worker.js')
    const reply = new Promise<unknown>(resolve => { worker.onmessage = event => resolve(event.data) })
    worker.postMessage({ n: 1 })
    expect(await reply).toEqual({ echoed: { n: 1 } })
    expect(workers.workers).toHaveLength(1)
    worker.terminate()
    expect((workers.workers[0] as unknown as { terminated: boolean }).terminated).toBe(true)
  })
})
