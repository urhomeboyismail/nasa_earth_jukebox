import { useEffect, useRef, useState } from 'react'
import { Button, useAnnounce } from '../../components'
import type { Visualization } from '../../data'
import type { FrameGrid } from '../../analysis'
import type { SoundStyle } from '../../audio/style'
import { describePlace } from '../../describe'
import { recordUndo } from '../../interaction/history'
import type { Cell } from '../../route'
import { momentHash } from '../player/momentLink'
import { removeStoredMark, restoreStoredMark } from './store'
import { useMarks } from './useMarks'
import { closeAt, downloadName, logCursor, logDate, RECORD_LIMIT_S, recordingStatus, startLog, durationWords, type RecordLog } from './record'
import { renderRecording } from './renderRecording'

type Props = {
  visualization: Visualization
  /** The date being shown (an index into the data set's frames) and the cell the sound map is on (null while the map is off). */
  index: number
  cursor: Cell | null
  /** The sound map, for saying where a mark is. Null while it is being read. */
  grid: FrameGrid | null
  formatDate: (date: string) => string
  style: SoundStyle
  /** Builds the WAV for a log. Default: SN12's offline render. */
  render?: (visualization: Visualization, log: RecordLog) => Promise<Blob>
}

type Recording =
  | { state: 'idle' }
  | { state: 'recording'; seconds: number }
  | { state: 'rendering' }
  | { state: 'done'; url: string; name: string; stoppedByLimit: boolean }
  | { state: 'error'; message: string }

/**
 * IX08: the marks made with M, as text with a way to copy a link to each and to remove it, and a recording of what the listener heard as a WAV.
 * The sound of a mark is the explorer's (one bright note); here is only the list. Nothing sounds from this panel.
 */
