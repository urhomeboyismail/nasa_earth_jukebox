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
      <div className="about__table" role="region" aria-label="Sound recipe" tabIndex={0}>
        <table>
          <caption>The seven voices, in the order the captions list them.</caption>
          <thead>
            <tr><th scope="col">Voice</th><th scope="col">What drives it</th><th scope="col">What it sounds like</th><th scope="col">Plays from</th></tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.voice}>
                <th scope="row">{row.name}</th>
                <td>{row.drivenBy}</td>
                <td>{row.sounds}</td>
                <td>{LEVEL_WORDS[row.detailLevel]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
