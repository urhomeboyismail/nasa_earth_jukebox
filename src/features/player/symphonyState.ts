// Symphony's state (docs/PLAN.md §6.3, ticket SN07): the live source (SN06) reads each frame, the ruleset (SN03) turns it into a MusicFrame, and the
// ensemble (SN04) plays it. This hook wires the three and keeps what the panel shows. No JSX.
//
// Nothing sounds before a click: play() is the only caller of ensemble.start() (WCAG 1.4.2). The ensemble's own status is the truth about what is
// happening (off, on, paused, suspended), so the panel's button and status line are derived from it and not from a second copy.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FrameFeatures } from '../../analysis/features/types'
import { LOW_CONFIDENCE, type SequenceSpeed } from '../../analysis/video/clock'
import type { LiveFrame, SourceStatus } from '../../analysis/video/types'
import { useLiveSource } from '../../analysis/video/useLiveSource'
import { SCHEDULE_LOOKAHEAD_S } from '../../audio/ensemble/constants'
import type { Ensemble, EnsembleStatus } from '../../audio/ensemble/types'
import { useEnsemble } from '../../audio/ensemble/useEnsemble'
import { saveAudioPrefs, useAudioPrefs } from '../../audio/prefs'
import { useAnnounce } from '../../components'
import { useStoredValue } from '../../hooks/useStoredValue'
import { DETAIL_KEY, parseDetail } from '../calibration/earCheckScore'
import { VOICE_IDS, type DetailLevel, type Visualization, type VoiceId } from '../../data'
import { DETAIL_VOICES, presetFor, toMusicFrame } from '../../sonify'
import type { MusicFrame, Preset } from '../../sonify'

/** The voices in words, for buttons, captions and announcements. */
export const VOICE_WORDS: Record<VoiceId, string> = {
  melody: 'melody', harmony: 'harmony', bass: 'bass', hotspots: 'hot spots', rhythm: 'rhythm', motion: 'motion', time: 'time',
}
export const DETAIL_WORDS: Record<DetailLevel, string> = { calm: 'Calm', standard: 'Standard', full: 'Full' }