export function MarksPanel({ visualization, index, cursor, grid, formatDate, style, render = renderRecording }: Props) {
  const announce = useAnnounce()
  const all = useMarks()
  // Marks of other data sets stay in the list on disk; this page shows the ones for this data set, keeping each one's place in the whole list for removing.
  const here = all.flatMap((mark, at) => (mark.dataId === visualization.id ? [{ mark, at }] : []))

  const where = (col: number, row: number) => (grid ? describePlace(grid, col, row) : `column ${col + 1}, row ${row + 1}`)

  const heading = useRef<HTMLHeadingElement>(null)
  const remove = (at: number) => {
    const mark = removeStoredMark(at)
    if (!mark) return
    recordUndo('unmark', () => restoreStoredMark(at, mark))
    announce('Mark removed.')
    // The button that was pressed is gone: focus goes to the heading, so the keyboard stays inside the player.
    heading.current?.focus()
  }

  // Sharing a mark: the same link S01 builds for a moment, with the mark's date and cell.
  const [copied, setCopied] = useState('')
  const [manualLink, setManualLink] = useState('')
  async function copyLink(date: string, col: number, row: number) {
    const link = `${window.location.href.split('#')[0]}${momentHash(window.location.hash, { date, cell: { col, row }, style })}`
    try {
      await navigator.clipboard.writeText(link)
      setManualLink('')
      setCopied('Link copied.')
      announce('Link copied')
    } catch {
      setCopied('')
      setManualLink(link)
      announce('The link could not be copied. It is shown below the list, so you can copy it yourself.')
    }
  }

  // Recording. The log is kept in refs (it changes with every move and must not cause a render each time); the status is state.
  const [recording, setRecording] = useState<Recording>({ state: 'idle' })
  const log = useRef<RecordLog>(startLog(0))
  const startedAt = useRef(0)
  const timer = useRef<number | undefined>(undefined)
  const lastIndex = useRef(index)
  const lastCell = useRef<string | null>(null)
  const active = recording.state === 'recording'

  const cellKey = cursor ? `${cursor.col},${cursor.row}` : null
  useEffect(() => {
    if (!active) return
    const at = Date.now() - startedAt.current
    if (index !== lastIndex.current) {
      lastIndex.current = index
      log.current = logDate(log.current, index, at)
    }
    if (cursor && cellKey !== lastCell.current) {
      lastCell.current = cellKey
      log.current = logCursor(log.current, cursor.col, cursor.row, at)
    }
  }, [active, index, cursor, cellKey])

  const download = recording.state === 'done' ? recording : null
  const downloadUrl = download?.url
  useEffect(() => {
    if (!downloadUrl) return
    return () => URL.revokeObjectURL(downloadUrl)
  }, [downloadUrl])

  const finish = (byLimit: boolean) => {
    window.clearInterval(timer.current)
    const closed = log.current
    setRecording({ state: 'rendering' })
    announce('Recording stopped. Making the file.')
    render(visualization, closed).then(
      blob => setRecording({ state: 'done', url: URL.createObjectURL(blob), name: downloadName(visualization.id, new Date()), stoppedByLimit: byLimit }),
      (reason: unknown) => setRecording({ state: 'error', message: reason instanceof Error ? reason.message : 'The recording could not be made into a file.' }),
    )
  }
  const finishRef = useRef(finish)
  useEffect(() => { finishRef.current = finish })

  const start = () => {
    startedAt.current = Date.now()
    log.current = startLog(index)
    lastIndex.current = index
    lastCell.current = cellKey
    if (cursor) log.current = logCursor(log.current, cursor.col, cursor.row, 0)
    setRecording({ state: 'recording', seconds: 0 })
    announce('Recording started.')
    timer.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAt.current
      log.current = closeAt(log.current, elapsed)
      if (log.current.full) finishRef.current(true)
      else setRecording({ state: 'recording', seconds: Math.floor(elapsed / 1000) })
    }, 500)
  }
  useEffect(() => () => window.clearInterval(timer.current), [])

  return (
    <section className="marks" aria-label="Marks and recording">
      <h2 className="marks__title" ref={heading} tabIndex={-1}>Marks</h2>
      <p>Press M on the sound map to mark the date and place you are on.</p>
      {here.length === 0 ? (
        <p>No marks yet.</p>
      ) : (
        <ul className="marks__list" aria-label="Marks">
          {here.map(({ mark, at }) => (
            <li key={`${mark.at}-${at}`}>
              <span>{formatDate(mark.date)}, {where(mark.col, mark.row)}.</span>{' '}
              <Button onClick={() => void copyLink(mark.date, mark.col, mark.row)}>Copy link to mark {formatDate(mark.date)}, {where(mark.col, mark.row)}</Button>{' '}
              <Button onClick={() => remove(at)}>Remove mark {formatDate(mark.date)}, {where(mark.col, mark.row)}</Button>
            </li>
          ))}
        </ul>
      )}
      {copied && <p>{copied}</p>}
      {manualLink && (
        <label>
          Link to copy
          <input type="text" readOnly value={manualLink} onFocus={event => event.currentTarget.select()} />
        </label>
      )}

      <h2 className="marks__title">Record what you hear</h2>
      <p>
        Records the dates you move through, then makes a WAV file of them. It stops by itself after {durationWords(RECORD_LIMIT_S)}.
      </p>
      {recording.state === 'idle' && <Button onClick={start}>Start recording</Button>}
      {recording.state === 'recording' && (
        <>
          <p>{recordingStatus(recording.seconds)}</p>
          <Button onClick={() => finish(false)}>Stop and download</Button>
        </>
      )}
      {recording.state === 'rendering' && <p>Making the file…</p>}
      {recording.state === 'done' && (
        <>
          {recording.stoppedByLimit && <p>The recording stopped by itself at {durationWords(RECORD_LIMIT_S)}.</p>}
          <a href={recording.url} download={recording.name}>Download the recording ({recording.name})</a>{' '}
          <Button onClick={() => setRecording({ state: 'idle' })}>Record again</Button>
        </>
      )}
      {recording.state === 'error' && (
        <>
          <p role="alert">{recording.message}</p>
          <Button onClick={() => setRecording({ state: 'idle' })}>Try again</Button>
        </>
      )}
    </section>
  )
}
