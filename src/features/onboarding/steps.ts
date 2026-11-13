// The first-minute game (ticket IX11): four small tasks that teach the keys by doing them. This file is the pure part: which step a listener is on, and what an
// action or event does to it. Nothing here reads the clock, storage or the DOM, and nothing is random, so the same actions always give the same steps.

import type { VariableWords } from '../../data/types'
import type { Action } from '../../interaction/actions'

export type StepId = 'move' | 'find' | 'query' | 'lock'

/** What counts, beyond an `Action`: IX04 found its first target. */
export type GameEvent = Action | { type: 'found' }

export type Progress = {
  /** 0 to 3 is a step; STEP_IDS.length is done. */
  step: number
  /** Moves seen in the first step. */
  moves: number
  /** Whether the place is locked now, which the last step needs before a date change counts. */
  locked: boolean
}

export const STEP_IDS: readonly StepId[] = ['move', 'find', 'query', 'lock']
export const MOVES_NEEDED = 3
export const START: Progress = { step: 0, moves: 0, locked: false }

/** Whether a `move` lands on another place: one clamped at the map's edge goes nowhere, so it teaches nothing and is not counted. */
export function landsOnAnotherPlace(action: Extract<Action, { type: 'move' }>, cursor: { col: number; row: number }, size: { cols: number; rows: number }): boolean {
  const col = Math.min(size.cols - 1, Math.max(0, cursor.col + action.dx))
  const row = Math.min(size.rows - 1, Math.max(0, cursor.row + action.dy))
  return col !== cursor.col || row !== cursor.row
}

export const isDone = (progress: Progress) => progress.step >= STEP_IDS.length

/** The visible prompt of a step, in the data set's own words. It is text; its words are read only on request. */
export function promptFor(id: StepId, words: Pick<VariableWords, 'highest'>): string {
  switch (id) {
    case 'move': return 'Move with an arrow key. Each place you land on makes a sound.'
    case 'find': return `Find the ${words.highest} place. Press F to start the find game.`
    case 'query': return "Press I to ask what's here."
    case 'lock': return 'Press L to lock this place, then move the Date slider to hear it on other dates.'
  }
}

/** The progress after `event`. An event that is not the step's own returns `progress` itself. */
export function advance(progress: Progress, event: GameEvent): Progress {
  const id = STEP_IDS[progress.step]
  if (id === undefined) return progress
  switch (id) {
    case 'move': {
      if (event.type !== 'move') return progress
      const moves = progress.moves + 1
      return moves >= MOVES_NEEDED ? { ...progress, step: 1, moves } : { ...progress, moves }
    }
    case 'find':
      return event.type === 'found' ? { ...progress, step: 2 } : progress
    case 'query':
      return event.type === 'query' ? { ...progress, step: 3 } : progress
    case 'lock':
      // L toggles, as it does on the map. Only a date change while the place is locked finishes the game.
      if (event.type === 'lock') return { ...progress, locked: !progress.locked }
      if (event.type === 'scrubTime' && progress.locked) return { ...progress, step: STEP_IDS.length }
      return progress
  }
}
