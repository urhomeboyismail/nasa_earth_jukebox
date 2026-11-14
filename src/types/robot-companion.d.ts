// The <robot-companion> element (public/robot/robot-companion.js, JB08): the 3D robot that draws Echo. Only the parts the app uses are typed.
import type { DetailedHTMLProps, HTMLAttributes } from 'react'

export type RobotSayOptions = { speed?: number; hold?: number; face?: string; gesture?: string }

export interface RobotCompanionElement extends HTMLElement {
  /** Types the line into its bubble, the mouth moving, and resolves when the typing is done. */
  say(text: string, options?: RobotSayOptions): Promise<boolean>
  /** Shows a face for `seconds` (2 by default; Infinity keeps it). */
  face(name: string, seconds?: number): RobotCompanionElement
  gesture(name: string, options?: { dur?: number }): Promise<boolean>
  stopGesture(name?: string): void
  /** Stops the line it is saying and closes its bubble. */
  hush(): void
  /** Draws the bars on its chest screen: levels from 0 to 1, low pitch first. Null rests them flat. At most 30 draws a second; still under reduced motion. */
  setChestBands(values: readonly number[] | null): RobotCompanionElement
  configure(config: Record<string, unknown>): RobotCompanionElement
}

type RobotCompanionAttributes = DetailedHTMLProps<HTMLAttributes<RobotCompanionElement>, RobotCompanionElement> & {
  /** URL of three.module.js. */
  three?: string
  /** URL of the picture on its chest. */
  logo?: string
  bubble?: 'left' | 'right' | 'top'
  look?: 'cursor' | 'none'
  /** No activities, tips or greetings of its own. */
  quiet?: boolean
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'robot-companion': RobotCompanionAttributes
    }
  }
}
