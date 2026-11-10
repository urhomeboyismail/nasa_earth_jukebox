// The live reading (docs/PLAN.md §6.3, ticket SN06): a same-origin <video> plays, each frame it shows is drawn to an ImageBitmap and read by the feature
// worker (SN01), and the result carries the date that frame maps to and a confidence. Frames are dropped, never queued: at most one reading is in
// flight, and at most 20 are started a second. If the video will not play, the checked frames are stepped through instead, and the listener is told.
//
// Nothing starts before start(), which the Play click calls (WCAG 1.4.2).

import { dateOfVideoFrame } from '../../data/video'
import { extractInWorker, resetStream, LIVE_COLOUR_TOLERANCE } from '../features'
import { LOW_CONFIDENCE, MIN_FRAME_GAP_S, VIDEO_START_TIMEOUT_MS, videoIndexFor } from './clock'
import { FrameSequenceSource } from './frameSequence'
import { baseInput, baselineFor, defaultLoadPixels } from './input'
import type { LiveFrame, LiveSourceOptions, SourceStatus } from './types'

const STREAM = 'live'
const LOW_CONFIDENCE_REASON = 'Colours from the video are a little off; readings may be less exact.'
const NO_VIDEO_REASON = 'This data set has no video, so the checked frames are used.'

export class LiveSource {
  private readonly options: LiveSourceOptions
  private readonly video
  private readonly spec
  private readonly extract
  private readonly loadPixels
  private running = false
  private disposed = false
  private inFlight = false
  private produced = false
  private lowConfidence = false
  private droppedFrames = 0
  /** The performance time (ms) of the last frame that was started. */
  private lastAccepted = -Infinity
  private lastMediaTime = -1
  private lastDate: string | null = null
  private lastCurrentTime = Number.NaN
  private callback: number | null = null
  private animation: number | null = null
  private timeout: ReturnType<typeof setTimeout> | null = null
  private held: ImageBitmap | null = null
  private sequence: FrameSequenceSource | null = null
  private framesReason = ''

  constructor(options: LiveSourceOptions) {
    this.options = options
    this.video = options.video
    this.spec = options.visualization.video
    this.extract = options.extract ?? extractInWorker
    this.loadPixels = options.loadPixels ?? defaultLoadPixels
  }

  /** Frames dropped because a reading was still in progress (back-pressure). */
  get dropped() {
    return this.droppedFrames
  }

  /** Must be called from the Play click. Starts the video and the reading, or the checked frames if there is no video to read. */
  start(): void {
    if (this.disposed || this.running) return
    this.running = true
    if (this.sequence) {
      this.options.onStatus('frames', this.framesReason)
      this.sequence.start()
      return
    }
    if (!this.spec) {
      this.fallBack(NO_VIDEO_REASON)
      return
    }
    this.video.addEventListener('error', this.onError)
    // The video gets a few seconds to show a first frame; a slow or broken one hands over to the checked frames.
    this.timeout = setTimeout(() => {
      this.timeout = null
      if (!this.produced) this.fallBack('The video did not start, so the checked frames are used.')
    }, VIDEO_START_TIMEOUT_MS)
    Promise.resolve(this.video.play()).catch(() => {
      // A pause() right after play() rejects it too, and that is not a failure.
      if (this.running && !this.produced) this.fallBack('The browser would not play the video, so the checked frames are used.')
    })
    this.watch()
  }

  /** Pauses the reading and the video. The next start() continues. */
  stop(): void {
    if (!this.running) return
    this.running = false
    if (this.sequence) {
      this.sequence.stop()
      return
    }
    this.halt()
    this.video.pause()
    this.options.onStatus('stopped')
  }

  /** Moves to a video frame (live) or a checked frame (frames). In the video the reading follows the new time; in the frames it is read at once. */
  seek(index: number): void {
    if (this.disposed) return
    if (this.sequence) {
      this.sequence.seek(index)
      return
    }
    if (!this.spec) return
    resetStream(STREAM)
    this.lastMediaTime = -1
    this.video.currentTime = Math.max(0, index) / this.spec.fps
  }

  /** Stops, removes the listeners and closes any bitmap still held. Nothing is called back afterwards. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.running = false
    this.halt()
    this.video.pause()
    this.held?.close()
    this.held = null
    this.sequence?.dispose()
  }

  // ---- watching the video ----

  private watch() {
    if (!this.running || this.disposed) return
    if (typeof this.video.requestVideoFrameCallback === 'function') this.callback = this.video.requestVideoFrameCallback(this.onVideoFrame)
    else this.animation = requestAnimationFrame(this.onAnimationFrame)
  }

  /** Cancels whatever is waiting for the next frame, the start timeout and the error listener. */
  private halt() {
    if (this.callback !== null && typeof this.video.cancelVideoFrameCallback === 'function') this.video.cancelVideoFrameCallback(this.callback)
    if (this.animation !== null) cancelAnimationFrame(this.animation)
    this.callback = null
    this.animation = null
    if (this.timeout !== null) clearTimeout(this.timeout)
    this.timeout = null
    this.video.removeEventListener('error', this.onError)
  }

