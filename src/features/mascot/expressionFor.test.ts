import { describe, expect, it } from 'vitest'
import { expressionFor, IDLE_REST_MS, type FaceState } from './expressionFor'

const calm: FaceState = { loading: false, voice: 'idle', playing: false, idleMs: 0, hidden: false }
const face = (change: Partial<FaceState>) => expressionFor({ ...calm, ...change })

describe('expressionFor', () => {
  it('is happy when nothing is going on', () => {
    expect(face({})).toBe('happy')
  })

  it('searches while a data set loads or the voice guide connects', () => {
    expect(face({ loading: true })).toBe('searching')
    expect(face({ voice: 'connecting' })).toBe('searching')
  })

  it('shows the equaliser while playing or while the voice guide speaks', () => {
    expect(face({ playing: true })).toBe('eq_active')
    expect(face({ voice: 'speaking' })).toBe('eq_active')
  })

  it('rests when the tab is hidden or there has been no input for a minute', () => {
    expect(face({ hidden: true })).toBe('resting')
    expect(face({ idleMs: IDLE_REST_MS - 1 })).toBe('happy')
    expect(face({ idleMs: IDLE_REST_MS })).toBe('resting')
  })

  it('shows an alert for an alert tip', () => {
    expect(face({ tipMood: 'alert' })).toBe('alert')
  })

  it('keeps the order: alert, then loading, then playing, then resting', () => {
    expect(face({ tipMood: 'alert', loading: true, playing: true, hidden: true })).toBe('alert')
    expect(face({ loading: true, playing: true, hidden: true })).toBe('searching')
    expect(face({ playing: true, hidden: true })).toBe('eq_active')
    expect(face({ voice: 'listening', idleMs: IDLE_REST_MS })).toBe('resting')
  })
})
