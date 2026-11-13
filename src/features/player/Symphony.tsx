import { useMemo, useState, type KeyboardEvent } from 'react'
import { Button } from '../../components'
import { useKeyboard } from '../../interaction/useInput'
import { HotspotMarkers } from '../../components/HotspotMarkers'
import { hotspotMarkers } from '../../describe/markers'
import { dateFormatterFor } from '../../dates'
import type { Frame, Visualization } from '../../data'
import { DetailControl } from './DetailControl'
import { LayerCaptions } from './LayerCaptions'
import { shortcutFor } from './shortcuts'
import { statusText, useSymphony, type ButtonKind } from './symphonyState'
import { Viewer } from './Viewer'
import { useEventAnnouncer } from './useEventAnnouncer'
import { MyMixControls } from './MyMixControls'
import { useMixerKeys } from './useMixerKeys'
import { VoiceMixer } from './VoiceMixer'
import './symphony.css'

const SPEEDS = [
  { id: 'slow', label: 'Slow' },
  { id: 'normal', label: 'Normal' },
  { id: 'fast', label: 'Fast' },
] as const

/** The keys of the mixer (1 to 7, Shift + 1 to 7) and the undo of a change to it: the sound map's and Listen's parts of the shortcut list. */
const MIXER_SCOPES = ['map', 'listen'] as const

const BUTTON_LABELS: Record<ButtonKind, string> = { play: 'Play', pause: 'Pause', resume: 'Resume', sound: 'Turn sound on' }

/** Space presses these natively, so the shortcut keeps out of their way. */
const spaceActivates = (target: EventTarget) =>
  target instanceof HTMLElement && (['BUTTON', 'A', 'SUMMARY', 'TEXTAREA', 'SELECT', 'INPUT'].includes(target.tagName) || target.isContentEditable)

/** The checked frame at or just before a date: what a date between the checked frames looks like. */
function frameAt(frames: Frame[], date: string): Frame {
  let found = frames[0]
  for (const frame of frames) if (frame.date <= date) found = frame
  return found
}

export function Symphony({ visualization }: { visualization: Visualization }) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)
  const symphony = useSymphony(visualization, video)
  const features = symphony.latest?.features ?? null
  useEventAnnouncer(features, visualization)
  const markers = useMemo(() => (features ? hotspotMarkers(features, visualization) : []), [features, visualization])
  const { frames, regions, source } = visualization
  const format = dateFormatterFor(frames.map(frame => frame.date))
  const date = symphony.latest?.date ?? frames[0].date
  const frame = frameAt(frames, date)
  const showVideo = symphony.sourceStatus === 'video'
  const idle = symphony.ensembleStatus === 'off'
  // IX06: the same mixer from the keyboard, with undo.
  useMixerKeys({ visualization, ...symphony })
  const onMixerKey = useKeyboard(MIXER_SCOPES)

  function onKeyDown(event: KeyboardEvent) {
    onMixerKey(event)
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
    if (event.key === 'Escape') {
      if (!idle) symphony.stop()
    } else if (shortcutFor(event.key, 'player') === 'play' && !spaceActivates(event.target)) {
      event.preventDefault()
      symphony.toggle()
    }
  }

  return (
    <section className="player symphony" aria-label="Symphony" onKeyDown={onKeyDown}>
      <Viewer frame={frame} dateText={format(date)} region={regions[0]} source={source}>
        {/* Always present, because the live source needs an element to be made. Without a video it has no source, stays hidden, and the source steps the checked frames instead. */}
        <video
          ref={setVideo}
          className={showVideo ? 'symphony__video' : 'symphony__video symphony__video--hidden'}
          src={visualization.video ? `${import.meta.env.BASE_URL}data/${visualization.id}/${visualization.video.src}` : undefined}
          muted
          playsInline
          preload={visualization.video ? 'auto' : 'none'}
          aria-hidden={showVideo ? undefined : true}
          aria-label={showVideo ? frame.altText : undefined}
        />
        <HotspotMarkers markers={markers} />
      </Viewer>

      <p className="symphony__status">{statusText(symphony)}</p>
      <p className="symphony__now">
        <strong>Now:</strong> {symphony.latest ? symphony.latest.music.summary : 'Nothing is playing yet.'}
      </p>
      {symphony.latest && <LayerCaptions music={symphony.latest.music} voices={symphony.voices} muted={symphony.muted} solo={symphony.solo} />}

      <div className="player__controls" role="group" aria-label="Playback">
        <Button variant="primary" onClick={symphony.toggle}>{BUTTON_LABELS[symphony.button]}</Button>
        <Button disabled={idle} onClick={symphony.stop}>Stop</Button>
      </div>

      <DetailControl detail={symphony.detail} onChange={symphony.setDetail} />
      <VoiceMixer voices={symphony.voices} muted={symphony.muted} solo={symphony.solo} onMute={symphony.toggleMute} onSolo={symphony.toggleSolo} />
      <MyMixControls voices={symphony.voices} muted={symphony.muted} solo={symphony.solo} setMix={symphony.setMix} />

      <div role="group" aria-label="Speed" className="player__speed">
        <span className="player__speed-label" aria-hidden="true">Speed</span>
        {SPEEDS.map(({ id, label }) => (
          <Button key={id} pressed={symphony.speed === id} onClick={() => symphony.setSpeed(id)}>{label}</Button>
        ))}
      </div>

      <p className="player__hint">Keyboard: Space plays or pauses, and Escape stops. Keys 1 to 7 solo a voice, Shift and 1 to 7 mute it, and Control Z puts the last change back.</p>
    </section>
  )
}
