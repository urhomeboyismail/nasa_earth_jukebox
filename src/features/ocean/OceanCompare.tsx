// EIC06 T4: /compare?ocean=1. Two dates of one ocean track side by side: both videos, held at each date, their numbers, and a
// button to hear each. Loaded only when opened.

import { useId, useRef, useState } from 'react'
import { Button, LoadingIndicator, Notice, useAnnounce } from '../../components'
import { currentDataParam, hashFor } from '../../route'
import { CanvasGridVisualizer, ThermalScale } from './CanvasGridVisualizer'
import { Credit } from './Credit'
import { assetUrl, type OceanTrack } from './schema'
import { TrackPicker } from './TrackPicker'
import { useOceanSound } from './useOceanSound'
import { useOceanTracks } from './useOceanTracks'
import { capitalise, wordsFor } from './words'
import './ocean.css'

const HEAR_S = 2.5

export default function OceanCompare() {
  const { entries, entry, track, error, choose } = useOceanTracks()
  return (
    <div className="ocean">
      <p><a href={hashFor('compare', { data: currentDataParam() })}>Back to the map data sets</a></p>
      {entries && entry && <TrackPicker entries={entries} value={entry.dataset_id} onChange={choose} />}
      {error ? <Notice variant="error">{error}</Notice> : track ? <TwoDates key={track.dataset_id} track={track} /> : <LoadingIndicator label="Loading the ocean track…" />}
      <Credit track={track} />
    </div>
  )
}

function TwoDates({ track }: { track: OceanTrack }) {
  const { timeline } = track
  const announce = useAnnounce()
  const { ensure, failed } = useOceanSound(track)
  // The first date, and the one half a year on (or the last).
  const [picked, setPicked] = useState<[number, number]>([0, Math.min(timeline.length - 1, Math.floor(timeline.length / 2))])

  async function hear(index: number) {
    const made = await ensure()
    if (!made) return
    made.preview(index, HEAR_S)
    announce(timeline[index].accessibility_text)
  }

  return (
    <>
      <div className="ocean-compare">
        {picked.map((index, side) => (
          <Side
            key={side}
            label={side === 0 ? 'First date' : 'Second date'}
            track={track}
            index={index}
            onPick={next => setPicked(side === 0 ? [next, picked[1]] : [picked[0], next])}
            onHear={() => void hear(index)}
          />
        ))}
      </div>
      {failed && <Notice variant="error">The sound could not start. Try again.</Notice>}
    </>
  )
}

function Side({ label, track, index, onPick, onHear }: { label: string; track: OceanTrack; index: number; onPick: (index: number) => void; onHear: () => void }) {
  const id = useId()
  const video = useRef<HTMLVideoElement>(null)
  const step = track.timeline[index]
  const metrics = step.metrics
  const words = wordsFor(track.metadata.category)
  const seek = (i: number) => { if (video.current) video.current.currentTime = track.timeline[i].time_sec }
  return (
    <section className="ocean-compare__side" aria-labelledby={`${id}-label`}>
      <label id={`${id}-label`} htmlFor={id} className="ocean-picker__label">{label}</label>
      <select id={id} className="ui-select" value={step.iso_date} onChange={event => {
        const next = track.timeline.findIndex(s => s.iso_date === event.target.value)
        if (next < 0) return
        seek(next)
        onPick(next)
      }}>
        {track.timeline.map(s => <option key={s.iso_date} value={s.iso_date}>{s.display_date}</option>)}
      </select>
      {track.visual_assets.video_url ? (
        <video
          ref={video}
          className="ocean-stage__video"
          style={{ aspectRatio: track.visual_assets.aspect_ratio.replace(':', ' / ') }}
          src={assetUrl(track.visual_assets.video_url)}
          poster={track.visual_assets.poster_url ? assetUrl(track.visual_assets.poster_url) : undefined}
          muted
          playsInline
          preload="metadata"
          aria-label={`${track.metadata.title} on ${step.display_date}. The numbers below describe it.`}
          onLoadedMetadata={() => seek(index)}
        />
      ) : (
        <>
          <div className="ocean-stage__screen" style={{ aspectRatio: track.visual_assets.aspect_ratio.replace(':', ' / ') }}>
            <CanvasGridVisualizer
              grid={step.spatial_grid}
              calibration={track.calibration}
              playing={false}
              label={`${track.metadata.title} on ${step.display_date}, a map of temperature. The numbers below describe it.`}
            />
          </div>
          <ThermalScale />
        </>
      )}
      {metrics ? (
        <dl className="ocean-compare__metrics">
          <dt>Mean</dt><dd>{metrics.sst_celsius_mean.toFixed(1)} °C</dd>
          <dt>Range</dt><dd>{metrics.sst_celsius_min.toFixed(1)} to {metrics.sst_celsius_max.toFixed(1)} °C</dd>
          <dt>{capitalise(words.speed)}</dt><dd>{Math.round(metrics.current_velocity_norm * 100)} percent</dd>
          <dt>{capitalise(words.swirl)}</dt><dd>{Math.round(metrics.eddy_vorticity_norm * 100)} percent</dd>
          <dt>Against {words.against}</dt><dd>{metrics.thermal_anomaly >= 0 ? '+' : ''}{metrics.thermal_anomaly.toFixed(2)}</dd>
        </dl>
      ) : <p>No ocean reading on this date.</p>}
      <p>{step.accessibility_text}</p>
      <Button onClick={onHear}>Hear {step.display_date}</Button>
    </section>
  )
}
