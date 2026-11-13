import { describe, expect, it, vi } from 'vitest'
import { runDemo, type DemoDeps } from './runDemo'
import { DEMO_STEPS } from './script'

function deps(over: Partial<DemoDeps> = {}) {
  const log: string[] = []
  const all: DemoDeps = {
    goTo: page => log.push(`go:${page}`),
    say: text => log.push(`say:${text.slice(0, 12)}`),
    playAndWait: async () => { log.push('play') },
    sleep: async ms => { log.push(`sleep:${ms}`) },
    ...over,
  }
  return { log, all }
}

describe('runDemo', () => {
  it('goes to each page in order, says its line, then plays or waits', async () => {
    const { log, all } = deps()
    expect(await runDemo(DEMO_STEPS, all, new AbortController().signal)).toBe(true)
    expect(log.filter(entry => entry.startsWith('go:'))).toEqual(DEMO_STEPS.map(step => `go:${step.page}`))
    expect(log.filter(entry => entry === 'play')).toHaveLength(DEMO_STEPS.filter(step => step.play).length)
    // On every page it navigates, then speaks, then waits.
    expect(log.slice(0, 3)).toEqual(['go:home', 'say:Welcome to t', 'sleep:7000'])
  })

  it('stops between steps when aborted, and says it did not finish', async () => {
    const { log, all } = deps()
    const controller = new AbortController()
    const goTo = vi.fn((page: string) => { log.push(`go:${page}`); if (page === 'learn') controller.abort() })
    expect(await runDemo(DEMO_STEPS, { ...all, goTo }, controller.signal)).toBe(false)
    expect(goTo).toHaveBeenCalledTimes(2)
  })

  it('does nothing when it is already stopped', async () => {
    const { log, all } = deps()
    const controller = new AbortController()
    controller.abort()
    expect(await runDemo(DEMO_STEPS, all, controller.signal)).toBe(false)
    expect(log).toEqual([])
  })

  it('names no temperature, so it fits any data set (I02)', () => {
    expect(DEMO_STEPS.map(step => step.say).join(' ')).not.toMatch(/warm|cold|\bhot\b|temperature/i)
  })

  it('names only pages that exist and says nothing about a particular data set', () => {
    for (const step of DEMO_STEPS) expect(['home', 'learn', 'listen', 'compare', 'about']).toContain(step.page)
    expect(DEMO_STEPS.map(step => step.say).join(' ')).not.toMatch(/mauritius|ocean|sea ice|°C/i)
  })

  it('speaks each caption once, in order, before it waits or plays, when speakCaption is given', async () => {
    const { log, all } = deps({ speakCaption: async text => { log.push(`speak:${text.slice(0, 12)}`) } })
    expect(await runDemo(DEMO_STEPS, all, new AbortController().signal)).toBe(true)
    const spoken = log.filter(entry => entry.startsWith('speak:'))
    expect(spoken).toHaveLength(DEMO_STEPS.length)
    expect(log.slice(0, 4)).toEqual(['go:home', 'say:Welcome to t', 'speak:Welcome to t', 'sleep:7000'])
  })

  it('starts the dates only after the caption has been spoken', async () => {
    const { log, all } = deps({ speakCaption: async () => { log.push('spoken') } })
    await runDemo(DEMO_STEPS.filter(step => step.play), all, new AbortController().signal)
    expect(log.indexOf('spoken')).toBeLessThan(log.indexOf('play'))
  })

  it('stops after a caption if the demo was stopped while it spoke', async () => {
    const controller = new AbortController()
    const { log, all } = deps({ speakCaption: async () => { controller.abort() } })
    expect(await runDemo(DEMO_STEPS, all, controller.signal)).toBe(false)
    expect(log).not.toContain('play')
    expect(log.some(entry => entry.startsWith('sleep'))).toBe(false)
  })
  it('asks one question and waits for the answer before the next step (IX05)', async () => {
    const answered: Array<() => void> = []
    const { log, all } = deps({ predictAndWait: () => new Promise<void>(resolve => { log.push('predict'); answered.push(resolve) }) })
    const run = runDemo(DEMO_STEPS, all, new AbortController().signal)
    await vi.waitFor(() => expect(log).toContain('predict'))
    const asked = log.length
    await Promise.resolve()
    // Nothing after the question until it is answered.
    expect(log).toHaveLength(asked)
    expect(log.filter(entry => entry === 'predict')).toHaveLength(1)
    answered[0]()
    expect(await run).toBe(true)
    const names = DEMO_STEPS.map(step => step.page)
    expect(log.filter(entry => entry.startsWith('go:'))).toEqual(names.map(page => `go:${page}`))
    expect(log.indexOf('predict')).toBeLessThan(log.lastIndexOf('go:compare'))
  })

  it('only holds on the question step when the page has no player to ask (IX05)', async () => {
    const { log, all } = deps()
    await runDemo(DEMO_STEPS.filter(step => step.predict), all, new AbortController().signal)
    expect(log.some(entry => entry.startsWith('sleep'))).toBe(true)
    expect(log).not.toContain('predict')
  })

  it('has one question step, and it names no data set or value (IX05)', () => {
    const steps = DEMO_STEPS.filter(step => step.predict)
    expect(steps).toHaveLength(1)
    expect(steps[0].say).not.toMatch(/warm|cold|hot|temperature|mauritius|ocean|sea ice|°C/i)
  })
})
