import { describe, expect, it } from 'vitest'
import fixture from '../../public/data/fixture/manifest.json'
import syntheticChange from '../../public/data/synthetic-change/manifest.json'
import syntheticGlobe from '../../public/data/synthetic-globe/manifest.json'
import syntheticOcean from '../../public/data/synthetic-ocean/manifest.json'
import type { VideoSpec } from './types'
import { dateOfVideoFrame, dayNumber, videoFrameOf } from './video'

const weekly: VideoSpec = { src: 'video/x.mp4', fps: 12, firstFrameDate: '2026-01-01', frameStepDays: 7 }

describe('dayNumber', () => {
  it('counts days from 1970-01-01', () => {
    expect(dayNumber('1970-01-01')).toBe(0)
    expect(dayNumber('1970-01-02')).toBe(1)
    expect(dayNumber('2024-03-01')! - dayNumber('2024-02-28')!).toBe(2)
  })

  it('returns null for text that is not a real date', () => {
    for (const text of ['2024-02-30', '2023-02-29', '2024-13-01', '2024-1-1', 'soon', '']) expect(dayNumber(text)).toBeNull()
  })
})

describe('dateOfVideoFrame', () => {
  it('starts on the first frame date and moves by whole steps', () => {
    expect(dateOfVideoFrame(weekly, 0)).toBe('2026-01-01')
    expect(dateOfVideoFrame(weekly, 1)).toBe('2026-01-08')
    expect(dateOfVideoFrame(weekly, 9)).toBe('2026-03-05')
  })

  it('crosses a leap day and a year end', () => {
    const daily: VideoSpec = { ...weekly, firstFrameDate: '2024-02-28', frameStepDays: 1 }
    expect([1, 2].map(i => dateOfVideoFrame(daily, i))).toEqual(['2024-02-29', '2024-03-01'])
    expect(dateOfVideoFrame({ ...daily, firstFrameDate: '2025-12-31' }, 1)).toBe('2026-01-01')
  })

  it('refuses an index that is not a whole number of 0 or more', () => {
    for (const index of [-1, 1.5, Number.NaN]) expect(() => dateOfVideoFrame(weekly, index)).toThrow(RangeError)
  })
})

describe('videoFrameOf', () => {
  it('round-trips with dateOfVideoFrame for every frame of a grid', () => {
    for (let i = 0; i < 60; i++) expect(videoFrameOf(weekly, dateOfVideoFrame(weekly, i))).toBe(i)
  })

  it('returns null for a date off the grid or before the first frame', () => {
    expect(videoFrameOf(weekly, '2026-01-02')).toBeNull()
    expect(videoFrameOf(weekly, '2025-12-25')).toBeNull()
    expect(videoFrameOf(weekly, '2026-02-30')).toBeNull()
  })
})

describe('the video grid of every committed data set (golden)', () => {
  // The grid each set would need if it had a daily video starting on its first frame, and the video frame of each frame date.
  // Any change to the date arithmetic shows in the diff of src/data/__golden__/video-grid.json. To rewrite it after a change you
  // meant to make: `npx vitest run -u src/data/video.test.ts`, then read the diff before you commit it.
  it('matches the golden file', async () => {
    const sets = { fixture, 'synthetic-ocean': syntheticOcean, 'synthetic-globe': syntheticGlobe, 'synthetic-change': syntheticChange }
    const grids = Object.fromEntries(
      Object.entries(sets).map(([id, v]) => {
        const video: VideoSpec = { src: `video/${id}.mp4`, fps: 1, firstFrameDate: v.frames[0].date, frameStepDays: 1 }
        const frames = Object.fromEntries(v.frames.map(f => [f.date, videoFrameOf(video, f.date)]))
        return [id, { firstFrameDate: video.firstFrameDate, frameStepDays: video.frameStepDays, frames }]
      }),
    )
    await expect(`${JSON.stringify(grids, null, 2)}\n`).toMatchFileSnapshot('__golden__/video-grid.json')
  })
})