/** "melody, harmony and time" */
export function wordList(words: readonly string[]): string {
  if (words.length < 2) return words.join('')
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/** What a level of detail sounds, as the announcement says it: "Melody, harmony, bass, hot spots and time." */
export function detailSentence(detail: DetailLevel, allowed: readonly VoiceId[]): string {
  const voices = VOICE_IDS.filter(voice => DETAIL_VOICES[detail].includes(voice) && allowed.includes(voice)).map(voice => VOICE_WORDS[voice])
  const text = wordList(voices)
  return `Detail: ${DETAIL_WORDS[detail]}. ${text.charAt(0).toUpperCase()}${text.slice(1)}.`
}

/** How fast the video plays at each speed (the checked frames use SEQUENCE_STEP_MS instead). */
export const VIDEO_RATE: Record<SequenceSpeed, number> = { slow: 0.5, normal: 1, fast: 2 }

/** Sets how fast the video plays. */
function setPlaybackRate(video: HTMLVideoElement, rate: number) {
  video.playbackRate = rate
}

export type ButtonKind = 'play' | 'pause' | 'resume' | 'sound'

export type Symphony = {
  ensembleStatus: EnsembleStatus
  sourceStatus: SourceStatus
  /** Why the checked frames are used, when they are. */
  reason: string | undefined
  /** The newest reading: the music, the date it was read for and how sure the reading is. null before the first frame and after Stop. */
  latest: { music: MusicFrame; features: FrameFeatures; date: string; confidence: number } | null
  /** True when the listener paused; false when the page being hidden did. */
  listenerPaused: boolean
  detail: DetailLevel
  speed: SequenceSpeed
  /** The voices a mixer row is shown for: the manifest's list, limited by the detail level, in the captions' order. */
  voices: VoiceId[]
  muted: ReadonlySet<VoiceId>
  solo: VoiceId | null
  button: ButtonKind
  toggle: () => void
  stop: () => void
  setDetail: (level: DetailLevel) => void
  setSpeed: (speed: SequenceSpeed) => void
  toggleMute: (voice: VoiceId) => void
  toggleSolo: (voice: VoiceId) => void
  /** Sets every voice's mute and the solo at once (My mix, and undo of a keyboard change). A voice the manifest leaves out stays silent. */
  setMix: (muted: ReadonlySet<VoiceId>, solo: VoiceId | null) => void
  /** The ensemble, so a keyboard change can sound its one note. */
  ensemble: Pick<Ensemble, 'playNotes' | 'status'>
}

/** One plain sentence on what is being read and how sure the reading is. */
export function statusText(s: Pick<Symphony, 'ensembleStatus' | 'sourceStatus' | 'reason' | 'latest' | 'listenerPaused'>): string {
  if (s.ensembleStatus === 'suspended') return 'The browser has turned the sound off. Press Turn sound on.'
  if (s.ensembleStatus === 'paused') return s.listenerPaused ? 'Paused.' : 'Paused while the page was hidden. Press Resume to continue.'
  // A source that was stopped and started again does not say 'video' a second time; frames arriving while the sound is on mean it is reading.
  const reads = s.latest !== null && s.ensembleStatus === 'on'
  if ((s.sourceStatus === 'idle' || s.sourceStatus === 'stopped') && !reads) return s.ensembleStatus === 'off' ? 'Press Play to start.' : 'Starting.'
  if (s.sourceStatus === 'error') return `The picture could not be read. ${s.reason ?? ''}`.trim()
  const reading = s.sourceStatus === 'video' ? 'Reading the video.' : s.sourceStatus === 'frames' ? 'Reading the checked frames.' : 'Reading the picture.'
  const confidence = s.latest ? ` Reading confidence ${Math.round(s.latest.confidence * 100)}%.` : ''
  const low = s.latest && s.latest.confidence > 0 && s.latest.confidence < LOW_CONFIDENCE && !s.reason ? ' Colours may be a little off; readings may be less exact.' : ''
  return `${reading}${confidence}${s.reason ? ` ${s.reason}` : ''}${low}`
}

/** `artPreset` (art mode, IX12) plays instead of the manifest's preset. It must be the same object between renders, because a new preset is a new ensemble. */
export function useSymphony(visualization: Visualization, video: HTMLVideoElement | null, artPreset?: Preset | null): Symphony {
  const announce = useAnnounce()
  const spec = visualization.sonification
  // The listener's preferences (welcome and mixer) choose the style, the bass, the speed and the muted voices; the manifest's preset is the default,
  // and art mode (IX12) plays instead of both.
  const prefs = useAudioPrefs()
  const preset = artPreset ?? presetFor(prefs.style ?? spec?.preset ?? 'major')
  const allowed: readonly VoiceId[] = spec?.voices ?? VOICE_IDS
  // The listener's own level (kept on this device, set in the ear check or the detail control) comes first, then the manifest's, then Standard.
  const [storedDetail, storeDetail] = useStoredValue<DetailLevel | null>(DETAIL_KEY, parseDetail, null)
  const detail: DetailLevel = storedDetail ?? spec?.detail ?? 'standard'
  const speed: SequenceSpeed = prefs.speed
  const muted = useMemo<ReadonlySet<VoiceId>>(() => new Set(prefs.muted), [prefs.muted])
  const [solo, setSolo] = useState<VoiceId | null>(null)
  const [latest, setLatest] = useState<Symphony['latest']>(null)
  const [listenerPaused, setListenerPaused] = useState(false)

  const { ensemble, status: ensembleStatus } = useEnsemble(preset, detail, spec?.timbre)
  const previous = useRef<MusicFrame | null>(null)

  // Each frame the source reads becomes one frame of music. Set from the callback, not from an effect.
  const onFrame = useCallback((frame: LiveFrame) => {
    const music = toMusicFrame(frame.features, preset, previous.current)
    previous.current = music
    ensemble.apply(music, ensemble.now() + SCHEDULE_LOOKAHEAD_S)
    setLatest({ music, features: frame.features, date: frame.date, confidence: frame.confidence })
  }, [ensemble, preset])

  const source = useLiveSource({ video, visualization, step: speed, onFrame })
  const { start: startSource, stop: stopSource } = source

  // Muting the melody is allowed here for the moment (the mixer is for listening closely), but it is not kept: the store never keeps it muted.
  const [melodyMuted, setMelodyMuted] = useState(false)
  const shownMuted = useMemo<ReadonlySet<VoiceId>>(() => (melodyMuted ? new Set([...muted, 'melody']) : muted), [muted, melodyMuted])

  // A voice the manifest leaves out never sounds; the others follow the mutes. Only a voice whose state changed is told, and a new ensemble
  // (a new style) is told everything.
  const applied = useRef<{ ensemble: typeof ensemble; state: Map<VoiceId, boolean> } | null>(null)
  useEffect(() => {
    if (applied.current?.ensemble !== ensemble) applied.current = { ensemble, state: new Map() }
    const { state } = applied.current
    for (const voice of VOICE_IDS) {
      const off = !allowed.includes(voice) || shownMuted.has(voice)
      if (state.get(voice) !== off && (off || state.has(voice))) ensemble.mute(voice, off)
      state.set(voice, off)
    }
  }, [ensemble, allowed, shownMuted])

  useEffect(() => {
    ensemble.setBass(prefs.bassDb)
  }, [ensemble, prefs.bassDb])

  // The video plays at the chosen speed.
  useEffect(() => {
    if (video) setPlaybackRate(video, VIDEO_RATE[speed])
  }, [video, speed])

  // The page was hidden, or the browser took the sound away: the reading stops with the sound. Coming back does not start either again.
  useEffect(() => {
    if (ensembleStatus === 'paused' || ensembleStatus === 'suspended') stopSource()
  }, [ensembleStatus, stopSource])

  // A new speed makes a new source (the checked frames' pace is fixed when it is made), so a performance that was running carries on with it.
  const running = useRef(false)
  useEffect(() => {
    if (running.current && ensemble.status() === 'on') startSource()
  }, [ensemble, startSource])

  const play = useCallback(async () => {
    running.current = true
    setListenerPaused(false)
    await ensemble.start()
    // Stopped while the browser was still deciding, or the browser kept the sound suspended: the button now says "Turn sound on".
    if (!running.current || ensemble.status() !== 'on') return
    startSource()
  }, [ensemble, startSource])

  const pause = useCallback(() => {
    running.current = false
    setListenerPaused(true)
    ensemble.pause()
    stopSource()
  }, [ensemble, stopSource])

  const resume = useCallback(() => {
    running.current = true
    setListenerPaused(false)
    ensemble.resume()
    // The page may have been hidden for long enough for the browser to suspend the sound; then there is nothing to read for.
    if (ensemble.status() === 'on') startSource()
  }, [ensemble, startSource])

  const stop = useCallback(() => {
    running.current = false
    setListenerPaused(false)
    ensemble.stop()
    stopSource()
    previous.current = null
    setLatest(null)
  }, [ensemble, stopSource])

  const toggle = useCallback(() => {
    if (ensembleStatus === 'on') pause()
    else if (ensembleStatus === 'paused') resume()
    else void play()
  }, [ensembleStatus, pause, resume, play])

  const setDetail = useCallback((level: DetailLevel) => {
    storeDetail(level)
    announce(detailSentence(level, allowed))
  }, [announce, allowed, storeDetail])

  const setSpeed = useCallback((next: SequenceSpeed) => saveAudioPrefs({ speed: next }), [])

  const toggleMute = useCallback((voice: VoiceId) => {
    if (voice === 'melody') setMelodyMuted(on => !on)
    else saveAudioPrefs({ muted: muted.has(voice) ? [...muted].filter(v => v !== voice) : [...muted, voice] })
  }, [muted])

  const toggleSolo = useCallback((voice: VoiceId) => {
    const next = solo === voice ? null : voice
    ensemble.solo(next)
    setSolo(next)
  }, [ensemble, solo])

  // A recalled mix (My mix, IX06) sets the kept mutes and the solo. The melody's mute is only for this visit, like a click on it; the rest are kept.
  const setMix = useCallback((nextMuted: ReadonlySet<VoiceId>, nextSolo: VoiceId | null) => {
    const kept = new Set([...nextMuted].filter(voice => allowed.includes(voice)))
    saveAudioPrefs({ muted: [...kept].filter(voice => voice !== 'melody') })
    setMelodyMuted(kept.has('melody'))
    const soloVoice = nextSolo !== null && allowed.includes(nextSolo) ? nextSolo : null
    ensemble.solo(soloVoice)
    setSolo(soloVoice)
  }, [ensemble, allowed])

  const button: ButtonKind = ensembleStatus === 'on' ? 'pause' : ensembleStatus === 'paused' ? 'resume' : ensembleStatus === 'suspended' ? 'sound' : 'play'

  return {
    ensembleStatus,
    sourceStatus: source.status,
    reason: source.reason,
    latest,
    listenerPaused,
    detail,
    speed,
    voices: VOICE_IDS.filter(voice => allowed.includes(voice) && DETAIL_VOICES[detail].includes(voice)),
    muted: shownMuted,
    solo,
    button,
    toggle,
    stop,
    setDetail,
    setSpeed,
    toggleMute,
    toggleSolo,
    setMix,
    ensemble,
  }
}
