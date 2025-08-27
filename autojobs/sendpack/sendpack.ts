// SendPack.ts (improved)

import fetch, { Response, HeadersInit } from "node-fetch"
import { z } from "zod"

/** Packet payload */
export interface Packet {
  id: string
  timestamp: number
  payload: Record<string, unknown>
}

/** Send outcome */
export interface SendResult {
  success: boolean
  status: number
  responseBody?: unknown
  error?: string
  attempts: number
}

/** Zod schema for Packet validation */
const PacketSchema = z.object({
  id: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
  payload: z.record(z.unknown()),
})

/** Options for SendPack */
export interface SendPackOptions {
  retries?: number
  timeoutMs?: number
  headers?: Record<string, string>
  /** Linear backoff base; attempt N waits N * retryDelayMs */
  retryDelayMs?: number
  /** Optional idempotency key header value */
  idempotencyKey?: string
  /** Custom user agent header */
  userAgent?: string
}

const DEFAULT_RETRIES = 2
const DEFAULT_TIMEOUT_MS = 5_000
const DEFAULT_RETRY_DELAY_MS = 300

export class SendPack {
  private readonly retries: number
  private readonly timeoutMs: number
  private readonly retryDelayMs: number
  private readonly headers: Record<string, string>
  private readonly idempotencyKey?: string

  constructor(private readonly endpoint: string, options: SendPackOptions = {}) {
    if (!endpoint) throw new Error("Endpoint URL is required")
    // Validate URL shape early
    try { new URL(endpoint) } catch { throw new Error(`Invalid endpoint URL: ${endpoint}`) }

    this.retries = Number.isInteger(options.retries) && options.retries! >= 0 ? options.retries! : DEFAULT_RETRIES
    this.timeoutMs = Number.isInteger(options.timeoutMs) && options.timeoutMs! > 0 ? options.timeoutMs! : DEFAULT_TIMEOUT_MS
    this.retryDelayMs = Number.isInteger(options.retryDelayMs) && options.retryDelayMs! >= 0 ? options.retryDelayMs! : DEFAULT_RETRY_DELAY_MS
    this.idempotencyKey = options.idempotencyKey

    this.headers = {
      "Content-Type": "application/json",
      ...(options.userAgent ? { "User-Agent": options.userAgent } : {}),
      ...(this.idempotencyKey ? { "Idempotency-Key": this.idempotencyKey } : {}),
      ...(options.headers ?? {}),
    }
  }

  /** Validate packet structure, throws if invalid */
  private validatePacket(packet: unknown): asserts packet is Packet {
    const result = PacketSchema.safeParse(packet)
    if (!result.success) {
      const issues = result.error.issues.map(i => `${i.path.join(".") || "(root)"}: ${i.message}`)
      throw new Error(`Invalid packet: ${issues.join("; ")}`)
    }
  }

  /** Abortable fetch helper with timeout */
  private async fetchWithTimeout(initBody: string): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      return await fetch(this.endpoint, {
        method: "POST",
        headers: this.headers as HeadersInit,
        body: initBody,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }
  }

  /** Parse JSON if possible, otherwise return text or undefined */
  private async parseResponseBody(res: Response): Promise<unknown> {
    const ct = res.headers.get("content-type") || ""
    if (ct.includes("application/json")) {
      try {
        return await res.json()
      } catch {
        // fall through to text
      }
    }
    try {
      const txt = await res.text()
      return txt.length ? txt : undefined
    } catch {
      return undefined
    }
  }

  /** Retry rule: 408, 425, 429, and all 5xx are retryable */
  private isRetryableStatus(status: number): boolean {
    return status === 408 || status === 425 || status === 429 || status >= 500
  }

  /** Deterministic linear backoff (no randomness) */
  private async backoff(attempt: number, retryAfterHeader?: string | null): Promise<void> {
    const retryAfter = Number(retryAfterHeader)
    const ms = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.round(retryAfter * 1000)
      : this.retryDelayMs * attempt
    await new Promise(res => setTimeout(res, ms))
  }

  /**
   * Send packet with validation, retries, timeout, and robust body parsing
   */
  public async send(packet: Packet): Promise<SendResult> {
    this.validatePacket(packet)

    const body = JSON.stringify(packet)
    let attempt = 0
    let lastStatus = 0
    let lastError: string | undefined
    let lastBody: unknown

    while (attempt <= this.retries) {
      attempt++
      try {
        const res = await this.fetchWithTimeout(body)
        lastStatus = res.status
        lastBody = await this.parseResponseBody(res)

        if (res.ok) {
          return { success: true, status: res.status, responseBody: lastBody, attempts: attempt }
        }

        lastError = `HTTP ${res.status}${lastBody ? `: ${typeof lastBody === "string" ? lastBody : JSON.stringify(lastBody)}` : ""}`
        if (!this.isRetryableStatus(res.status) || attempt > this.retries) {
          break
        }
        await this.backoff(attempt, res.headers.get("retry-after"))
      } catch (err: any) {
        lastError = err?.name === "AbortError" ? `Timeout after ${this.timeoutMs}ms` : (err?.message ?? String(err))
        if (attempt > this.retries) break
        await this.backoff(attempt)
      }
    }

    return {
      success: false,
      status: lastStatus,
      responseBody: lastBody,
      error: lastError,
      attempts: attempt,
    }
  }

  /** Create a new packet with current timestamp */
  public create(id: string, payload: Record<string, unknown>): Packet {
    return { id, timestamp: Date.now(), payload }
  }
}
