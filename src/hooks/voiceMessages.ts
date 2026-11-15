// The messages the voice guide's server sends over the WebSocket (server/app/api/assistant.py). They come from a model's server,
// so each one is checked here before the page uses it. Anything that does not fit is dropped, never guessed at.

import { z } from 'zod'
import type { PlayerCommand } from '../features/player/controls'

/** A real calendar date written YYYY-MM-DD. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

/** One of the six words, or an object with nothing but a real date. */
export const playerCommandSchema: z.ZodType<PlayerCommand> = z.union([
  z.enum(['play', 'pause', 'stop', 'replay', 'next', 'previous']),
  z.strictObject({ setDate: z.string().refine(isIsoDate, 'not a calendar date') }),
])

const messageSchema = z.discriminatedUnion('type', [
  // A limit that is not a positive number is ignored, not a reason to lose the message.
  z.object({ type: z.literal('ready'), limitSeconds: z.number().finite().positive().optional().catch(undefined) }),
  z.object({ type: z.literal('transcript'), role: z.enum(['user', 'assistant']), text: z.string() }),
  z.object({ type: z.literal('interrupted') }),
  z.object({ type: z.literal('turn_complete') }),
  // The action's own allow-list (toAssistantAction, or parseMascotAnswer for live_data) still runs on these: it is the browser's
  // second check. Loose, so live_data's answer fields reach that check.
  z.looseObject({ type: z.literal('action'), action: z.string(), page: z.unknown().optional(), command: z.unknown().optional(), target: z.unknown().optional() }),
  z.object({ type: z.literal('error'), code: z.string(), message: z.string() }),
  z.object({ type: z.literal('ended'), reason: z.string() }),
])

export type ServerMessage = z.infer<typeof messageSchema>

/** The message in a text frame, or null for invalid JSON, an unknown type or a shape that does not fit. */
export function parseServerMessage(text: string): ServerMessage | null {
  let value: unknown
  try { value = JSON.parse(text) } catch { return null }
  const parsed = messageSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}
