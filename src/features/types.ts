import type { Visualization } from '../data'

/** Props every page receives from App. `visualization` is null while loading or if loading failed. */
export type PageProps = { visualization: Visualization | null }
