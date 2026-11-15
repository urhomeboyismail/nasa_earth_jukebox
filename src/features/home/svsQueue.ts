import { z } from 'zod'

/** One NASA SVS visualization that is listed but not sonified yet (public/data/svs-queue.json). */
export const queueSchema = z.array(z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string(),
  family: z.enum(['ocean', 'atmosphere', 'forest']),
  url: z.url(),
  released: z.string(),
  soundIdea: z.string(),
}))

export type QueueEntry = z.infer<typeof queueSchema>[number]

/** The queue, or an empty list when it cannot be read: the shelf is extra and must never break Home. */
export async function loadQueue(): Promise<QueueEntry[]> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/svs-queue.json`)
    if (!response.ok) return []
    const parsed = queueSchema.safeParse(await response.json())
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}
