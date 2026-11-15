// A track with no video still needs what the video gives OceanStage: a clock. This is the part of an HTMLVideoElement the stage uses
// (a time, a rate, play and pause), run on animation frames. A video is a Clock too, so the stage follows either the same way.

export type Clock = { currentTime: number; playbackRate: number; play(): Promise<void>; pause(): void }
export type TimerClock = Clock & { dispose(): void }

type Options = {
  /** Seconds of media time in all. */
  duration: number
  /** Asked at the end: true wraps to the start, false stops. */
  loop: () => boolean
  /** Called about ten times a second while it runs, like a video's timeupdate. */
  onTick: () => void
  /** Called when it stops, by `pause()` or by reaching the end, like a video's pause event. */
  onPause: () => void
}

const TICK_MS = 100

export function createTimerClock({ duration, loop, onTick, onPause }: Options): TimerClock {
  let time = 0
  let rate = 1
  let frame: number | null = null
  let last = 0
  let ticked = 0

  const halt = () => {
    if (frame !== null) cancelAnimationFrame(frame)
    frame = null
  }

  const run = (now: number) => {
    time += ((now - last) / 1000) * rate
    last = now
    if (time >= duration) {
      if (loop()) time %= duration
      else {
        time = duration
        halt()
        onTick()
        onPause()
        return
      }
    }
    if (now - ticked >= TICK_MS) {
      ticked = now
      onTick()
    }
    frame = requestAnimationFrame(run)
  }

  return {
    get currentTime() { return time },
    set currentTime(next) { time = Math.min(duration, Math.max(0, next)) },
    get playbackRate() { return rate },
    set playbackRate(next) { rate = next },
    play() {
      if (frame !== null) return Promise.resolve()
      if (time >= duration) time = 0
      last = performance.now()
      ticked = last
      frame = requestAnimationFrame(run)
      return Promise.resolve()
    },
    pause() {
      if (frame === null) return
      halt()
      onPause()
    },
    dispose: halt,
  }
}
