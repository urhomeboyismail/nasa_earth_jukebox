// The nine compass places Echo can always point at (ticket IX09), on their own so the voice guide's allow-list (loaded with the app) pulls in nothing else.
// The server has the same list (server/app/assistant/tools.py, COMPASS_PLACES).

/** The nine thirds of the map, row by row from the north-west. */
export const COMPASS_PLACES = ['north-west', 'north', 'north-east', 'west', 'centre', 'east', 'south-west', 'south', 'south-east'] as const
export type CompassPlace = (typeof COMPASS_PLACES)[number]

export const isCompassPlace = (target: string): target is CompassPlace => COMPASS_PLACES.some(place => place === target)
