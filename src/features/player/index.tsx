import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useAssistantContext } from '../../assistant/context'
import { AnnouncerProvider, Button, Legend, LoadingIndicator, Notice, Slider } from '../../components'
import type { ChangeVisualization } from '../../analysis'
import type { Visualization } from '../../data'
import { describeChange } from '../../describe'
import { Description } from '../../describe/Description'
import { useDescriptionDetail } from '../../describe/detail'
import { ExplorerPanel, ExplorerSurface, useExplorer } from '../explore/Explorer'
import { StoryPanel } from '../story/StoryPanel'
import type { PageProps } from '../types'
import './player.css'
import { usePlayer, type Speed } from './usePlayer'
import { useVibrationSetting, vibrateForDate } from './vibration'
import { Viewer } from './Viewer'

const SPEEDS: { id: Speed; label: string }[] = [
  { id: 'slow', label: 'Slow' },
  { id: 'normal', label: 'Normal' },
  { id: 'fast', label: 'Fast' },
]

/** Where Space and the arrow keys already mean something, so the shortcuts keep out. */
const isEditable = (target: EventTarget) => target instanceof HTMLElement && target.isContentEditable
const isField = (target: EventTarget) => target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
/** Where typing letters is the point: a text box, a text area, a menu. A radio button or slider is not, so T still works there. */
const isTyping = (target: EventTarget) =>
  target instanceof HTMLElement &&
  (['TEXTAREA', 'SELECT'].includes(target.tagName) || (target instanceof HTMLInputElement && !['radio', 'checkbox', 'range', 'button'].includes(target.type)))
