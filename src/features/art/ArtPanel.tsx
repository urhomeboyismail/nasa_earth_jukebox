import { useId } from 'react'
import { Button, Slider } from '../../components'
import { ART_LABEL, BPM_RANGE, KEY_NAMES, MAX_NAME_LENGTH, SCALE_LABELS, SCALE_NAMES, TONIC_RANGE, describeChoice } from './presets'
import type { Art } from './useArt'

/**
 * Art mode on the Listen page: a key, a scale, a tempo and a brightness, saved as a preset, played on the data set, recorded and exported. Only those
 * four are here; there is no control that maps a picture's feature to a voice, because that mapping is the part that carries meaning.
 */
export function ArtPanel({ art }: { art: Art }) {
  const headingId = useId()
  const labelId = useId()
  const nameId = useId()
  const fileId = useId()
  return (
    <section className="art" aria-labelledby={headingId} aria-describedby={labelId}>
      <h2 id={headingId}>{ART_LABEL}</h2>
      <p id={labelId}>{ART_LABEL}</p>
      <Button pressed={art.on} onClick={art.toggle}>Art mode</Button>

      {art.on && (
        <>
          <p>{describeChoice(art.choice)}.</p>
          <Slider
            label="Key"
            min={TONIC_RANGE.min}
            max={TONIC_RANGE.max}
            value={art.choice.tonic}
            onChange={value => art.set('tonic', value)}
            describe={value => KEY_NAMES[value]}
          />
          <div role="group" aria-label="Scale">
            {SCALE_NAMES.map(scale => (
              <Button key={scale} pressed={art.choice.scale === scale} onClick={() => art.set('scale', scale)}>{SCALE_LABELS[scale]}</Button>
            ))}
          </div>
          <Slider
            label="Tempo"
            min={BPM_RANGE.min}
            max={BPM_RANGE.max}
            value={art.choice.bpm}
            onChange={value => art.set('bpm', value)}
            describe={value => `${value} beats a minute`}
          />
          <Slider
            label="Brightness"
            min={0}
            max={100}
            value={Math.round(art.choice.brightness * 100)}
            onChange={value => art.set('brightness', value / 100)}
            describe={value => `${value} percent`}
          />

          <p>A new key, scale, tempo or brightness starts the sound again: press Play to hear it.</p>

          <label htmlFor={nameId}>Preset name</label>
          <input id={nameId} type="text" value={art.name} maxLength={MAX_NAME_LENGTH} onChange={event => art.setName(event.currentTarget.value)} />
          <div role="group" aria-label="Preset">
            <Button onClick={art.save}>Save preset</Button>
            <Button onClick={art.exportFile}>Export preset</Button>
            <Button variant="primary" disabled={art.recording} onClick={art.record}>Record this art</Button>
          </div>
          <label htmlFor={fileId}>Import a preset file</label>
          <input
            id={fileId}
            type="file"
            accept=".json,application/json"
            onChange={event => {
              const file = event.currentTarget.files?.[0]
              if (file) art.importFile(file)
              event.currentTarget.value = ''
            }}
          />

          {art.saved.length > 0 && (
            <ul aria-label="Saved presets">
              {art.saved.map(({ name, choice }) => (
                <li key={name}>
                  <span>{name}: {describeChoice(choice)}. </span>
                  <Button onClick={() => art.load(name)}>{`Load ${name}`}</Button>
                  <Button onClick={() => art.rename(name)}>{`Rename ${name} to the name above`}</Button>
                  <Button onClick={() => art.remove(name)}>{`Delete ${name}`}</Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {art.status && <p>{art.status}</p>}
      {art.files.length > 0 && (
        <ul>
          {art.files.map(file => <li key={file.name}><a href={file.href} download={file.name}>{file.label}</a></li>)}
        </ul>
      )}
    </section>
  )
}
