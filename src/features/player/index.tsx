import { useEffect, useMemo, useRef, useState } from 'react'
import { useAssistantContext } from '../../assistant/context'
import { Button, Legend, LoadingIndicator, Notice, Slider, useAnnounce } from '../../components'
import { higherPhrase, variableWords, type Visualization } from '../../data'
import { describeChange } from '../../describe'
import { Description } from '../../describe/Description'
import { useDescriptionDetail } from '../../describe/detail'
import { stopSpeech } from '../../interaction/speech'
import { useActionHandler } from '../../interaction/registry'
import { useGamepad, useKeyboard } from '../../interaction/useInput'
import { AskPanel } from '../ask/AskPanel'
import { ExplorerPanel, ExplorerSurface } from '../explore/Explorer'
import { useExplorer } from '../explore/useExplorer'
import { useFollow } from '../follow/useFollow'
import { FindPanel } from '../find/FindPanel'
import { useFindGame } from '../find/useFindGame'
import { OnboardingPanel } from '../onboarding/OnboardingPanel'
import { useOnboarding } from '../onboarding/useOnboarding'
import { PredictPanel } from '../predict/PredictPanel'
import { usePredict } from '../predict/usePredict'
import { StoryPanel } from '../story/StoryPanel'
import type { PageProps } from '../types'
import './player.css'
import { usePlayer, type Speed } from './usePlayer'
import { useVibrationSetting, vibrateForDate } from './vibration'
import { DataTable } from './DataTable'
import { momentHash, readMoment, useMomentLink } from './momentLink'
import { ShortcutsDialog } from './ShortcutsDialog'
import { Viewer } from './Viewer'
import { useListenMode, type ListenMode } from './listenMode'
import { Scan } from './Scan'
import { Symphony } from './Symphony'

const SPEEDS: { id: Speed; label: string }[] = [
  { id: 'slow', label: 'Slow' },
  { id: 'normal', label: 'Normal' },
  { id: 'fast', label: 'Fast' },
]

/** Anywhere on Listen: the 'listen' and 'anywhere' scopes of the shortcut list (src/interaction/shortcuts.ts). */
const LISTEN_SCOPES = ['listen', 'anywhere'] as const

export default function PlayerPage({ visualization }: PageProps) {
  if (!visualization) return <p>Loading the data…</p>
  return (
    <ListenPage key={visualization.id} visualization={visualization} />
  )
}

const MODES: { id: ListenMode; label: string; says: string }[] = [
  { id: 'symphony', label: 'Symphony mode', says: 'Symphony mode. Press Play to start.' },
  { id: 'simple', label: 'Simple mode', says: 'Simple mode. Press Play to start.' },
  { id: 'scan', label: 'Scan', says: 'Scan. Press Scan from the west edge to start.' },
]

