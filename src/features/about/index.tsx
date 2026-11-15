import { Card, Legend } from '../../components'
import { STYLE_IDS, primaryRegion, variableWords, type Visualization } from '../../data'
import { dateFormatterFor, formatDate } from '../../dates'
import { listedShortcuts } from '../../interaction/shortcuts'
import { presetFor } from '../../sonify'
import { PlaylistPanel } from '../playlist/PlaylistPanel'
import type { PageProps } from '../types'
import { HowItWorks } from './HowItWorks'
import { SoundRecipe } from './SoundRecipe'
import './about.css'

const percent = (fraction: number) => `${Math.round(fraction * 100)}%`
const rgbText = (rgb: [number, number, number]) => `rgb(${rgb.join(', ')})`

export default function AboutPage({ visualization }: PageProps) {
  if (!visualization) return <p>Loading the data…</p>
  return <About visualization={visualization} />
}

/** Everything on this page is read from the visualization's manifest, so it can never disagree with the data. */
function About({ visualization }: { visualization: Visualization }) {
  const { variable, source, frames, colorScale, mapping } = visualization
  const region = primaryRegion(visualization)
  const dates = frames.map(frame => frame.date).sort()
  const formatFrameDate = dateFormatterFor(dates)
  const missing = frames.filter(frame => frame.note)
  const unit = variable.unit
  const words = variableWords(variable)
  const lower = words.lower
  const shortcuts = listedShortcuts().filter(shortcut => shortcut.device === 'keyboard')

  return (
    <div className="about">
      <p>Where the imagery comes from, what the colours and sounds mean, and where the method falls short.</p>

      <Card title="What the data is" headingLevel={2}>
        <p><strong>{visualization.title}.</strong> {visualization.description}</p>
        <dl className="about__facts">
          <div><dt>What is measured</dt><dd>{variable.name}{unit && `, in ${unit}`}</dd></div>
          <div><dt>Dates</dt><dd>{frames.length} {frames.length === 1 ? 'date' : 'dates'}, from {formatFrameDate(dates[0])} to {formatFrameDate(dates[dates.length - 1])}</dd></div>
          <div><dt>Place we listen to</dt><dd>{region.name}. {region.description}</dd></div>
        </dl>
      </Card>

      <Card title="Source and credits" headingLevel={2}>
        <dl className="about__facts">
          <div><dt>Source</dt><dd>{source.url ? <a href={source.url}>{source.name}</a> : source.name}</dd></div>
          <div><dt>Credit</dt><dd>{source.credit}</dd></div>
          <div><dt>Licence</dt><dd>{source.license}</dd></div>
          <div><dt>Retrieved</dt><dd>{formatDate(source.retrievedOn)}</dd></div>
        </dl>
      </Card>

      <Card title="How colours become sound" headingLevel={2}>
        <ol className="about__steps">
          <li>Each image comes with a colour legend that links colours to {variable.name.toLowerCase()} values. We use the legend from the data: {colorScale.stops.length} colours, from {colorScale.stops[0].value} to {colorScale.stops[colorScale.stops.length - 1].value}{unit && ` ${unit}`}.</li>
          <li>We read the colour of {region.points.length} points in {region.name}, the same places on every date. Land, labels and missing data are skipped, and so is any colour that is not close to the legend (more than {colorScale.maxColorDistance} away in RGB).</li>
          <li>Each readable colour becomes a value, and we take the middle value (the median) of the points, so a few odd points do not decide the result.</li>
          <li>If fewer than {percent(mapping.minValidFraction)} of the points can be read, the date counts as missing data and plays a different sound. Otherwise the median falls in one of {mapping.categories.length} ranges, and each range has its own note.</li>
        </ol>

        <h3>The ranges and their notes</h3>
        <div className="about__table" role="region" aria-label="Ranges and notes" tabIndex={0}>
          <table>
            <caption>{lower.charAt(0).toUpperCase() + lower.slice(1)} is always a lower note. Notes are from {mapping.scale}.</caption>
            <thead><tr><th scope="col">Sound</th><th scope="col">Range{unit && ` (${unit})`}</th><th scope="col">Note</th></tr></thead>
            <tbody>
              {mapping.categories.map(category => (
                <tr key={category.id}>
                  <th scope="row">{category.label}</th>
                  <td>{category.range[0]} to {category.range[1]}</td>
                  <td>{category.note}</td>
                </tr>
              ))}
              <tr><th scope="row">Missing data</th><td>Not enough readable points</td><td>A hiss, not a note</td></tr>
            </tbody>
          </table>
        </div>

        <h3>Music styles</h3>
        <p>You can choose a music style when you start, or on Listen: {STYLE_IDS.map(id => presetFor(id).label).join(', ')}. Styles are a choice of taste. They change the instruments and the key, never what the data says.</p>

        <h3>The colour legend</h3>
        <Legend colorScale={colorScale} mapping={mapping} variable={variable} />
        <div className="about__table" role="region" aria-label="Colour legend" tabIndex={0}>
          <table>
            <caption>The colours we match against, in order.</caption>
            <thead><tr><th scope="col">Value{unit && ` (${unit})`}</th><th scope="col">Colour</th></tr></thead>
            <tbody>
              {colorScale.stops.map(stop => (
                <tr key={stop.value}>
                  <th scope="row">{stop.value}</th>
                  <td><span className="about__swatch" style={{ background: rgbText(stop.rgb) }} aria-hidden="true" />{rgbText(stop.rgb)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="The sound recipe" headingLevel={2}>
        <SoundRecipe preset={presetFor(visualization.sonification?.preset ?? 'major')} />
      </Card>

      <Card title="Keyboard shortcuts" headingLevel={2}>
        <p>These are the keys on Listen. The single-letter keys work only while the sound map has focus, so they never act anywhere else on the page.</p>
        {/* One card per key on a phone (about.css, LY02); the explicit roles keep it a table to screen readers then. */}
        <div className="about__table about__table--stack" role="region" aria-label="Keyboard shortcuts" tabIndex={0}>
          <table role="table">
            <caption>Every key, from the same list the Listen page reads.</caption>
            <thead><tr role="row"><th role="columnheader" scope="col">Key</th><th role="columnheader" scope="col">What it does</th><th role="columnheader" scope="col">Where</th></tr></thead>
            <tbody>
              {shortcuts.map(shortcut => (
                <tr key={shortcut.id} role="row">
                  <td role="cell"><kbd>{shortcut.keys}</kbd></td>
                  <td role="cell">{shortcut.does(words)}{shortcut.note && ` ${shortcut.note}`}</td>
                  <td role="cell" data-label="Where">{shortcut.scope === 'map' ? 'On the sound map' : 'Anywhere on Listen'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Using a screen reader" headingLevel={2}>
        <ul className="about__limits">
          <li>Everything you hear has words too. Changes are announced politely, and the music lowers while they are spoken.</li>
          <li>The sound map is an application region. Move to it, press Enter on &ldquo;Explore the map&rdquo;, and use the arrow keys. Escape leaves it.</li>
          <li>NVDA and JAWS: turn on forms or focus mode on the map, so the arrow keys reach it instead of moving the reading cursor.</li>
          <li>VoiceOver on a Mac: press VO + Shift + Down to interact with the map, and VO + Shift + Up to stop.</li>
          <li>VoiceOver on iPhone and TalkBack on Android: drag one finger across the map to hear each place, or swipe to move between controls.</li>
        </ul>
      </Card>

      <Card title="What to keep in mind" headingLevel={2}>
        <ul className="about__limits">
          <li>The values are approximate. They come from the colours of a published image, not from the measurements behind it, and a colour can only be matched to the legend so closely.</li>
          <li>Each date is one of {mapping.categories.length} sounds, so small changes inside a range cannot be heard.</li>
          <li>Missing data is left out, never counted as a low value.{missing.length > 0 && ` ${missing.length === 1 ? 'One date has' : `${missing.length} dates have`} missing data: ${missing.map(frame => formatFrameDate(frame.date)).join(', ')}.`}</li>
          <li>We listen to {region.name} only. Other places can behave differently.</li>
        </ul>
      </Card>

      <Card title="Who this is for" headingLevel={2}>
        <ul>
          <li>Blind and low-vision people, who can follow NASA Earth imagery by ear and through words.</li>
          <li>Students and learners, who can hear a change happen before they read about it.</li>
          <li>Visitors to the NASA Earth Information Center and other museums, where a screen can also be listened to.</li>
        </ul>
      </Card>

      <Card title="How a NASA image becomes sound" headingLevel={2}>
        <HowItWorks />
      </Card>

      <Card title="What comes next" headingLevel={2}>
        <ul>
          <li>Live data: some NASA visualizations, such as the El Niño sea temperature and PACE ocean colour, are updated every day, so the Jukebox could play today&apos;s ocean.</li>
          <li>The NASA visualizations on the Home page&apos;s &ldquo;Coming next&rdquo; shelf, sonified one by one. A new data set needs a manifest, not new code.</li>
          <li>A museum kiosk mode that plays on its own and answers by voice.</li>
          <li>More languages for the voice guide and the descriptions.</li>
        </ul>
      </Card>

      <Card title="How we used AI tools" headingLevel={2}>
        <p>AI coding assistants helped write parts of this app, and people on the team checked and tested their work. The voice guide uses Google&apos;s Gemini, so what you say to it is sent to Google while it is open; this app does not save it. The sounds are made by rules we wrote, not by AI.</p>
      </Card>
      <PlaylistPanel />
    </div>
  )
}
