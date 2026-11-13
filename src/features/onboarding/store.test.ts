import { afterEach, describe, expect, it, vi } from 'vitest'
import { ONBOARDING_KEY, readOnboardingDone, resetOnboarding, saveOnboardingDone } from './store'

afterEach(() => { vi.restoreAllMocks(); resetOnboarding(); localStorage.clear() })

describe('the stored first-minute flag', () => {
  it('is not done until it is saved, and round-trips', () => {
    expect(readOnboardingDone()).toBe(false)
    saveOnboardingDone()
    expect(readOnboardingDone()).toBe(true)
    expect(JSON.parse(localStorage.getItem(ONBOARDING_KEY) ?? '')).toStrictEqual({ done: true })
  })

  it('offers the game again after a reset', () => {
    saveOnboardingDone()
    resetOnboarding()
    expect(readOnboardingDone()).toBe(false)
  })

  it.each(['not json', 'null', '"done"', '5', '{}', '{"done":"yes"}'])('counts stored text %j that is not a flag as not done', text => {
    localStorage.setItem(ONBOARDING_KEY, text)
    expect(readOnboardingDone()).toBe(false)
  })

  it('still holds for this visit when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    saveOnboardingDone()
    expect(readOnboardingDone()).toBe(true)
  })
})
