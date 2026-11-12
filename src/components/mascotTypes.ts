// Types and defaults for the Echo mascot (Juke-Bot, F58). Kept apart from Mascot.tsx so that file exports only components.

export type MascotPose = 'idle' | 'listening' | 'talking' | 'thinking'
export type MascotExpression = 'happy' | 'searching' | 'eq_active' | 'alert' | 'resting'
export type MascotMotion = 'idle' | 'boosting' | 'retro' | 'pointing'

export type EchoProps = {
  pose?: MascotPose
  /** Visor look. Default from the pose: talking is eq_active, thinking is searching, otherwise happy. */
  expression?: MascotExpression
  /** Default 'idle'. */
  motion?: MascotMotion
  /** 0 to 1: flame length while boosting. */
  thrust?: number
  /** 0 to 255, one per chest bar. Missing bars use the resting shape. */
  levels?: ArrayLike<number>
  /** 0 to 1: how fast the mini globe turns. 0 keeps it still. */
  globeSpin?: number
  className?: string
}

export const expressionForPose = (pose: MascotPose): MascotExpression =>
  pose === 'talking' ? 'eq_active' : pose === 'thinking' ? 'searching' : 'happy'

/** The chest bars when nothing drives them. */
export const RESTING_LEVELS: readonly number[] = [90, 160, 120, 60]

export const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0)
