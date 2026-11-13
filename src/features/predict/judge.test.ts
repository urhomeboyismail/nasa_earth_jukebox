import { describe, expect, it } from 'vitest'
import { FEATURE_COLS, FEATURE_ROWS } from '../../analysis/features/types'
import { spot } from '../../sonify/testFeatures'
import { answerFor, questionsFor, revealText, type Question } from './judge'

const CELL_X = 1 / FEATURE_COLS
const CELL_Y = 1 / FEATURE_ROWS
const at = (hotspots: ReturnType<typeof spot>[]) => ({ hotspots })
const sized = (cells: number, x = 0.5, y = 0.5, id = 'h1') => ({ ...spot(id, 'high', x, y), cells })

const size = (now: number, later: number) => {
  const a = at([sized(now)])
  const b = at([sized(later)])
  const question = questionsFor(a, b).find(q => q.kind === 'size') as Question
  return answerFor(question, a, b)
}
const direction = (dx: number, dy: number) => {
  const a = at([sized(40, 0.5, 0.5)])
  const b = at([sized(40, 0.5 + dx * CELL_X, 0.5 + dy * CELL_Y)])
  const question = questionsFor(a, b).find(q => q.kind === 'direction') as Question
  return answerFor(question, a, b)
}

describe('questionsFor', () => {
  it('offers the size and the direction when the largest warm spot is tracked at both ends', () => {
    const questions = questionsFor(at([sized(40)]), at([sized(60)]))
    expect(questions.map(q => q.kind)).toEqual(['size', 'direction'])
    expect(questions.every(q => q.spotId === 'h1')).toBe(true)
  })

  it('offers nothing when the spot has no track at the later date', () => {
    expect(questionsFor(at([sized(40)]), at([sized(40, 0.5, 0.5, 'h2')]))).toEqual([])
    expect(questionsFor(at([sized(40)]), at([]))).toEqual([])
    expect(questionsFor(at([]), at([sized(40)]))).toEqual([])
  })

  it('ignores cool spots: only the warm area is asked about', () => {
    expect(questionsFor(at([spot('h1', 'low', 0.5, 0.5)]), at([spot('h1', 'low', 0.5, 0.5)]))).toEqual([])
  })

  it('asks about the largest warm spot that is tracked, skipping one that is lost', () => {
    const now = at([sized(80, 0.2, 0.2, 'h1'), sized(30, 0.7, 0.7, 'h2')])
    const later = at([sized(30, 0.7, 0.7, 'h2')])
    expect(questionsFor(now, later)[0].spotId).toBe('h2')
  })

  it('gives the same questions for the same frames', () => {
    const now = at([sized(40)])
    const later = at([sized(60)])
    expect(questionsFor(now, later)).toEqual(questionsFor(now, later))
  })
})

describe('answerFor: size', () => {
  it.each([
    [40, 60, 'bigger'],
    [60, 40, 'smaller'],
    [40, 42, 'same'],
    [40, 38, 'same'],
    [40, 44, 'same'],
    [40, 45, 'bigger'],
    [40, 35, 'smaller'],
  ])('%i cells then %i cells is "%s"', (now, later, expected) => {
    expect(size(now, later)).toBe(expected)
  })
})

describe('answerFor: direction', () => {
  it.each([
    [0, -6, 'north'],
    [0, 6, 'south'],
    [6, 0, 'east'],
    [-6, 0, 'west'],
    [6, -2, 'east'],
    [2, -6, 'north'],
    [1, 0, 'still'],
    [0, 1, 'still'],
    [0.5, -0.5, 'still'],
    [0, 0, 'still'],
  ])('a move of (%f, %f) cells is "%s"', (dx, dy, expected) => {
    expect(direction(dx, dy)).toBe(expected)
  })

  it('returns null when the spot is not at both ends', () => {
    const question = questionsFor(at([sized(40)]), at([sized(40)]))[0]
    expect(answerFor(question, at([sized(40)]), at([]))).toBeNull()
  })
})

describe('revealText', () => {
  const question = questionsFor(at([sized(40)]), at([sized(60)]))[0]
  it('says what the listener said, then what happened', () => {
    expect(revealText(question, 'bigger', 'smaller')).toBe('You said bigger. It got smaller.')
    expect(revealText(question, 'bigger', 'bigger')).toBe('You said bigger. It got bigger.')
    expect(revealText(question, 'same', 'bigger')).toBe('You said about the same. It got bigger.')
  })
})
