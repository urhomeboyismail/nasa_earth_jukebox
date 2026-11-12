import { afterEach, describe, expect, it } from 'vitest'
import { readWelcome, resetWelcome, saveWelcome, WELCOME_KEY } from './storage'

afterEach(() => { resetWelcome(); localStorage.clear() })

describe('the stored welcome choice', () => {
  it('round-trips a valid choice', () => {
    saveWelcome({ done: true, speech: true, path: 'screen-reader', volume: 0.4 })
    expect(readWelcome()).toStrictEqual({ done: true, speech: true, path: 'screen-reader', volume: 0.4 })
  })

  it('falls back to no path when the stored path is wrong', () => {
    localStorage.setItem(WELCOME_KEY, JSON.stringify({ done: true, path: 'nowhere', volume: 0.3 }))
    expect(readWelcome()).toStrictEqual({ done: true, speech: false, volume: 0.3 })
  })

  it('drops a volume outside 0 to 1', () => {
    localStorage.setItem(WELCOME_KEY, JSON.stringify({ done: true, path: 'map', volume: 2 }))
    expect(readWelcome()).toStrictEqual({ done: true, speech: false, path: 'map' })
  })

  it('treats missing fields as not done and silent', () => {
    localStorage.setItem(WELCOME_KEY, '{}')
    expect(readWelcome()).toStrictEqual({ done: false, speech: false })
  })

  it.each(['not json', 'null', '"done"', '5'])('ignores stored text %j that is not a choice', text => {
    localStorage.setItem(WELCOME_KEY, text)
    expect(readWelcome()).toStrictEqual({ done: false, speech: false })
  })
})
