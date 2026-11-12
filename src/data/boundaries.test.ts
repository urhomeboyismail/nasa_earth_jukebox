import { describe, expect, it } from 'vitest'
import { playerUpdate, storedWelcome, studyCreated } from './boundaries'

describe('studyCreated', () => {
  it('accepts an answer with an id', () => {
    expect(studyCreated.safeParse({ id: 'abc' })).toMatchObject({ success: true, data: { id: 'abc' } })
  })

  it.each([{}, { id: '' }, { id: 7 }, null, 'abc'])('rejects %j', value => {
    expect(studyCreated.safeParse(value).success).toBe(false)
  })
})

describe('playerUpdate', () => {
  it('reads "playing" and keeps the rest of the summary', () => {
    expect(playerUpdate.safeParse({ playing: true, date: '2020-01-01' })).toMatchObject({ success: true, data: { playing: true, date: '2020-01-01' } })
    expect(playerUpdate.safeParse({ date: '2020-01-01' })).toMatchObject({ success: true, data: {} })
  })

  it.each([null, undefined, 'playing', { playing: 'yes' }])('rejects %j', value => {
    expect(playerUpdate.safeParse(value).success).toBe(false)
  })
})

describe('storedWelcome', () => {
  it('accepts a full valid choice', () => {
    const choice = { done: true, speech: true, path: 'map', volume: 0.5 }
    expect(storedWelcome.safeParse(choice)).toEqual({ success: true, data: choice })
  })

  it('drops each wrong field to its default instead of rejecting the whole choice', () => {
    const parsed = storedWelcome.safeParse({ done: 'yes', speech: 1, path: 'nowhere', volume: 2, extra: true })
    expect(parsed).toEqual({ success: true, data: { done: false, speech: false } })
  })

  it.each([null, 'done', 3])('rejects %j, which is not a stored choice at all', value => {
    expect(storedWelcome.safeParse(value).success).toBe(false)
  })
})
