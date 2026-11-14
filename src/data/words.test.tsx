import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import fixture from '../../public/data/fixture/manifest.json'
import { describeSequence } from '../describe'
import ComparePage from '../features/compare'
import HomePage from '../features/home'
import { answerText } from '../features/compare/judge'
import { visualizationSchema } from './schema'
import type { Visualization } from './types'
import { DEFAULT_WORDS, higherPhrase, variableWords } from './words'

// jsdom has no ResizeObserver, which the RangeSlider (Radix) in Compare uses to measure its handles.
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })


vi.mock('../audio', () => ({
  createSoundEngine: () => ({ unlock: async () => {}, playCategory: () => {}, playMissing: () => {}, stop: () => {}, setStyle: () => {}, setSpatial: () => {} }),
}))
const CATEGORIES = ['cold', 'mild', 'hot', 'insufficient']
vi.mock('../analysis', () => ({ analyzeAll: async () => [] }))

const base = fixture as unknown as Visualization
const iceWords = { higher: 'more ice', lower: 'less ice', highest: 'most ice', lowest: 'least ice', edge: 'ice edge', thing: '' }
const ice: Visualization = { ...base, variable: { ...base.variable, words: iceWords } }
// The fixture sets its own words (the temperature ones); this is the same data set with none, so it gets the defaults.
const bare: Visualization = { ...base, variable: { name: base.variable.name, unit: base.variable.unit } }

describe('variable.words', () => {
  it('is optional: a manifest without it validates and uses the default words', () => {
    expect(visualizationSchema.safeParse(bare).success).toBe(true)
    expect(variableWords(bare.variable)).toEqual(DEFAULT_WORDS)
    expect(variableWords(undefined)).toEqual(DEFAULT_WORDS)
    expect(higherPhrase(DEFAULT_WORDS)).toBe('higher values')
  })

  it('has default words that name no temperature', () => {
    for (const word of Object.values(DEFAULT_WORDS)) expect(word).not.toMatch(/warm|cold|cool|hot|temperature|water/i)
  })

  it('reads as before for a data set that sets its own words: the fixture says "warmer water"', () => {
    expect(variableWords(base.variable)).toEqual({ higher: 'warmer', lower: 'cooler', highest: 'warmest', lowest: 'coolest', edge: 'warm edge', thing: 'water' })
    expect(higherPhrase(variableWords(base.variable))).toBe('warmer water')
  })

  it('takes some words and defaults the rest', () => {
    const partial = { ...base, variable: { ...base.variable, words: { higher: 'wetter' } } }
    expect(visualizationSchema.safeParse(partial).success).toBe(true)
    expect(variableWords(partial.variable)).toEqual({ ...DEFAULT_WORDS, higher: 'wetter' })
  })

  it('rejects an empty word and a word it does not know', () => {
    expect(visualizationSchema.safeParse({ ...base, variable: { ...base.variable, words: { higher: '' } } }).success).toBe(false)
    expect(visualizationSchema.safeParse({ ...base, variable: { ...base.variable, words: { hotter: 'x' } } }).success).toBe(false)
  })

  it('reaches Home', () => {
    render(<HomePage visualization={ice} />)
    expect(screen.getByText(/which date shows more ice, and when/)).toBeInTheDocument()
    expect(screen.queryByText(/warmer/)).not.toBeInTheDocument()
  })

  it('reaches Compare: the question, the answers and the revealed answer text', async () => {
    render(<ComparePage visualization={{ ...ice, comparisons: [] }} />)
    await waitFor(() => expect(screen.getByRole('radio', { name: 'A is more ice' })).toBeInTheDocument())
    expect(screen.getByText('Which date shows more ice?')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'B is more ice' })).toBeInTheDocument()
    expect(answerText('a', false, variableWords(ice.variable))).toBe('Date A is more ice')
    expect(answerText('b')).toBe('Date B is higher')
    expect(answerText('b', false, variableWords(base.variable))).toBe('Date B is warmer')
  })

  it('reaches describeSequence', () => {
    const results = base.frames.map((frame, i) => ({ frameId: frame.id, regionId: base.regions[0].id, sampled: 9, valid: 9, category: CATEGORIES[i] ?? 'cold' }))
    expect(describeSequence(base, results)).toMatch(/Warmest: .*Coolest: /)
    expect(describeSequence(bare, results)).toMatch(/Highest: .*Lowest: /)
    expect(describeSequence(bare, results)).not.toMatch(/Warmest|Coolest/)
    expect(describeSequence(ice, results)).toMatch(/Most ice: .*Least ice: /)
    expect(describeSequence(ice, results)).not.toMatch(/Warmest|Coolest/)
  })
})