/** Symphony reads each frame as it is shown and plays the ensemble; Simple is the player that plays one note a date. Only the one chosen is on the page. */
function ListenPage({ visualization }: { visualization: Visualization }) {
  const [mode, setMode] = useListenMode(visualization)
  const announce = useAnnounce()
  return (
    <>
      <fieldset className="symphony__mode">
        <legend>Listen as</legend>
        {MODES.map(({ id, label, says }) => (
          <label key={id} className="player__style-option">
            <input type="radio" name="listen-mode" value={id} checked={mode === id} onChange={() => { setMode(id); announce(says) }} />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      {mode === 'symphony' ? <Symphony visualization={visualization} /> : mode === 'scan' ? <Scan visualization={visualization} /> : <Player visualization={visualization} />}
    </>
  )
}

function Player({ visualization }: { visualization: Visualization }) {
  const vibration = useVibrationSetting()
  const announce = useAnnounce()
  const { frames, source } = visualization
  // F40: the moment the address asks for, read once while the page first renders. Anything it gets wrong is already left out.
  const dates = useMemo(() => frames.map(frame => frame.date), [frames])
  const [linked] = useState(() => readMoment(window.location.hash, dates))
  // A pulse each time the player lands on a date, while playing or when one date is chosen. Not on page load.
  const player = usePlayer(visualization, (_index, category) => {
    if (vibration.enabled) vibrateForDate(category, visualization.mapping)
  }, linked)
  const words = variableWords(visualization.variable)
  const frame = frames[player.index]
  const playing = player.status === 'playing'
  const [detail] = useDescriptionDetail()
  // The data table is built only while it is open: a closed <details> still keeps its content in the page.
  const [tableOpen, setTableOpen] = useState(false)
  const explorer = useExplorer({ visualization, frame, engine: player.engine, vibrate: vibration.enabled, frames, formatDate: player.formatDate, onDate: player.showDate, start: linked.cell })
  // IX03: H follows a hot spot through the dates on the sound map. It stops when the map goes off (Play, the story, the toggle).
  const follow = useFollow({ visualization, explorer, frames, index: player.index, showDate: player.showDate })
  // IX04: F (or the button) starts the find game on the sound map's date.
  const find = useFindGame({ visualization, frame, explorer })
  // IX05: a question about the next two dates, answered before they play. The story's chapters use the same hook.
  const predict = usePredict({ visualization, index: player.index, ensemble: explorer.ensemble, halt: player.halt, showDate: player.showDate })
  // IX11: the first-minute game listens to the same actions, and to the find game's first target found.
  const onboarding = useOnboarding({ visualization, explorer, findStatus: find.game.status })
  /** A date chosen by the listener: a followed spot is heard there and the dates play on from it; otherwise the date plays as usual. */
  const chooseDate = (i: number) => {
    if (follow.isFollowing()) { player.showDate(i); follow.showFollowedDate(i) } else player.goTo(i)
  }

  // F40: the address follows the date, the cell (once the map has been read) and the style, and a link opened on this page is applied.
  const { halt, showDate, applyLinkedStyle } = player
  const { openAt } = explorer
  const moment = { date: frame.date, cell: explorer.on && explorer.grid ? explorer.cursor : null, style: player.style }
  useMomentLink(moment, dates, link => {
    if (link.index !== null) { halt(); showDate(link.index) }
    if (link.style) applyLinkedStyle(link.style)
    if (link.cell) openAt(link.cell)
  })
  const [copied, setCopied] = useState('')
  /** Shown only when the clipboard is not available, so the listener can copy it by hand. */
  const [manualLink, setManualLink] = useState('')
  async function copyLink() {
    // Built from what is on screen, so it is whole even if the address has not been rewritten yet.
    const link = `${window.location.href.split('#')[0]}${momentHash(window.location.hash, moment)}`
    try {
      await navigator.clipboard.writeText(link)
      setManualLink('')
      announce('Link copied')
      setCopied('Link copied.')
      window.setTimeout(() => setCopied(''), 5000)
    } catch {
      setManualLink(link)
      announce('The link could not be copied. It is shown below the button, so you can copy it yourself.')
    }
  }

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

  // IX01: every key, button and gesture is an action (src/interaction/). The player answers the ones about the dates, the trace, the help and speech.
  // Which key means what is the list in src/interaction/shortcuts.ts, which the "Keyboard shortcuts" dialog is drawn from too.
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const onKeyDown = useKeyboard(LISTEN_SCOPES)
  useGamepad()
  useActionHandler('transport', () => {
    if (playing) player.pause()
    else player.play()
  })
  useActionHandler('scrubTime', action => {
    const target = 'by' in action ? player.index + action.by : action.to === 'first' ? 0 : frames.length - 1
    chooseDate(Math.min(frames.length - 1, Math.max(0, target)))
  })
  useActionHandler('trace', () => {
    // "Trace the warm edge", from the sound map, in the change style.
    if (player.style === 'change') void player.traceWarmEdge()
  })
  useActionHandler('openShortcuts', () => setShortcutsOpen(true))
  // Escape stops what this app is saying, and the trace if it is playing. The sound map stops its own sound in its own handler.
  useActionHandler('stopSpeech', () => {
    stopSpeech()
    if (player.tracing) player.stopTrace()
  })

  return (
    <>
    <section className="player" aria-label="Player" onKeyDown={onKeyDown}>
      <Viewer frame={frame} dateText={player.formatDate(frame.date)} region={player.region} source={source}>
        <ExplorerSurface explorer={explorer} />
      </Viewer>
      <ExplorerPanel visualization={visualization} explorer={explorer} />
      {/* IX03: what follow is doing. Not a live region: losing the spot is said through the speech gate. */}
      {follow.text && <p className="player__follow">{follow.text}</p>}
      <FindPanel find={find} />
      <PredictPanel predict={predict} index={player.index} />
      <OnboardingPanel onboarding={onboarding} />

      {player.results && <Description visualization={visualization} results={player.results} index={player.index} />}
      {player.style === 'change' && player.score && (
        <p className="player__change">{describeChange(visualization, player.score, { detail })}</p>
      )}

      {player.results && (
        <details className="player__legend" onToggle={event => setTableOpen(event.currentTarget.open)}>
          <summary>Show data table</summary>
          {tableOpen && <DataTable visualization={visualization} results={player.results} formatDate={player.formatDate} />}
        </details>
      )}

      {player.results && <AskPanel visualization={visualization} results={player.results} />}

      <details className="player__legend">
        <summary>Colour legend</summary>
        <Legend colorScale={visualization.colorScale} mapping={visualization.mapping} variable={visualization.variable} />
        <div className="player__legend-play">
          <Button disabled={!player.ready} onClick={() => void player.hearLegend()}>
            Hear the legend, {words.lowest} to {words.highest}
          </Button>
        </div>
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
        <StoryPanel visualization={visualization} chapters={chapters} results={player.results} playRange={player.playRange} predict={predict} onClose={closeStory} />
      )}

      <div className="player__controls" role="group" aria-label="Playback">
        <Button variant="primary" disabled={!player.ready} onClick={playing ? player.pause : player.play}>
          {playing ? 'Pause' : player.status === 'paused' ? 'Resume' : 'Play'}
        </Button>
        <Button disabled={!player.ready} onClick={player.stop}>Stop</Button>
        <Button disabled={!player.ready} onClick={player.replay}>Replay this date</Button>
        <Button disabled={!player.ready} onClick={() => void player.hearBothWays()}>Hear this date both ways</Button>
        <Button disabled={!player.ready} onClick={() => void player.hearWhatIsHidden()}>What the sound hides</Button>
        <Button disabled={!player.ready} onClick={() => void player.testSound()}>Test sound</Button>
        <Button disabled={!player.ready || storyOpen} pressed={exploring} onClick={toggleExplorer}>Explore the map</Button>
      </div>

      <div className="player__slider">
        <Slider
          label="Date"
          min={0}
          max={frames.length - 1}
          value={player.index}
          disabled={!player.ready}
          onChange={i => {
            // The slider is not an action, so the first-minute game is told of the date change here.
            onboarding.record({ type: 'scrubTime', by: i - player.index })
            // A locked place is heard on the new date, not the whole map.
            if (explorer.locked) {
              player.showDate(i)
              void explorer.playLockedAt(i)
            } else chooseDate(i)
          }}
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
                ? 'Hear how far each date is from its normal, not the value itself.'
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
              Trace the {words.edge}
            </Button>
            <span>Plays each line of change on this date as a sound that moves across the map. Press T, or Escape to stop.</span>
            {player.scoreProblem && <Notice variant="error">The change for this date could not be read, so there is nothing to trace. {player.scoreProblem}</Notice>}
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
          <span>A short buzz at each date, longer for {higherPhrase(variableWords(visualization.variable))}.</span>
        </div>
      )}

      <div className="player__share">
        <Button disabled={!player.ready} onClick={() => void copyLink()}>Copy link to this moment</Button>
        <span>A link that opens this data set, date, place on the map and sound. {copied}</span>
        {manualLink && (
          <label className="player__share-manual">
            <span>Copy this link</span>
            <input type="text" readOnly value={manualLink} onFocus={event => event.currentTarget.select()} />
          </label>
        )}
      </div>

      <div className="player__keys">
        <p className="player__hint">
          Keyboard: Space plays or pauses, and the left and right arrow keys move between dates.
        </p>
        <Button onClick={() => setShortcutsOpen(true)}>Keyboard shortcuts</Button>
      </div>
    </section>
    <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} visualization={visualization} />
    </>
  )
}
