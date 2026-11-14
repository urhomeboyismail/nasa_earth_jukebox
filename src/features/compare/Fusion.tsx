import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { resetStream } from '../../analysis/features'
import { FrameSequenceSource } from '../../analysis/video/frameSequence'
import { readFrameFeatures } from '../../analysis/video/readFrame'
import { SCHEDULE_LOOKAHEAD_S } from '../../audio/ensemble/constants'
import { useEnsemble } from '../../audio/ensemble/useEnsemble'
import { useAudioPrefs } from '../../audio/prefs'
import { Button, Notice, Slider, useAnnounce } from '../../components'
import { loadCatalog, loadVisualization, type CatalogEntry, type Visualization } from '../../data'
import { fuseFrames, presetFor, toMusicFrame, type MusicFrame } from '../../sonify'
import { frameOn, overlap } from './fusion'

const B_STREAM = 'fusion-b'

/**
 * Compare → "Two data sets" (docs/planning/UIUX-BLUEPRINT.md §3.2): this data set (deck A) and one it is paired with (deck B, from the manifest's
 * `pairsWith`) as one piece of music, over the dates both cover. A keeps the melody, harmony, motion and clock; B plays the bass and rhythm; the
 * hot spots of both sound, A's left and B's right. The caption names the deck behind every phrase.
 */
