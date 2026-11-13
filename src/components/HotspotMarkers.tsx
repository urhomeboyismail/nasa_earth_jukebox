import type { HotspotMarker } from '../describe/markers'
import './hotspotMarkers.css'

/**
 * The hot spots of the frame on the picture (docs/PLAN.md §6.3, ticket SN10): a still ring and its id for sighted listeners, and the same spots as a
 * list of sentences for screen readers. Put it inside the picture's frame, which must be positioned. The rings never move on their own.
 */
export function HotspotMarkers({ markers }: { markers: readonly HotspotMarker[] }) {
  if (markers.length === 0) return null
  return (
    <div className="hotspot-markers">
      <div className="hotspot-markers__rings" aria-hidden="true">
        {markers.map(marker => (
          <span
            key={marker.id}
            className={`hotspot-markers__ring hotspot-markers__ring--${marker.band}`}
            style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }}
          >
            <span className="hotspot-markers__id">{marker.id}</span>
          </span>
        ))}
      </div>
      <ul className="sr-only" aria-label="Hot spots on this date">
        {markers.map(marker => <li key={marker.id}>{marker.label}</li>)}
      </ul>
    </div>
  )
}
