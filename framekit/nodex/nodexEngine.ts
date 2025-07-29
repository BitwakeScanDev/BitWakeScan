import fetch, { RequestInit } from "node-fetch"

export interface MarketTick {
  price: number
  size: number
}

export interface NodexMetrics {
  symbol: string
  vwap: number
  spread: number
}

/**
 * Configuration options for NodexEngine
 */
export interface NodexEngineOptions {
  depth?: number       // orderbook depth (default: 20)
  timeoutMs?: number   // per-request timeout (default: 5000)
  retryCount?: number  // number of fetch retries (default: 2)
  concurrency?: number // parallel symbol analysis (default: 5)
}

export class NodexEngine {
  private depth: number
  private timeoutMs: number
  private retryCount: number
  private concurrency: number

  constructor(
    private apiUrl: string,
    opts: NodexEngineOptions = {}
  ) {
    this.depth = opts.depth ?? 20
    this.timeoutMs = opts.timeoutMs ?? 5000
    this.retryCount = opts.retryCount ?? 2
    this.concurrency = opts.concurrency ?? 5
  }

  /** Utility to perform fetch with timeout and retries */
  private async fetchWithTimeout<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    for (let attempt = 0; attempt <= this.retryCount; attempt++) {
      const controller = new AbortController()
      const id = setTimeout(() => controller.abort(), this.timeoutMs)
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          ...options,
        })
        clearTimeout(id)
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`)
        }
        return (await res.json()) as T
      } catch (err) {
        clearTimeout(id)
        if (attempt === this.retryCount) {
          throw err
        }
        // small backoff
        await new Promise((r) => setTimeout(r, 100 * (attempt + 1)))
      }
    }
    // unreachable
    throw new Error("Failed to fetch after retries")
  }

  /** Fetch orderbook for a given symbol */
  private async fetchBook(symbol: string): Promise<{ bids: MarketTick[]; asks: MarketTick[] }> {
    const url = `${this.apiUrl}/markets/${symbol}/orderbook?depth=${this.depth}`
    return this.fetchWithTimeout<{ bids: MarketTick[]; asks: MarketTick[] }>(url)
  }

  /** Compute volume-weighted average price */
  private calculateVWAP(ticks: MarketTick[]): number {
    let pv = 0, vol = 0
    for (const { price, size } of ticks) {
      pv += price * size
      vol += size
    }
    return vol > 0 ? pv / vol : 0
  }

  /** Compute normalized spread between best bid & ask */
  private calculateSpread(bids: MarketTick[], asks: MarketTick[]): number {
    const bestBid = bids[0]?.price ?? 0
    const bestAsk = asks[0]?.price ?? 0
    if (bestBid <= 0 || bestAsk <= 0) return 0
    return (bestAsk - bestBid) / ((bestAsk + bestBid) / 2)
  }

  /**
   * Analyze a single symbol: fetch orderbook, compute VWAP & spread
   */
  public async analyze(symbol: string): Promise<NodexMetrics> {
    const { bids, asks } = await this.fetchBook(symbol)
    const combined = bids.concat(asks)
    return {
      symbol,
      vwap: this.calculateVWAP(combined),
      spread: this.calculateSpread(bids, asks),
    }
  }

  /**
   * Analyze multiple symbols in parallel with limited concurrency
   */
  public async analyzeBatch(symbols: string[]): Promise<NodexMetrics[]> {
    const results: NodexMetrics[] = []
    const queue = [...symbols]
    const worker = async () => {
      while (queue.length) {
        const sym = queue.shift()!
        try {
          const metrics = await this.analyze(sym)
          results.push(metrics)
        } catch (err) {
          console.warn(`Failed to analyze ${sym}:`, err)
        }
      }
    }
    const workers = Array.from({ length: this.concurrency }, () => worker())
    await Promise.all(workers)
    return results
  }
}
