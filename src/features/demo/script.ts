// The scripted tour behind the "Play the demo" button: where it goes, what it says, and when it plays. It names pages and says nothing
// about any one data set, so it works for every data set (docs/DATASET-PLAYBOOK.md). Edit the words here; the order is the demo.

import type { Page } from '../../pages'

export type DemoStep = {
  page: Page
  /** Shown as a caption, and spoken too when the listener has switched on "Read the demo aloud" (F42). */
  say: string
  /** Play the dates on this page and wait for them to finish. */
  play?: true
  /** Ask one question about the next two dates and wait for the answer (IX05). */
  predict?: true
  /** How long to stay on the page (milliseconds) when it does not play. */
  holdMs?: number
  /** A CSS selector, e.g. '[data-tour="play"]'. When set, Echo flies there and points at it (JB05). */
  target?: string
}

export const DEMO_STEPS: DemoStep[] = [
  { page: 'home', say: 'Welcome to the Earth Jukebox. It turns NASA Earth imagery into sound, so you can follow change over time by ear.', holdMs: 7000 },
  { page: 'learn', say: 'First, the sounds. Each step from the lowest category to the highest has its own note, and a change from normal has its own bed of sound.', holdMs: 7000 },
  { page: 'listen', say: 'Now listen. The dates play one after another; a rising sound means a higher value, and a bell marks a big jump.', play: true },
  { page: 'listen', say: 'Now you try. Before the next two dates play, say what will happen to the strongest area. Then hear the answer.', predict: true },
  { page: 'compare', say: 'Then compare two dates by ear, and say which one shows the change.', holdMs: 7000 },
  { page: 'about', say: 'The About page gives the source, the method and the limits, so you know what the sound can and cannot tell you.', holdMs: 7000 },
  { page: 'home', say: 'That is the tour. Everything you heard works with a keyboard and a screen reader.', holdMs: 4000 },
]

/** The guided tour (JB05): Echo flies to each control in turn and points at it. Each step waits for Next. The words name no data set. */
export const TOUR_STEPS: DemoStep[] = [
  { page: 'listen', say: 'This is where you choose the data set. Each one has its own sounds, and its own source and credit.', target: '[data-tour="dataset-picker"]' },
  { page: 'listen', say: 'Play starts the dates one after another. Press it again to pause.', target: '[data-tour="play"]' },
  { page: 'listen', say: 'Speed and Volume change how fast the dates play and how loud they are.', target: '[data-tour="mixer"]' },
]
