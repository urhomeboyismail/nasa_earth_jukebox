// The find game's controls (ticket IX04), under the sound map: start and stop, the level, the target and the clock, and the best kept on this device.
// For touch and screen readers; F and gamepad Menu do the same from the map. The line is not a live region: the score is announced once by the hook.

import { Button, ButtonGroup } from '../../components'
import { clock } from './score'
import { LEVELS, type Level } from './targets'
import type { FindGame } from './useFindGame'

const LEVEL_OPTIONS = LEVELS.map(level => ({ value: String(level), label: `Level ${level}` }))
const asLevel = (value: string): Level => LEVELS.find(level => String(level) === value) ?? 1

export function FindPanel({ find }: { find: FindGame }) {
  if (!find.shown) return null
  return (
    <div className="find" role="group" aria-label="Find game">
      <Button pressed={find.playing} onClick={find.playing ? find.stop : find.start}>{find.playing ? 'Stop the find game' : 'Start the find game'}</Button>
      <ButtonGroup type="connected" legend="Level" options={LEVEL_OPTIONS} value={String(find.level)} disabled={find.playing} onChange={value => find.setLevel(asLevel(value))} />
      {find.line && <p className="find__line">{find.line}</p>}
      {find.best && <p className="find__best">Best at level {find.level}: {find.best.score} points in {clock(find.best.seconds)}.</p>}
    </div>
  )
}
