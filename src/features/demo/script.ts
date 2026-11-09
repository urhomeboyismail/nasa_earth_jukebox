// The scripted tour behind the "Play the demo" button: where it goes, what it says, and when it plays. It names pages and says nothing
// about any one data set, so it works for every data set (docs/DATASET-PLAYBOOK.md). Edit the words here; the order is the demo.

import type { Page } from '../../pages'

export type DemoStep = {
  page: Page
  /** Shown as a caption and read out, so the tour makes sense without seeing the screen. */
  say: string
  /** Play the dates on this page and wait for them to finish. */
  play?: true
  /** How long to stay on the page (milliseconds) when it does not play. */
  holdMs?: number
}

export const DEMO_STEPS: DemoStep[] = [
  { page: 'home', say: 'Welcome to the Earth Jukebox. It turns NASA Earth imagery into sound, so you can follow change over time by ear.', holdMs: 7000 },
  { page: 'learn', say: 'First, the sounds. Each step from cold to hot has its own note, and a change from normal has its own bed of sound.', holdMs: 7000 },
  { page: 'listen', say: 'Now listen. The dates play one after another; a rising sound means a higher value, and a bell marks a big jump.', play: true },
  { page: 'compare', say: 'Then compare two dates by ear, and say which one shows the change.', holdMs: 7000 },
  { page: 'about', say: 'The About page gives the source, the method and the limits, so you know what the sound can and cannot tell you.', holdMs: 7000 },
  { page: 'home', say: 'That is the tour. Everything you heard works with a keyboard and a screen reader.', holdMs: 4000 },
]
