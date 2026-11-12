// Talks to the listening-test API (docs/PLAN.md §5.5).
//
// An answer is never dropped silently. If the network fails it stays queued in memory and is retried with a growing
// delay; if the server refuses it for good (for example a value it does not accept) it is kept in `rejected` and shown
// to the participant. Answers are sent one at a time, in the order they were given.

import { apiBase } from '../../config'
import { studyCreated } from '../../data'

export type Participant = 'sighted' | 'blind_low_vision' | 'not_said'

export type NewSession = { participant: Participant; screenReader: boolean; sawImages: boolean }

export type StudyAnswer = {
  comparisonId: string
  answer: 'a' | 'b' | 'same'
  correct: boolean
  responseMs: number
  confidence?: number
  comment?: string
}

export type StudyStatus = {
  /** Answers given so far. */
  total: number
  /** Answers the server has stored. */
  sent: number
  /** Answers still waiting to be sent, including while offline. */
  pending: number
  /** Answers the server refused, so retrying would not help. */
  rejected: number
  /** The last thing that went wrong, in words, while something is still pending. */
  problem: string
}

type Options = {
  fetch?: typeof fetch
  /** Delays before each retry, in milliseconds; the last one repeats. */
  retryDelaysMs?: number[]
}

/** The server said no and means it. Network errors, timeouts, 429 and 5xx are worth retrying; other 4xx are not. */
const isFinal = (status: number) => status >= 400 && status < 500 && status !== 408 && status !== 429

export class StudyClient {
  private readonly fetchFn: typeof fetch
  private readonly delays: number[]
  private readonly listeners = new Set<() => void>()
  private session: NewSession | null = null
  private sessionId: string | null = null
  private queue: StudyAnswer[] = []
  private sent = 0
  private rejected: StudyAnswer[] = []
  private problem = ''
  private total = 0
  private failures = 0
  private timer: ReturnType<typeof setTimeout> | undefined
  private busy: Promise<void> = Promise.resolve()
  private running = false
  /** Set when something asked for work while a run was already finishing, so that run goes round again. */
  private again = false
  private disposed = false

  constructor(options: Options = {}) {
    this.fetchFn = options.fetch ?? ((...args) => fetch(...args))
    this.delays = options.retryDelaysMs ?? [1000, 2000, 5000, 10000, 30000]
  }

  /** Begins a session. The participant has consented before this is called. */
  start(session: NewSession) {
    this.session = session
    void this.pump()
  }

  submit(answer: StudyAnswer) {
    this.total++
    this.queue.push(answer)
    this.notify()
    void this.pump()
  }

  get status(): StudyStatus {
    return { total: this.total, sent: this.sent, pending: this.queue.length, rejected: this.rejected.length, problem: this.problem }
  }

  /** Answers the server refused, so they can be shown or copied rather than lost. */
  get rejectedAnswers(): readonly StudyAnswer[] {
    return this.rejected
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** Try now instead of waiting for the next retry. */
  async flush() {
    window.clearTimeout(this.timer)
    await this.pump()
  }

  dispose() {
    this.disposed = true
    window.clearTimeout(this.timer)
    this.listeners.clear()
  }

  private notify() {
    this.listeners.forEach(listener => listener())
  }

  private pump(): Promise<void> {
    if (this.running) {
      this.again = true
      return this.busy
    }
    this.busy = this.run()
    return this.busy
  }

  private async run() {
    this.running = true
    try {
      do {
        this.again = false
        while (!this.disposed && this.session && (!this.sessionId || this.queue.length)) {
          const ok = this.sessionId ? await this.sendNext() : await this.createSession()
          if (!ok) {
            this.scheduleRetry()
            return
          }
          this.failures = 0
        }
      } while (this.again && !this.disposed)
      this.problem = ''
      this.notify()
    } finally {
      // Cleared in the same turn the work ends, so a request made right after cannot attach to a run that is over.
      this.running = false
    }
  }

  private url(path = '') {
    return `${apiBase()}/api/v1/tests${path}`
  }

  private fail(message: string) {
    this.problem = message
    this.notify()
    return false
  }

  /** Posts JSON; returns the response, or a short reason if the network failed. */
  private async post(url: string, body: unknown): Promise<Response | string> {
    try {
      return await this.fetchFn(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    } catch {
      return 'No connection to the server.'
    }
  }

  private async createSession(): Promise<boolean> {
    const result = await this.post(this.url(), { ...this.session, consent: true })
    if (typeof result === 'string') return this.fail(result)
    if (!result.ok) return this.fail(`The server could not start the test (error ${result.status}).`)
    let body: unknown
    try {
      body = await result.json()
    } catch {
      body = null
    }
    const parsed = studyCreated.safeParse(body)
    if (!parsed.success) return this.fail('The server sent an answer we could not read.')
    this.sessionId = parsed.data.id
    return true
  }

  private async sendNext(): Promise<boolean> {
    const answer = this.queue[0]
    const result = await this.post(this.url(`/${this.sessionId}/responses`), answer)
    if (typeof result === 'string') return this.fail(result)
    if (result.ok) {
      this.queue.shift()
      this.sent++
      this.notify()
      return true
    }
    if (result.status === 404) {
      // The server no longer knows this session (it was restarted with an empty database): start a new one and resend.
      this.sessionId = null
      return this.fail('The server lost this session; starting it again.')
    }
    if (isFinal(result.status)) {
      this.rejected.push(this.queue.shift()!)
      this.notify()
      return true
    }
    return this.fail(`The server could not save an answer (error ${result.status}).`)
  }

  private scheduleRetry() {
    if (this.disposed) return
    const delay = this.delays[Math.min(this.failures, this.delays.length - 1)]
    this.failures++
    window.clearTimeout(this.timer)
    this.timer = window.setTimeout(() => { void this.pump() }, delay)
  }
}