/** Space presses these natively. A range input is not here: Space does nothing on it, so the shortcut may use it. */
const spaceActivates = (target: EventTarget) =>
  target instanceof HTMLElement &&
  (['BUTTON', 'A', 'SUMMARY', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    (target instanceof HTMLInputElement && target.type !== 'range'))

export default function PlayerPage({ visualization }: PageProps) {
  if (!visualization) return <p>Loading the data…</p>
  return (
    <AnnouncerProvider>
      <Player key={visualization.id} visualization={visualization} />
    </AnnouncerProvider>
  )
}

function Player({ visualization }: { visualization: Visualization }) {
  const vibration = useVibrationSetting()
  // A pulse each time the player lands on a date, while playing or when one date is chosen. Not on page load.
  const player = usePlayer(visualization, (_index, category) => {
    if (vibration.enabled) vibrateForDate(category, visualization.mapping)
  })
  const { frames, source } = visualization
  const frame = frames[player.index]
  const playing = player.status === 'playing'
  const [detail] = useDescriptionDetail()
  const explorer = useExplorer({ visualization, frame, engine: player.engine, vibrate: vibration.enabled })

  // Playing the dates takes the sound back from the explorer.
  const { on: exploring, turnOff: stopExploring } = explorer
  useEffect(() => { if (playing && exploring) stopExploring() }, [playing, exploring, stopExploring])

  // Story mode. While it is open the explorer is off and cannot be turned on, so the two never fight over the sound.
  const chapters = visualization.story ?? []
  const [storyOpen, setStoryOpen] = useState(false)
  const storyBox = useRef<HTMLDivElement>(null)
  const returnToStoryButton = useRef(false)
  useEffect(() => {
    if (!storyOpen && returnToStoryButton.current) {
      returnToStoryButton.current = false
      storyBox.current?.querySelector('button')?.focus()
    }
  }, [storyOpen])

  function openStory() {
    if (exploring) explorer.turnOff()
    setStoryOpen(true)
  }

  function closeStory() {
    player.halt()
    returnToStoryButton.current = true
    setStoryOpen(false)
  }

  function toggleExplorer() {
    if (exploring) {
      explorer.turnOff()
    } else {
      player.halt()
      explorer.turnOn()
    }
  }

  useAssistantContext(
    'player',
    {
      visualization: visualization.id,
      date: frame.date,
      region: player.region.id,
      category: player.categoryAt(player.index) ?? 'unknown',
      playing,
      // Only in the change style, so the context of every other style is exactly as it was.
      ...(player.style === 'change' && player.results?.[player.index]?.changeStep && { changeStep: player.results[player.index].changeStep }),
    },
    player.finished ? `playback_finished:${visualization.id}` : undefined,
  )

  // Shortcuts work while focus is anywhere in the player, but never take over a text box, a button or a field's own keys.
  function onKeyDown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || isEditable(event.target)) return
    if (event.key === ' ' && !spaceActivates(event.target)) {
      event.preventDefault()
      if (playing) player.pause()
      else player.play()
    } else if (event.key.toLowerCase() === 't' && player.style === 'change' && !isTyping(event.target)) {
      // "Trace the warm edge", from anywhere in the player, the sound map included (it does not use this key).
      event.preventDefault()
      void player.traceWarmEdge()
    } else if (event.key === 'Escape' && player.tracing) {
      player.stopTrace()
    } else if (event.key === 'ArrowRight' && !isField(event.target)) {
      event.preventDefault()
      player.goTo(player.index + 1)
    } else if (event.key === 'ArrowLeft' && !isField(event.target)) {
      event.preventDefault()
      player.goTo(player.index - 1)
    }
  }

  return (
    <section className="player" aria-label="Player" onKeyDown={onKeyDown}>
      <Viewer frame={frame} dateText={player.formatDate(frame.date)} region={player.region} source={source}>
        <ExplorerSurface explorer={explorer} />
      </Viewer>
      <ExplorerPanel visualization={visualization} explorer={explorer} />

      {player.results && <Description visualization={visualization} results={player.results} index={player.index} />}
      {player.style === 'change' && player.score && (
        <p className="player__change">{describeChange(visualization as ChangeVisualization, player.score, { detail })}</p>
      )}

      <details className="player__legend">
        <summary>Colour legend</summary>
        <Legend colorScale={visualization.colorScale} mapping={visualization.mapping} variable={visualization.variable} />
      </details>

      {player.error && <Notice variant="error">The sounds could not be prepared. {player.error}</Notice>}
      {player.loading && <LoadingIndicator label="Analyzing the images…" />}
      {player.downloadError && <Notice variant="error">The audio could not be prepared. {player.downloadError}</Notice>}
      {player.finished && <Notice>That is the last date. Press Play to hear it again.</Notice>}

      {chapters.length > 0 && (
        <div className="player__story" ref={storyBox}>
          <Button aria-expanded={storyOpen} disabled={!player.ready || storyOpen} onClick={openStory}>Hear the story</Button>
        </div>
      )}
      {storyOpen && (
        <StoryPanel visualization={visualization} chapters={chapters} results={player.results} playRange={player.playRange} onClose={closeStory} />
      )}

      <div className="player__controls" role="group" aria-label="Playback">
        <Button variant="primary" disabled={!player.ready} onClick={playing ? player.pause : player.play}>
          {playing ? 'Pause' : player.status === 'paused' ? 'Resume' : 'Play'}
        </Button>
        <Button disabled={!player.ready} onClick={player.stop}>Stop</Button>
        <Button disabled={!player.ready} onClick={player.replay}>Replay this date</Button>
        <Button disabled={!player.ready || storyOpen} pressed={exploring} onClick={toggleExplorer}>Explore the map</Button>
      </div>

      <div className="player__slider">
        <Slider
          label="Date"
          min={0}
          max={frames.length - 1}
          value={player.index}
          disabled={!player.ready}
          onChange={player.goTo}
          describe={i => player.ready ? player.describeDate(i) : player.formatDate(frames[i].date)}
        />
      </div>

      <div className="player__settings">
        <div role="group" aria-label="Speed" className="player__speed">
          <span className="player__speed-label" aria-hidden="true">Speed</span>
          {SPEEDS.map(({ id, label }) => (
            <Button key={id} pressed={player.speed === id} onClick={() => player.setSpeed(id)}>{label}</Button>
          ))}
        </div>
        <Slider
          label="Volume"
          min={0}
          max={100}
          value={Math.round(player.volume * 100)}
          onChange={value => player.setVolume(value / 100)}
          describe={value => `${value} percent`}
        />
      </div>

      <div className="player__sound">
        {player.changeAvailable ? (
          <div className="player__style" role="radiogroup" aria-labelledby="player-sound-label">
            <span id="player-sound-label" className="player__style-label">Sound</span>
            {([['full', 'Full'], ['simple', 'Simple'], ['change', 'Change from normal']] as const).map(([id, label]) => (
              <label key={id} className="player__style-option">
                <input type="radio" name="player-sound" value={id} checked={player.style === id} onChange={() => player.setStyle(id)} />
                <span>{label}</span>
              </label>
            ))}
            <span>
              {player.style === 'change'
                ? 'Hear how far each date is from its normal, not the temperature itself.'
                : player.style === 'simple' ? 'Just the main note, without the chord and slides.' : 'The main note with a chord, slides and a bell.'}
            </span>
          </div>
        ) : (
          <>
            <Button pressed={player.style === 'simple'} onClick={() => player.setStyle(player.style === 'simple' ? 'full' : 'simple')}>
              Simple sound
            </Button>
            <span>Just the main note, without the chord and slides.</span>
          </>
        )}
        {player.style === 'change' && (
          <>
            <Button disabled={!player.ready || !player.score?.contours.length} onClick={() => void player.traceWarmEdge()}>
              Trace the warm edge
            </Button>
            <span>Plays each line of change on this date as a sound that moves across the map. Press T, or Escape to stop.</span>
          </>
        )}
        <Button pressed={player.spatial === '3d'} onClick={() => player.setSpatial(player.spatial === '3d' ? 'stereo' : '3d')}>
          3D sound (headphones)
        </Button>
        <span>Places the sound in space: west to east, and north above, south below. Use headphones; on speakers it is not reliable.</span>
        <Button disabled={!player.ready || player.downloading} onClick={() => void player.download()}>
          {player.downloading ? 'Preparing the audio…' : 'Download this soundscape (WAV)'}
        </Button>
      </div>

      {vibration.supported && (
        <div className="player__vibration">
          <Button pressed={vibration.enabled} onClick={() => vibration.setEnabled(!vibration.enabled)}>Vibration</Button>
          <span>A short buzz at each date, longer for warmer water.</span>
        </div>
      )}

      <p className="player__hint">
        Keyboard: Space plays or pauses, and the left and right arrow keys move between dates.
      </p>
    </section>
  )
}
