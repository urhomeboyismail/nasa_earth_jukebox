import { soundRecipe } from '../../describe/recipe'
import type { DetailLevel } from '../../data'
import type { Preset } from '../../sonify'

const LEVEL_WORDS: Record<DetailLevel, string> = { calm: 'Calm', standard: 'Standard', full: 'Full' }

/** What each of the seven voices follows and what it sounds like (ticket SN10), made from the active preset's rules. A real table, so it reads the same to a screen reader. */
export function SoundRecipe({ preset }: { preset: Preset }) {
  const rows = soundRecipe(preset)
  return (
    <>
      <p>The key is <strong>{preset.label}</strong>. {preset.note}</p>
      {/* On a phone each row becomes a card (about.css, LY02); the explicit roles keep it a table to screen readers then. */}
      <div className="about__table about__table--stack" role="region" aria-label="Sound recipe" tabIndex={0}>
        <table role="table">
          <caption>The seven voices, in the order the captions list them.</caption>
          <thead>
            <tr role="row"><th role="columnheader" scope="col">Voice</th><th role="columnheader" scope="col">What drives it</th><th role="columnheader" scope="col">What it sounds like</th><th role="columnheader" scope="col">Plays from</th></tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.voice} role="row">
                <th role="rowheader" scope="row">{row.name}</th>
                <td role="cell" data-label="What drives it">{row.drivenBy}</td>
                <td role="cell" data-label="What it sounds like">{row.sounds}</td>
                <td role="cell" data-label="Plays from">{LEVEL_WORDS[row.detailLevel]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
