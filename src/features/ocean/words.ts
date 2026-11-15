// What the ocean tracks' channels are called for each family of data. The tracks keep one set of channel names (sst, velocity, eddies); a
// track of weather borrows them, so the words the page says must follow the family (`metadata.category`), not the channel.

export type Words = { speed: string; swirl: string; none: string; against: string }

const OCEAN: Words = { speed: 'current speed', swirl: 'eddies', none: 'no ocean here, silent', against: "the year's mean" }
const ATMOSPHERE: Words = { speed: 'wind speed', swirl: 'rain', none: 'no reading here, silent', against: "the track's mean" }

export const wordsFor = (category: string | undefined): Words => (category === 'atmosphere' ? ATMOSPHERE : OCEAN)

export const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west']

/** A turn (0 to 1, 0 from the north) as the nearest of the eight compass points. */
export const compassFor = (turn: number) => COMPASS[Math.round((((turn % 1) + 1) % 1) * 8) % 8]
