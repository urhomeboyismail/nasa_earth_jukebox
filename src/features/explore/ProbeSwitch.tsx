// The explorer's "Continuous tone" and "Slope cue" switches (ticket SN09). Turning the tone on makes no sound: the next press on the map does.

import type { ProbeSettings } from './probeAudio'

export function ProbeSwitch({ settings }: { settings: ProbeSettings }) {
  return (
    <fieldset>
      <legend>How a place sounds</legend>
      <label>
        <input type="checkbox" checked={settings.tone} onChange={event => settings.setTone(event.target.checked)} />
        <span>Continuous tone: the pitch glides as you move</span>
      </label>
      <label>
        <input type="checkbox" checked={settings.tone && settings.slopeCue} disabled={!settings.tone} onChange={event => settings.setSlopeCue(event.target.checked)} />
        <span>Slope cue: brighter where the values rise nearby</span>
      </label>
    </fieldset>
  )
}
