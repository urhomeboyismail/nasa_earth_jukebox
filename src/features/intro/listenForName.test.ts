import { describe, expect, it } from 'vitest'
import { cleanName } from './listenForName'

describe('cleanName', () => {
  it.each([['my name is Ana.', 'Ana'], ["I'm Sam", 'Sam'], ['call me Bo', 'Bo'], ['Maria', 'Maria']])('%s', (said, name) => {
    expect(cleanName(said)).toBe(name)
  })
})
