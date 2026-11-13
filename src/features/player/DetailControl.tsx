import { DETAIL_LEVELS, type DetailLevel } from '../../data'
import { DETAIL_WORDS } from './symphonyState'

type Props = { detail: DetailLevel; onChange: (level: DetailLevel) => void }

/** How many voices play: Calm, Standard or Full. Native radio buttons, so the arrow keys move the choice. */
export function DetailControl({ detail, onChange }: Props) {
  return (
    <fieldset className="symphony__detail">
      <legend>Detail</legend>
      {DETAIL_LEVELS.map(level => (
        <label key={level} className="player__style-option">
          <input type="radio" name="symphony-detail" value={level} checked={detail === level} onChange={() => onChange(level)} />
          <span>{DETAIL_WORDS[level]}</span>
        </label>
      ))}
    </fieldset>
  )
}
