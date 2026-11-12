// The Ask panel's one call to the server's agent (G02), for a question the offline matcher cannot answer. The agent may only choose
// from the facts the browser sent: the panel rebuilds the answer from those facts, so the server's words are never shown. Every
// failure (no server, a 404 on the static site, a slow or wrong answer) gives null, and the panel falls back to the offline answer.

import { z } from 'zod'
import { apiBase } from '../../config'
import { toAssistantAction, type AssistantAction } from '../../hooks/useVoiceAssistant'
import type { Fact } from './facts'

export type AgentAnswer = { factIds: string[]; confidence: 'high' | 'medium' | 'low' | 'none'; action: AssistantAction | null }

/** After this long the panel says "Working…". */
export const WORKING_AFTER_MS = 1000
/** After this long the request is dropped and the offline answer is shown. */
export const AGENT_TIMEOUT_MS = 2500

const PATH = '/api/v1/agent/ask'

const answerSchema = z.object({
  factIds: z.array(z.string()),
  confidence: z.enum(['high', 'medium', 'low', 'none']),
  action: z.object({
    kind: z.enum(['navigate', 'set_date']),
    page: z.string().nullish(),
    date: z.string().nullish(),
  }).nullish(),
})

/** The server's action, checked with the voice guide's allow-list. A date must also be one of the data set's own dates. */
function toAction(action: z.infer<typeof answerSchema>['action'], knownDates: string[]): AssistantAction | null {
  if (action?.kind === 'navigate' && action.page) return toAssistantAction({ action: 'navigate', page: action.page })
  if (action?.kind === 'set_date' && action.date && knownDates.includes(action.date)) {
    return toAssistantAction({ action: 'player', command: { setDate: action.date } })
  }
  return null
}

/** The agent's chosen facts, or null when the agent cannot answer in time. Never throws. */
export async function askAgent(
  input: { question: string; facts: Fact[]; knownDates: string[] },
  options: { onSlow: () => void; signal?: AbortSignal },
): Promise<AgentAnswer | null> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (options.signal?.aborted) return null
  options.signal?.addEventListener('abort', abort)
  const slow = setTimeout(() => options.onSlow(), WORKING_AFTER_MS)
  const timeout = setTimeout(abort, AGENT_TIMEOUT_MS)
  try {
    const response = await fetch(`${apiBase()}${PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: input.question,
        facts: input.facts.map(({ id, kind, text }) => ({ id, kind, text })),
        knownDates: input.knownDates,
      }),
      signal: controller.signal,
    })
    if (response.status !== 200) return null
    const parsed = answerSchema.safeParse(await response.json())
    if (!parsed.success) return null
    const sent = new Set(input.facts.map(fact => fact.id))
    const factIds = [...new Set(parsed.data.factIds)].filter(id => sent.has(id))
    if (!factIds.length) return { factIds: [], confidence: 'none', action: null }
    return { factIds, confidence: parsed.data.confidence, action: toAction(parsed.data.action, input.knownDates) }
  } catch {
    return null
  } finally {
    clearTimeout(slow)
    clearTimeout(timeout)
    options.signal?.removeEventListener('abort', abort)
  }
}
