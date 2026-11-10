// The clock of the live reading (docs/PLAN.md §6.3, ticket SN06): how often a frame is read, how long to wait for the video, and which video frame a
// media time belongs to. Pure.

/** The most frames a second are read, live or stepped. Above this a frame is dropped, not queued. */
export const FRAME_RATE_CAP_HZ = 20
export const MIN_FRAME_GAP_S = 1 / FRAME_RATE_CAP_HZ
/** If the video has not started producing frames this long after play, the checked frames are used instead. */
export const VIDEO_START_TIMEOUT_MS = 3000
/** How long a checked frame is shown in the fallback, by playback speed. Copied from the player's STEP_MS (usePlayer.ts), and a test checks they match. */
export const SEQUENCE_STEP_MS = { slow: 1600, normal: 1000, fast: 500 } as const
export type SequenceSpeed = keyof typeof SEQUENCE_STEP_MS
/** A reading whose confidence is below this raises the status reason. */
export const LOW_CONFIDENCE = 0.6

/**
 * The video frame a media time belongs to. Rounded, not floored: a browser that reports a time a fraction early (0.0999 s for the frame at 0.1 s)
 * still gets that frame, and never the one before it. Never below 0.
 */
export function videoIndexFor(mediaTime: number, fps: number): number {
  return Math.max(0, Math.round(mediaTime * fps))
}
