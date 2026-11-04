import type { Frame, Region, Visualization } from '../../data'

type Props = {
  frame: Frame
  /** The frame's date, already written out for this dataset (see src/dates.ts). */
  dateText: string
  region: Region
  source: Visualization['source']
}

/** The frame image with its region outline, the date written out, the frame's note and the source credit. */
export function Viewer({ frame, dateText, region, source }: Props) {
  const { width, height } = frame
  const xs = region.points.map(p => p.x * width)
  const ys = region.points.map(p => p.y * height)
  const box = region.points.length
    ? { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
    : null
  const pad = Math.max(width, height) * 0.02

  return (
    <figure className="player__figure">
      <div className="player__frame" style={{ aspectRatio: `${width} / ${height}` }}>
        <img src={frame.image} alt={frame.altText} width={width} height={height} />
        {/* The outline only helps sighted users find the region; the alt text already describes it. */}
        <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
          {box && <rect x={box.x - pad} y={box.y - pad} width={box.w + pad * 2} height={box.h + pad * 2} rx={pad} />}
          {region.points.map((p, i) => <circle key={i} cx={p.x * width} cy={p.y * height} r={pad / 3} />)}
        </svg>
      </div>
      <figcaption>
        <strong className="player__date">{dateText}</strong>
        <span className="player__region">Region: {region.name}</span>
        {frame.note && <span className="player__note">{frame.note}</span>}
        <span className="player__credit">
          Source: {source.url ? <a href={source.url}>{source.name}</a> : source.name}. {source.credit}.
        </span>
      </figcaption>
    </figure>
  )
}
