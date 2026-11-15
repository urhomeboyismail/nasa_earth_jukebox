import { DiscSelector } from '../../components/jukebox/DiscSelector'
import type { OceanIndexEntry } from './schema'

const FAMILIES = ['ocean', 'atmosphere', 'forest'] as const

/** Chooses one track from a crate of records, each coloured by its category. Choosing never starts any sound. */
export function TrackPicker({ entries, value, onChange }: { entries: OceanIndexEntry[]; value: string; onChange: (id: string) => void }) {
  const catalog = entries.map(entry => ({ id: entry.dataset_id, title: entry.title, summary: entry.summary, family: FAMILIES.find(family => family === entry.category) }))
  return <DiscSelector catalog={catalog} value={value} onChange={onChange} label="Track" />
}