  /** The browser presented a video frame. `metadata.mediaTime` is the time of that very frame. */
  private onVideoFrame = (now: number, metadata: VideoFrameCallbackMetadata) => {
    this.callback = null
    if (!this.running || this.disposed) return
    this.accept(now, metadata.mediaTime)
    this.watch()
  }

  /** The fallback for a browser without requestVideoFrameCallback: look at the video on every animation frame and read when its time moved. */
  private onAnimationFrame = (now: number) => {
    this.animation = null
    if (!this.running || this.disposed) return
    const time = this.video.currentTime
    if (time !== this.lastCurrentTime && !this.video.paused) {
      this.lastCurrentTime = time
      this.accept(now, time)
    }
    this.watch()
  }

  private onError = () => {
    this.fallBack('The video could not be played, so the checked frames are used.')
  }

  /** A frame is on screen. It is read only if nothing is being read and the last start was long enough ago; otherwise it is dropped. */
  private accept(now: number, mediaTime: number) {
    if (!this.produced) {
      this.produced = true
      if (this.timeout !== null) clearTimeout(this.timeout)
      this.timeout = null
      this.options.onStatus('video')
    }
    if (this.inFlight) {
      this.droppedFrames++
      return
    }
    if ((now - this.lastAccepted) / 1000 < MIN_FRAME_GAP_S) return
    this.lastAccepted = now
    void this.read(mediaTime)
  }

  // ---- reading one frame ----

  private async read(mediaTime: number): Promise<void> {
    const spec = this.spec
    if (!spec) return
    this.inFlight = true
    let bitmap: ImageBitmap | null = null
    try {
      bitmap = await createImageBitmap(this.video, { colorSpaceConversion: 'none' })
      this.held = bitmap
      if (!this.running || this.disposed) return
      // A time that goes back (the video looped, or the listener scrubbed) is not motion from the frame before it.
      if (mediaTime < this.lastMediaTime) resetStream(STREAM)
      this.lastMediaTime = mediaTime
      const videoIndex = videoIndexFor(mediaTime, spec.fps)
      const date = dateOfVideoFrame(spec, videoIndex)
      const v = this.options.visualization
      let baseline = await baselineFor(v, date, this.loadPixels)
      // A normal of another size than the video cannot be compared with it; the frame is then read without a change.
      if (baseline?.pixels && (baseline.pixels.width !== bitmap.width || baseline.pixels.height !== bitmap.height)) baseline = undefined
      if (!this.running || this.disposed) return
      const held = bitmap
      // The extractor takes the bitmap from here (it is transferred to the worker and closed there).
      bitmap = null
      const features = await this.extract(STREAM, held, { ...baseInput(v, date, date, LIVE_COLOUR_TOLERANCE), baseline })
      if (!this.running || this.disposed) return
      this.lastDate = date
      const frame: LiveFrame = { features, date, videoIndex, mediaTime, confidence: features.confidence }
      this.options.onFrame(frame)
      // A frame with nothing readable in it (all land, say) has confidence 0 because there was nothing to be sure of, not because the colours are off.
      const low = frame.confidence < LOW_CONFIDENCE && frame.features.stats.validShare > 0
      if (low !== this.lowConfidence) {
        this.lowConfidence = low
        this.options.onStatus('video', low ? LOW_CONFIDENCE_REASON : undefined)
      }
    } catch (error) {
      if (this.running && !this.disposed) this.fallBack(`The live reading failed (${error instanceof Error ? error.message : String(error)}), so the checked frames are used.`)
    } finally {
      bitmap?.close()
      this.held = null
      this.inFlight = false
    }
  }

  // ---- the checked frames ----

  /** Hands over to the checked frames, from the date the video had reached, and says why. */
  private fallBack(reason: string): void {
    if (this.sequence || this.disposed) return
    this.halt()
    this.video.pause()
    this.framesReason = reason
    const forward = (status: SourceStatus, why?: string) => {
      // 'frames' was announced here with the reason; the sequence source's own announcement would only repeat it without one.
      if (status !== 'frames') this.options.onStatus(status, why)
    }
    this.sequence = new FrameSequenceSource({
      visualization: this.options.visualization,
      onFrame: frame => this.options.onFrame(frame),
      onStatus: forward,
      extract: this.extract,
      loadPixels: this.loadPixels,
      loadBitmap: this.options.loadBitmap,
      step: this.options.step,
    })
    this.options.onStatus('frames', reason)
    if (this.running) this.sequence.start(this.lastDate ?? undefined)
  }
}
