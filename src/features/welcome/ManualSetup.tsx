// The welcome without the chat (JB11): the same choices as one plain form. The state lives in Welcome, so switching views keeps it.

import { useId } from 'react'
import { Button } from '../../components'
import type { PresetId } from '../../data'
import { NAME_MAX } from '../intro/storage'
import { PATH_LABELS, TUNE_CHIPS } from './lines'
import type { WelcomePath } from './storage'

const PATHS: WelcomePath[] = ['screen-reader', 'map', 'play']

type Props = {
  name: string
  onName: (name: string) => void
  /** null: the data set's own sound. */
  style: PresetId | null
  onStyle: (style: PresetId | null) => void
  path: WelcomePath
  onPath: (path: WelcomePath) => void
  onSave: () => void
}

export function ManualSetup({ name, onName, style, onStyle, path, onPath, onSave }: Props) {
  const id = useId()
  return (
    <form
      className="welcome__form"
      aria-label="Manual setup"
      onSubmit={event => { event.preventDefault(); onSave() }}
    >
      <label className="welcome__field" htmlFor={`${id}-name`}>
        What should I call you? (optional)
        <input id={`${id}-name`} type="text" maxLength={NAME_MAX} autoComplete="off" value={name} onChange={event => onName(event.target.value)} />
      </label>
      <label className="welcome__field" htmlFor={`${id}-style`}>
        Audio preference
        <select id={`${id}-style`} value={style ?? ''} onChange={event => onStyle(TUNE_CHIPS.find(chip => chip.id === event.target.value)?.id ?? null)}>
          <option value="">The data set&apos;s own sound</option>
          {TUNE_CHIPS.map(chip => <option key={chip.id} value={chip.id}>{chip.label}</option>)}
        </select>
      </label>
      <fieldset className="welcome__field">
        <legend>How you will use it</legend>
        {PATHS.map(option => (
          <label key={option} className="welcome__radio">
            <input type="radio" name={`${id}-path`} checked={path === option} onChange={() => onPath(option)} />
            {PATH_LABELS[option]}
          </label>
        ))}
      </fieldset>
      <div className="welcome__buttons">
        <Button type="submit" variant="filled">Save &amp; Enter Jukebox</Button>
      </div>
    </form>
  )
}
