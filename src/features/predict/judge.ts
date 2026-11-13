// The judge for "predict, then hear" (docs/PLAN.md §6.3, ticket IX05): pure functions over SN01's `FrameFeatures`. The questions are about the largest warm
// area that SN01 tracks from one date to the one two steps later; the right answer is read from those two frames, never chosen. A question is offered
// only when the spot exists at both ends: no track, no question. Nothing here is random, so the same frames always give the same question and answer.

import { FEATURE_COLS, FEATURE_ROWS, type FrameFeatures, type Hotspot } from '../../analysis/features/types'

export type Tracked = Pick<FrameFeatures, 'hotspots'>

export type QuestionKind = 'size' | 'direction'

export type Choice = {
  id: string
  /** The button. */
  label: string
  /** What the listener said, to finish "You said …". */
  said: string
  /** What happened, as a sentence, when this is the right answer. */
  happened: string
}

export type Question = {
  kind: QuestionKind
  /** The tracked hot spot (SN01 id) the question is about. */
  spotId: string
  text: string
  choices: Choice[]
}

/** The area must change by more than this share to count as bigger or smaller. */
export const SIZE_CHANGE = 0.1
/** The centroid must move more than this many cells (of FEATURE_COLS × FEATURE_ROWS) to count as moving. */
export const MOVE_CELLS = 1

const SIZE_CHOICES: Choice[] = [
  { id: 'bigger', label: 'Bigger', said: 'bigger', happened: 'It got bigger.' },
  { id: 'smaller', label: 'Smaller', said: 'smaller', happened: 'It got smaller.' },
  { id: 'same', label: 'About the same', said: 'about the same', happened: 'It stayed about the same.' },
]

const DIRECTION_CHOICES: Choice[] = [
  { id: 'north', label: 'North', said: 'north', happened: 'It moved north.' },
  { id: 'south', label: 'South', said: 'south', happened: 'It moved south.' },
  { id: 'east', label: 'East', said: 'east', happened: 'It moved east.' },
  { id: 'west', label: 'West', said: 'west', happened: 'It moved west.' },
  { id: 'still', label: 'It stays put', said: 'it stays put', happened: 'It stayed put.' },
]

const TEXT: Record<QuestionKind, string> = {
  size: 'Will the warm area get bigger, smaller, or stay about the same?',
  direction: 'Which way will the warm area move?',
}

/** The largest warm spot of `now` that SN01 also tracks in `later`, as its two ends. */
function trackedWarmSpot(now: Tracked, later: Tracked): { before: Hotspot; after: Hotspot } | null {
  for (const before of now.hotspots) {
    if (before.band !== 'high') continue
    const after = later.hotspots.find(spot => spot.id === before.id && spot.band === before.band)
    if (after) return { before, after }
  }
  return null
}

function sizeAnswer(before: Hotspot, after: Hotspot): string {
  const change = (after.cells - before.cells) / Math.max(1, before.cells)
  if (change > SIZE_CHANGE) return 'bigger'
  if (change < -SIZE_CHANGE) return 'smaller'
  return 'same'
}

function directionAnswer(before: Hotspot, after: Hotspot): string {
  // In cells, so a step across and a step down count the same. y grows to the south.
  const across = (after.centroid.x - before.centroid.x) * FEATURE_COLS
  const down = (after.centroid.y - before.centroid.y) * FEATURE_ROWS
  if (Math.max(Math.abs(across), Math.abs(down)) <= MOVE_CELLS) return 'still'
  if (Math.abs(across) >= Math.abs(down)) return across > 0 ? 'east' : 'west'
  return down > 0 ? 'south' : 'north'
}

/** The id of the right choice, from the date and the date two steps later, or null when the spot is not tracked at both ends. */
export function answerFor(question: Question, now: Tracked, later: Tracked): string | null {
  const before = now.hotspots.find(spot => spot.id === question.spotId)
  const after = later.hotspots.find(spot => spot.id === question.spotId)
  if (!before || !after || before.band !== after.band) return null
  return question.kind === 'size' ? sizeAnswer(before, after) : directionAnswer(before, after)
}

/** The questions that can be asked of this date, size first. Empty when no warm spot is tracked to the later date. */
export function questionsFor(now: Tracked, later: Tracked): Question[] {
  const tracked = trackedWarmSpot(now, later)
  if (!tracked) return []
  const asked: Question[] = [
    { kind: 'size', spotId: tracked.before.id, text: TEXT.size, choices: SIZE_CHOICES },
    { kind: 'direction', spotId: tracked.before.id, text: TEXT.direction, choices: DIRECTION_CHOICES },
  ]
  return asked.filter(question => answerFor(question, now, later) !== null)
}

/** "You said bigger. It got smaller." The right answer's own sentence follows what the listener said. */
export function revealText(question: Question, chosen: string, correct: string): string {
  const said = question.choices.find(choice => choice.id === chosen)
  const happened = question.choices.find(choice => choice.id === correct)
  return `You said ${said?.said ?? chosen}. ${happened?.happened ?? ''}`.trim()
}
