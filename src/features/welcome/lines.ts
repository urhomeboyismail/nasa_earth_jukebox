// What the mascot says (F37). Nothing here names a data set: any fact about the data comes from src/describe/.

/** The mascot's name. One place, so a rename is one line (board entry R-20261109-F37-1). */
export const MASCOT_NAME = 'Echo'

export const CHAT_GREETING = 'Commander! Welcome to the Earth Information Jukebox. What should I call you?'

export const soundQuestion = (name: string) => `Great to meet you, ${name || 'Commander'}! What kind of sound vibe do you love listening to?`

/** The four sounds offered on the landing page. The ids are styles that already exist (src/sonify/presets.ts). */
export const TUNE_CHIPS = [
  { id: 'cinematic', label: 'Cinematic Orchestral' },
  { id: 'chiptune', label: '8-Bit Arcade' },
  { id: 'nature', label: 'Nature Ambient' },
  { id: 'bass', label: 'Heavy Bass' },
] as const
