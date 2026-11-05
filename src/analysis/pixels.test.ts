import { describe, expect, it, vi } from 'vitest'
import { rememberLast } from './pixels'

describe('rememberLast', () => {
  it('loads each key once while it is among the last two', async () => {
    const load = vi.fn(async (key: string) => key.toUpperCase())
    const read = rememberLast(load)
    expect(await read('a')).toBe('A')
    expect(await read('a')).toBe('A')
    expect(await read('b')).toBe('B')
    expect(await read('a')).toBe('A')
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('forgets the one used longest ago when a third arrives', async () => {
    const load = vi.fn(async (key: string) => key)
    const read = rememberLast(load)
    await read('a')
    await read('b')
    await read('a') // a is now the most recent
    await read('c') // pushes out b
    await read('a')
    expect(load).toHaveBeenCalledTimes(3)
    await read('b')
    expect(load).toHaveBeenCalledTimes(4)
  })

  it('shares one load between callers that ask before it finishes', async () => {
    const load = vi.fn(async (key: string) => key)
    const read = rememberLast(load)
    await Promise.all([read('a'), read('a')])
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('does not keep a failure, so a retry can succeed', async () => {
    const load = vi.fn<(key: string) => Promise<string>>().mockRejectedValueOnce(new Error('down')).mockResolvedValue('ok')
    const read = rememberLast(load)
    await expect(read('a')).rejects.toThrow('down')
    await expect(read('a')).resolves.toBe('ok')
    expect(load).toHaveBeenCalledTimes(2)
  })
})
