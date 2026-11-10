// The checked frames, stepped through at a set speed (docs/PLAN.md §6.3, ticket SN06): what plays when a data set has no video, or when the video
// will not play. Each frame is read exactly as a live one is, but with the plain colour tolerance (the PNGs have not been through a video encoder).
// Nothing queues: the next frame is read only after the last one finished, and a device that is slow skips a step instead of falling behind.

import { extractInWorker, resetStream } from '../features'
import type { FrameSequenceOptions, LiveFrame } from './types'
import { SEQUENCE_STEP_MS } from './clock'
import { baseInput, baselineFor, defaultLoadPixels } from './input'

const STREAM = 'frames'

export class FrameSequenceSource {
  private readonly options: FrameSequenceOptions
  private readonly frames
  private readonly extract
  private readonly loadPixels
  private readonly loadBitmap
  private running = false
  private disposed = false
  /** The frame to read next. */
  private next = 0
  /** Bumped on every start, stop and seek, so a reading that finishes late is ignored. */
  private token = 0
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(options: FrameSequenceOptions) {
    this.options = options
    this.frames = [...options.visualization.frames].sort((a, b) => a.date.localeCompare(b.date))
    this.extract = options.extract ?? extractInWorker
    this.loadPixels = options.loadPixels ?? defaultLoadPixels
    this.loadBitmap = options.loadBitmap ?? (async (url: string) => {
      // The worker takes a bitmap, so the PNG is drawn into one. Colours are left as they are in the file.
      const pixels = await this.loadPixels(url)
      return createImageBitmap(new ImageData(Uint8ClampedArray.from(pixels.data), pixels.width, pixels.height), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
    })
  }

  /** How many checked frames there are. */
  get length() {
    return this.frames.length
  }

  /** Starts, or continues after stop(). `fromDate` starts at the first checked frame on or after that date (the live source hands over this way). */
  start(fromDate?: string): void {
    if (this.disposed || this.running) return
    this.running = true
    if (fromDate !== undefined) {
      const found = this.frames.findIndex(f => f.date >= fromDate)
      this.next = found === -1 ? this.frames.length : found
    }
    // Starting again after the end begins from the first frame.
    if (this.next >= this.frames.length) this.next = 0
    this.options.onStatus('frames', this.options.reason)
    resetStream(STREAM)
    this.begin(this.next)
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    this.token++
    this.clearTimer()
    this.options.onStatus('stopped')
  }

  /** Moves to the checked frame at `index` (clamped) and reads it now, if running. The stream starts fresh: a jump has no motion. */
  seek(index: number): void {
    if (this.disposed || !this.frames.length) return
    this.token++
    this.clearTimer()
    this.next = Math.min(this.frames.length - 1, Math.max(0, Math.round(index)))
    resetStream(STREAM)
    if (this.running) this.begin(this.next)
  }

  dispose(): void {
    this.disposed = true
    this.running = false
    this.token++
    this.clearTimer()
  }

  private clearTimer() {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
  }

  private begin(index: number) {
    void this.step(index, this.token)
  }

  private async step(index: number, token: number): Promise<void> {
    if (index >= this.frames.length) {
      // The last frame has been read: the sequence is over.
      this.running = false
      this.options.onStatus('stopped', 'The checked frames have ended.')
      return
    }
    const began = Date.now()
    let live: LiveFrame
    try {
      live = await this.read(index)
    } catch (error) {
      if (token !== this.token || this.disposed) return
      this.running = false
      this.options.onStatus('error', error instanceof Error ? error.message : String(error))
      return
    }
    // A stop, a seek or a dispose while this was being read: its result is not wanted.
    if (token !== this.token || !this.running || this.disposed) return
    this.next = index + 1
    this.options.onFrame(live)

    // A frame takes the step time. One that took longer skips the steps it overran instead of making the next one late.
    const stepMs = SEQUENCE_STEP_MS[this.options.step ?? 'normal']
    const took = Date.now() - began
    const skipped = Math.floor(took / stepMs)
    this.next = index + 1 + skipped
    this.timer = setTimeout(() => {
      this.timer = null
      void this.step(index + 1 + skipped, token)
    }, (skipped + 1) * stepMs - took)
  }

  private async read(index: number): Promise<LiveFrame> {
    const frame = this.frames[index]
    const v = this.options.visualization
    const [bitmap, baseline] = await Promise.all([this.loadBitmap(frame.image), baselineFor(v, frame.date, this.loadPixels)])
    if (this.disposed) {
      bitmap.close()
      throw new Error('The source was disposed.')
    }
    const features = await this.extract(STREAM, bitmap, { ...baseInput(v, frame.id, frame.date, 1), baseline })
    return { features, date: frame.date, videoIndex: null, mediaTime: null, confidence: features.confidence }
  }
}
