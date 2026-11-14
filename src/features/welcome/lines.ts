// What the mascot says (F37). Nothing here names a data set: any fact about the data comes from src/describe/.

/** The mascot's name. One place, so a rename is one line (board entry R-20261109-F37-1). */
export const MASCOT_NAME = 'Echo'

export const GREETING = `Hi, I'm ${MASCOT_NAME}. I turn pictures of Earth into sound. How would you like to use the Earth Jukebox?`

export const PATH_LABELS = {
  'screen-reader': 'I use a screen reader',
  map: 'I can see the map',
  play: 'Just play me something',
} as const

export const PATH_HINTS = {
  'screen-reader': 'Short descriptions, no spoken voice from me, and we start by learning the sounds.',
  map: 'Full descriptions, and I may read my lines aloud. We go straight to Listen.',
  play: 'We check your sound, then play the first data set.',
} as const

/** Each sound-check step: what is played, where it comes from (-1 left, 1 right, 0 centre) and the question. */
export const CHECK_STEPS = [
  { id: 'note', pan: 0, text: 'First, a single note.', question: 'Did you hear a note?' },
  { id: 'left', pan: -1, text: 'Now a note on the left.', question: 'Did you hear it on your left?' },
  { id: 'right', pan: 1, text: 'Now a note on the right.', question: 'Did you hear it on your right?' },
  { id: 'centre', pan: 0, text: 'Now a note in the middle.', question: 'Did you hear it in the middle?' },
] as const

export const NOT_HEARD = 'Check that your headphones or speakers are on and the volume is up, then press Replay. You can carry on without it.'

export const VOLUME_QUESTION = 'Is this volume comfortable?'

export const CHAT_GREETING = `Commander! Welcome to the Earth Information Jukebox. I'm ${MASCOT_NAME}, your sonic guide. Before we drop the needle on these NASA datasets, what should I call you?`

export const tuneQuestion = (name: string) =>
  `${name ? `Great to meet you, ${name}!` : 'Great to meet you!'} How are we tuning your sound frequencies today?`

export const lockedLine = (name: string) => `Frequencies locked${name ? `, ${name}` : ''}! Let's explore the planet.`

/** The four sounds offered in the chat. The ids are styles that already exist (src/sonify/presets.ts). */
export const TUNE_CHIPS = [
  { id: 'cinematic', label: 'Cinematic Orchestral' },
  { id: 'chiptune', label: '8-Bit Arcade' },
  { id: 'nature', label: 'Nature Ambient' },
  { id: 'bass', label: 'Heavy Bass' },
] as const
