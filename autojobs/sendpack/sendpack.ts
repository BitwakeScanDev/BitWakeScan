// SendPack.ts

import fetch, { Response } from "node-fetch"
import { z } from "zod"

export interface Packet {
  id: string
  timestamp: number
  payload: Record<string, unknown>
}

export interface SendResult {
  success: boolean
  status: number
  responseBody?: unknown
  error?: string
  attempts: number
}

/**
 * Zod schema for Packet validation
 */
const PacketSchema = z.object({
  id: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
  payload: z.record(z.unknown()),
})

const DEFAULT_RETRIES = 2
const DEFAULT_TIMEOUT_MS = 5000

export class SendPack {
  private retries: number
  private timeoutMs: number

  constructor(
    private endpoint: string,
    options?: { retries?: number; timeoutMs?: number }
  ) {
    if (!endpoint) {
      throw new Error("Endpoint URL is required")
    }
    this.retries = options?.retries ?? DEFAULT_RETRIES
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  /**
   * Validate packet structure, throws if invalid
   */
  private validatePacket(packet: unknown): asserts packet is Packet {
    const result = PacketSchema.safeParse(packet)
    if (!result.success) {
      const issues = result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`)
      throw new Error(`Invalid packet: ${issues.join("; ")}`)
    }
  }

  /**
   * Send packet with retries and timeout
   */
  public async send(packet: Packet): Promise<SendResult> {
    this.validatePacket(packet)
    let attempt = 0
    let lastError: string | undefined
    let lastStatus = 0
    let lastBody: unknown

    while (attempt <= this.retries) {
      attempt++
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), this.timeoutMs)
        const res: Response = await fetch(this.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(packet),
          signal: controller.signal,
        })
        clearTimeout(timer)
        lastStatus = res.status
        const body = await res.json().catch(() => undefined)
        lastBody = body
        if (res.ok) {
          return {
            success: true,
            status: res.status,
            responseBody: body,
            attempts: attempt,
          }
        } else {
          lastError = `HTTP ${res.status}`
          if (res.status >= 500 && attempt <= this.retries) {
            continue
          }
          break
        }
      } catch (err: any) {
        lastError = err.name === "AbortError" ? `Timeout after ${this.timeoutMs}ms` : err.message
        if (attempt > this.retries) {
          break
        }
        await new Promise(r => setTimeout(r, 2 ** attempt * 100))
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

  /**
   * Create a new packet with current timestamp
   */
  public create(id: string, payload: Record<string, unknown>): Packet {
    return { id, timestamp: Date.now(), payload }
  }
}
