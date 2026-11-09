import { describe, expect, it } from 'vitest'
import {
  MAX_ANNOUNCEMENT, categoryChanged, edgeMessage, explorerMessage, fitAnnouncement, playerDateLine, playerStopLine, sweepEndMessage,
  type DateParts,
} from './announcements'

const warm: DateParts = { date: 'March 2024', label: 'warm', value: '21 °C', detail: 'rich' }
const missing: DateParts = { date: 'March 2025', label: 'not enough data', missing: true, detail: 'rich' }

describe('the player date line', () => {
  it('says the date, the label and the value in rich detail, and leaves the value out in concise detail', () => {
    expect(playerDateLine(warm)).toBe('March 2024: warm, about 21 °C')
    expect(playerDateLine({ ...warm, detail: 'concise' })).toBe('March 2024: warm')
  })

  it('leaves the value out when there is none', () => {
    expect(playerDateLine({ ...warm, value: undefined })).toBe('March 2024: warm')
  })

  it('uses "not enough data", and in rich detail the hiss', () => {
    expect(playerDateLine(missing)).toBe('March 2025: not enough data, so you hear the hiss')
    expect(playerDateLine({ ...missing, detail: 'concise' })).toBe('March 2025: not enough data')
  })

  it('gives the same words for the same input', () => {
    expect(playerDateLine(warm)).toBe(playerDateLine({ ...warm }))
  })
})

describe('the paused, stopped and finished line', () => {
  it('names the date it stopped at, in both levels of detail', () => {
    expect(playerStopLine('paused', { ...warm, date: 'June 2024', label: 'hot', value: '27 °C' })).toBe('Paused at June 2024: hot, about 27 °C.')
    expect(playerStopLine('paused', { ...warm, date: 'June 2024', label: 'hot', detail: 'concise' })).toBe('Paused at June 2024: hot.')
    expect(playerStopLine('stopped', { ...warm, detail: 'concise' })).toBe('Stopped at March 2024: warm.')
    expect(playerStopLine('finished', { ...warm, detail: 'concise' })).toBe('Finished at March 2024: warm.')
  })

  it('says not enough data when the date has none', () => {
    expect(playerStopLine('paused', missing)).toBe('Paused at March 2025: not enough data, so you hear the hiss.')
    expect(playerStopLine('stopped', { ...missing, detail: 'concise' })).toBe('Stopped at March 2025: not enough data.')
  })
})

describe('when playback says a date', () => {
  it('says the first date and any date whose category differs from the last one said', () => {
    expect(categoryChanged(null, 'warm')).toBe(true)
    expect(categoryChanged('warm', 'warm')).toBe(false)
    expect(categoryChanged('warm', 'hot')).toBe(true)
    expect(categoryChanged('hot', 'insufficient')).toBe(true)
  })
})

describe('the explorer messages', () => {
  const rich = 'Warm, about 21 °C, north-east (column 13 of 24, row 6 of 11).'
  const concise = 'Warm, 21 °C, north-east.'

  it('starts the first message, and the first after a new date, with the date', () => {
    expect(explorerMessage(rich, 'rich', 'March 2024')).toBe(`March 2024. ${rich}`)
    expect(explorerMessage(concise, 'concise', 'March 2024')).toBe(`March 2024. ${concise}`)
  })

  it('leaves the date out of later messages', () => {
    expect(explorerMessage(rich, 'rich')).toBe(rich)
    expect(explorerMessage(concise, 'concise')).toBe(concise)
  })

  it('names a cell without data in T90 words, with the date', () => {
    expect(explorerMessage('Not enough data (land, cloud or labels), north-west (column 1 of 24, row 1 of 11).', 'rich', 'March 2024'))
      .toBe('March 2024. Not enough data (land, cloud or labels), north-west (column 1 of 24, row 1 of 11).')
    expect(explorerMessage('Not enough data, north-west.', 'concise', 'March 2024')).toBe('March 2024. Not enough data, north-west.')
  })

  it('names an edge, the same in both levels of detail and well under both limits', () => {
    for (const edge of ['West', 'East', 'North', 'South'] as const) {
      expect(edgeMessage(edge)).toBe(`${edge} edge.`)
      expect(edgeMessage(edge).length).toBeLessThan(MAX_ANNOUNCEMENT.concise)
    }
  })

  it('says the end of a sweep as it was written when it fits', () => {
    expect(sweepEndMessage('Row 3, west to east: cool for 6 cells, mild for 8.', 'rich')).toBe('Row 3, west to east: cool for 6 cells, mild for 8.')
    expect(sweepEndMessage('Row 3: cool 6, mild 8.', 'concise')).toBe('Row 3: cool 6, mild 8.')
  })
})

describe('the length limits', () => {
  it('are 160 characters in rich detail and 60 in concise detail', () => {
    expect(MAX_ANNOUNCEMENT).toEqual({ rich: 160, concise: 60 })
  })

  it('leave a message that fits as it is, right at the limit', () => {
    const rich = 'a'.repeat(160)
    const concise = 'b'.repeat(60)
    expect(fitAnnouncement(rich, 'rich')).toBe(rich)
    expect(fitAnnouncement(concise, 'concise')).toBe(concise)
  })

  it('cut a long sweep at a comma and say there is more, within the limit', () => {
    const runs = Array.from({ length: 24 }, (_, i) => `${i % 2 ? 'mild' : 'cool'} for 1`).join(', ')
    const rich = fitAnnouncement(`Row 3, west to east: ${runs}.`, 'rich')
    expect(rich.length).toBeLessThanOrEqual(160)
    expect(rich).toMatch(/ and more\.$/)
    const concise = sweepEndMessage(`Row 3: ${runs}.`, 'concise')
    expect(concise.length).toBeLessThanOrEqual(60)
    expect(concise).toMatch(/ and more\.$/)
  })

  it('cut text with no comma at a word and end with an ellipsis, within the limit', () => {
    const out = fitAnnouncement('word '.repeat(40), 'concise')
    expect(out.length).toBeLessThanOrEqual(60)
    expect(out.endsWith('…')).toBe(true)
  })

  it('keep a long date line and a long explorer message within the limit', () => {
    const long = { date: 'A very long dataset date name for a test', label: 'extremely warm and also rather humid', value: '123456 kg per square metre', detail: 'concise' as const }
    expect(playerDateLine(long).length).toBeLessThanOrEqual(60)
    expect(playerStopLine('paused', { ...long, detail: 'rich' }).length).toBeLessThanOrEqual(160)
    expect(explorerMessage('x, '.repeat(80), 'rich', 'March 2024').length).toBeLessThanOrEqual(160)
  })

  it('keep the worst real cell description with a date within the limits', () => {
    const rich = 'Not enough data (land, cloud or labels), north-west (column 24 of 24, row 12 of 12).'
    expect(explorerMessage(rich, 'rich', '15 September 2024').length).toBeLessThanOrEqual(160)
    expect(explorerMessage('Not enough data, north-west.', 'concise', '15 September 2024').length).toBeLessThanOrEqual(60)
  })
})
