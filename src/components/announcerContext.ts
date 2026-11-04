import { createContext } from 'react'

export type Announce = (text: string) => void

export const AnnouncerContext = createContext<Announce>(() => {})
