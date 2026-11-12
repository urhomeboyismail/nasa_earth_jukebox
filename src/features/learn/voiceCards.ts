// What each voice of the ensemble tells the listener (docs/PLAN.md §6.3, ticket SN11), in plain words. No data-set words: the voices read any picture.

import { VOICE_IDS, type VoiceId } from '../../data'

export type VoiceTeaching = { name: string; means: string; listen: string }

export const VOICE_TEACHING: Record<VoiceId, VoiceTeaching> = {
  melody: {
    name: 'Melody',
    means: 'The overall level of the picture.',
    listen: 'The line goes up when the overall level goes up.',
  },
  harmony: {
    name: 'Harmony',
    means: 'How mixed the picture is.',
    listen: 'One note means one kind of value; more notes mean a mix.',
  },
  bass: {
    name: 'Bass',
    means: 'The shift from normal, or from the first date.',
    listen: 'Low notes are below, high notes above.',
  },
  hotspots: {
    name: 'Hot spots',
    means: 'Each area that stands out, as one voice.',
    listen: 'Higher notes are stronger areas; left and right show where they are.',
  },
  rhythm: {
    name: 'Rhythm',
    means: 'The edges: where the picture changes sharply.',
    listen: 'Busy notes mean a sharp boundary; calm notes mean a smooth field.',
  },
  motion: {
    name: 'Motion',
    means: 'How fast the picture moves, and which way.',
    listen: 'Open and bright is quick; a sweep to the right is eastward.',
  },
  time: {
    name: 'Time',
    means: 'Where you are in the dates.',
    listen: 'A pulse for each date; an accent when the month or the year changes.',
  },
}

/** The cards, in the order of the voices. */
export const VOICE_CARDS: (VoiceTeaching & { id: VoiceId })[] = VOICE_IDS.map(id => ({ id, ...VOICE_TEACHING[id] }))
