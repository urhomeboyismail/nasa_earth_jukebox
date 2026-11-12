import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ANSWER_LENGTH_KEY, MIC_CONSENT_KEY, MIC_TALK_KEY,
  readAnswerLength, readMicConsent, readMicTalk, saveAnswerLength, saveMicConsent, saveMicTalk,
} from './consent'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('the microphone choice (V02)', () => {
  it('is not decided until one is stored, and can be forgotten', () => {
    expect(readMicConsent()).toBeNull()
    saveMicConsent('mic')
    expect(localStorage.getItem(MIC_CONSENT_KEY)).toBe('mic')
    expect(readMicConsent()).toBe('mic')
    saveMicConsent('text')
    expect(readMicConsent()).toBe('text')
    saveMicConsent(null)
    expect(localStorage.getItem(MIC_CONSENT_KEY)).toBeNull()
    expect(readMicConsent()).toBeNull()
  })

  it('reads anything else in storage as not decided', () => {
    for (const value of ['yes', 'MIC', '', '"mic"']) {
      localStorage.setItem(MIC_CONSENT_KEY, value)
      expect(readMicConsent()).toBeNull()
    }
  })

  it('is push-to-talk unless the open mic was chosen', () => {
    expect(readMicTalk()).toBe('push')
    saveMicTalk('open')
    expect(localStorage.getItem(MIC_TALK_KEY)).toBe('open')
    expect(readMicTalk()).toBe('open')
    localStorage.setItem(MIC_TALK_KEY, 'loud')
    expect(readMicTalk()).toBe('push')
  })

  it('gives short answers unless detailed ones were chosen', () => {
    expect(readAnswerLength()).toBe('short')
    saveAnswerLength('detailed')
    expect(localStorage.getItem(ANSWER_LENGTH_KEY)).toBe('detailed')
    expect(readAnswerLength()).toBe('detailed')
  })

  it('reads blocked storage as not decided and writes nothing, without throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError') })
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError') })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError') })
    expect(readMicConsent()).toBeNull()
    expect(readMicTalk()).toBe('push')
    expect(readAnswerLength()).toBe('short')
    expect(() => { saveMicConsent('mic'); saveMicConsent(null); saveMicTalk('open'); saveAnswerLength('detailed') }).not.toThrow()
    expect(setItem).toHaveBeenCalled()
  })
})
