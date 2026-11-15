import { describe, expect, it } from 'vitest'
import { RECORD_LIMIT_S, closeAt, downloadName, durationWords, logCursor, logDate, recordingStatus, startLog, stepsFromLog } from './record'

describe('record', () => {
  it('turns the log into steps in time order, from the date changes only', () => {
    let log = startLog(2)
    log = logCursor(log, 3, 4, 500)
    log = logDate(log, 5, 1000)
    log = logCursor(log, 4, 4, 1500)
    log = logDate(log, 1, 2500)
    expect(stepsFromLog(log)).toEqual([
      { index: 2, atSeconds: 0 },
      { index: 5, atSeconds: 1 },
      { index: 1, atSeconds: 2.5 },
    ])
  })

  it('never lets time go backwards', () => {
    let log = startLog(0)
    log = logDate(log, 1, 2000)
    log = logDate(log, 2, 1000)
    expect(stepsFromLog(log).map(s => s.atSeconds)).toEqual([0, 2, 2])
  })

  it('stops the log at the limit and ignores what comes after', () => {
    let log = startLog(0)
    log = logDate(log, 1, 5000)
    log = logDate(log, 2, RECORD_LIMIT_S * 1000)
    expect(log.full).toBe(true)
    log = logDate(log, 3, 1000)
    expect(stepsFromLog(log).map(s => s.index)).toEqual([0, 1])
  })

  it('is full when the clock passes the limit with nothing happening', () => {
    expect(closeAt(startLog(0), RECORD_LIMIT_S * 1000 - 1).full).toBe(false)
    expect(closeAt(startLog(0), RECORD_LIMIT_S * 1000).full).toBe(true)
  })

  it('keeps the limit inside the render limit of 180 seconds', () => {
    expect(RECORD_LIMIT_S).toBeLessThanOrEqual(180 - 1.5)
  })

  it('says the time in words', () => {
    expect(durationWords(1)).toBe('1 second')
    expect(durationWords(45)).toBe('45 seconds')
    expect(durationWords(60)).toBe('1 minute')
    expect(durationWords(80)).toBe('1 minute 20 seconds')
    expect(recordingStatus(80.9)).toBe('Recording: 1 minute 20 seconds.')
  })

  it('names the file from the data set id and the time', () => {
    expect(downloadName('fixture', new Date('2026-11-13T09:05:07Z'))).toBe('fixture-20261113-090507.wav')
  })
})
