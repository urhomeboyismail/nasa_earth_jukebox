// The find game's score (ticket IX04). Pure.

/** One target: 1000, less 5 a move and 10 a second, never below 0. Whole points. */
export function targetScore(moves: number, seconds: number): number {
  return Math.max(0, Math.round(1000 - 5 * moves - 10 * seconds))
}

/** "1:05" from 65 seconds. */
export function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}
