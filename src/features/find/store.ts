// The find game's best scores, kept on this device (ticket IX04) under one key, read through zod. Blocked or broken storage gives an empty record.

import { z } from 'zod'

export const FIND_KEY = 'earth-jukebox:find'

const bestSchema = z.object({ score: z.number().int().nonnegative(), seconds: z.number().nonnegative() })
const recordSchema = z.object({ best: z.record(z.string(), bestSchema) })

export type Best = z.infer<typeof bestSchema>
export type FindRecord = z.infer<typeof recordSchema>

/** The key of one data set at one level: "<dataId>:<level>". */
export const bestKey = (dataId: string, level: number) => `${dataId}:${level}`

export function readFindRecord(): FindRecord {
  try {
    const raw = localStorage.getItem(FIND_KEY)
    if (raw === null) return { best: {} }
    const parsed = recordSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : { best: {} }
  } catch {
    return { best: {} }
  }
}

/** Whether `next` beats `best`: a higher score, or the same score in less time. */
export const beats = (next: Best, best: Best | undefined) => !best || next.score > best.score || (next.score === best.score && next.seconds < best.seconds)

/** Keeps `result` as the best for `key` if it beats the one kept. Returns the best now kept. Not kept for next time when storage is blocked. */
export function saveResult(key: string, result: Best): Best {
  const record = readFindRecord()
  const kept = record.best[key]
  if (kept && !beats(result, kept)) return kept
  record.best[key] = result
  try {
    localStorage.setItem(FIND_KEY, JSON.stringify(record))
  } catch {
    // Blocked: the result still counts for this game.
  }
  return result
}