export function Fusion({ visualization }: { visualization: Visualization }) {
  const announce = useAnnounce()
  const id = useId()
  const pairs = useMemo(() => visualization.pairsWith ?? [], [visualization])
  const [catalog, setCatalog] = useState<CatalogEntry[]>([])
  const [bId, setBId] = useState(pairs[0]?.id ?? '')
  const [loaded, setLoaded] = useState<{ id: string; v: Visualization } | null>(null)
  const [loadError, setLoadError] = useState('')
  const [swapped, setSwapped] = useState(false)
  const [mix, setMix] = useState(50)
  const [summary, setSummary] = useState('')
  const [playing, setPlaying] = useState(false)

  const prefs = useAudioPrefs()
  const deckB = loaded?.id === bId ? loaded.v : null
  const [a, b] = swapped && deckB ? [deckB, visualization] : [visualization, deckB]
  const preset = presetFor(prefs.style ?? a.sonification?.preset ?? 'major')
  const { ensemble } = useEnsemble(preset, 'standard')
  useEffect(() => { ensemble.setBass(prefs.bassDb) }, [ensemble, prefs.bassDb])

  useEffect(() => {
    let cancelled = false
    loadCatalog().then(entries => { if (!cancelled) setCatalog(entries) }, () => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!bId) return
    let cancelled = false
    loadVisualization(bId).then(
      v => { if (!cancelled) { setLoaded({ id: bId, v }); setLoadError('') } },
      (error: unknown) => { if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error)) },
    )
    return () => { cancelled = true }
  }, [bId])

  const shared = useMemo(() => (b ? overlap(a, b) : null), [a, b])

  // One source steps through A's shared frames; each frame of A reads B's frame for the same date and plays the two as one.
  // The crossfader is kept inside, so moving it does not make a new source.
  const deck = useMemo(() => {
    if (!b || !shared?.a.length) return null
    let share = 0.5
    let previousA: MusicFrame | null = null
    let previousB: MusicFrame | null = null
    const sequence = new FrameSequenceSource({
      visualization: { ...a, frames: shared.a },
      step: prefs.speed,
      onStatus: status => { if (status === 'stopped' || status === 'error') setPlaying(false) },
      onFrame: frame => {
        const musicA = toMusicFrame(frame.features, preset, previousA)
        previousA = musicA
        void readFrameFeatures(b, frameOn(shared.b, frame.date), B_STREAM).then(features => {
          const musicB = toMusicFrame(features, preset, previousB)
          previousB = musicB
          const fused = fuseFrames(musicA, musicB, share)
          ensemble.apply(fused, ensemble.now() + SCHEDULE_LOOKAHEAD_S)
          setSummary(fused.summary)
        }, () => {
          ensemble.apply(fuseFrames(musicA, null, share), ensemble.now() + SCHEDULE_LOOKAHEAD_S)
        })
      },
    })
    return { source: sequence, setShare: (next: number) => { share = next } }
  }, [a, b, shared, preset, prefs.speed, ensemble])
  const source = deck?.source ?? null
  useEffect(() => { deck?.setShare(mix / 100) }, [deck, mix])

  // StrictMode runs a cleanup and then the effect again with the same source, so the disposal waits a microtask and is skipped if it came back.
  const current = useRef<FrameSequenceSource | null>(null)
  useEffect(() => {
    current.current = source
    return () => {
      current.current = null
      source?.stop()
      queueMicrotask(() => { if (source && current.current !== source) source.dispose() })
    }
  }, [source])

  async function play() {
    if (!source) return
    await ensemble.start()
    resetStream(B_STREAM)
    source.start()
    setPlaying(true)
  }

  function stop() {
    source?.stop()
    ensemble.stop()
    setPlaying(false)
  }

  function swap() {
    stop()
    setSwapped(on => !on)
    announce('Decks swapped.')
  }

  if (!pairs.length) return <Notice>No data sets are paired with this one yet. A data set's manifest lists the ones it can be heard with (`pairsWith`).</Notice>

  const titleOf = (pairId: string) => catalog.find(entry => entry.id === pairId)?.title ?? pairId
  const note = pairs.find(pair => pair.id === bId)?.note
  const dates = (v: Visualization) => `${v.frames[0].date} to ${v.frames[v.frames.length - 1].date}`

  return (
    <section className="fusion" aria-label="Two data sets">
      <div className="fusion__decks">
      <div className="fusion__deck compare-glass" data-deck="Deck A">
        <p>Deck A: <strong>{a.title}</strong>. It plays the melody, the harmony, the motion and the clock.</p>
      </div>
      <div className="fusion__deck compare-glass" data-deck="Deck B">
        <label htmlFor={`${id}-b`}>Deck B</label>
        <select id={`${id}-b`} value={bId} onChange={event => { stop(); setSwapped(false); setBId(event.currentTarget.value) }} aria-describedby={note ? `${id}-note` : undefined}>
          {pairs.map(pair => <option key={pair.id} value={pair.id}>{titleOf(pair.id)}</option>)}
        </select>
        {note && <p id={`${id}-note`}>Why these two: {note}</p>}
        {b && <p>Deck B: <strong>{b.title}</strong>. It plays the bass and the rhythm. The hot spots of A sound on the left, those of B on the right.</p>}
      </div>
      </div>
      {loadError && <Notice>{loadError}</Notice>}
      {b && shared && !shared.a.length && <Notice>These two data sets share no dates ({dates(a)}, and {dates(b)}), so they cannot be heard together.</Notice>}
      {b && shared && shared.a.length > 0 && (
        <>
          <p>Linked time: the {shared.a.length} dates from {shared.a[0].date} to {shared.a[shared.a.length - 1].date}, which both data sets cover.</p>
          {/* The ends are drawn, not read: the slider's own label and value already say which deck is which. */}
          <div className="fusion__fader compare-glass">
            <span className="fusion__fader-end" aria-hidden="true">A</span>
            <Slider label="Crossfader, A to B" min={0} max={100} step={10} value={mix} onChange={setMix} describe={value => (value === 50 ? 'Both decks' : value < 50 ? `More of A (${100 - value}%)` : `More of B (${value}%)`)} />
            <span className="fusion__fader-end" aria-hidden="true">B</span>
          </div>
          <div className="player__controls" role="group" aria-label="Playback">
            <Button variant="primary" onClick={() => void (playing ? stop() : play())}>{playing ? 'Stop' : 'Play both'}</Button>
            <Button onClick={swap}>Swap decks</Button>
          </div>
          <p className="fusion__now"><strong>Now:</strong> {summary || 'Nothing is playing yet.'}</p>
          <p className="fusion__hint">Each data set says only what it shows. Hearing them together does not mean one causes the other.</p>
        </>
      )}
    </section>
  )
}
