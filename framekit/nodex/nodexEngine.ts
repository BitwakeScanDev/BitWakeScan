import fetch from "node-fetch"

export interface MarketTick {
  price: number
  size: number
}

export interface NodexMetrics {
  symbol: string
  vwap: number
  spread: number
}

export class NodexEngine {
  constructor(private apiUrl: string) {}

  private async fetchBook(symbol: string): Promise<{ bids: MarketTick[]; asks: MarketTick[] }> {
    const res = await fetch(`${this.apiUrl}/markets/${symbol}/orderbook?depth=20`)
    if (!res.ok) throw new Error(res.statusText)
    return (await res.json()) as any
  }

  private calculateVWAP(ticks: MarketTick[]): number {
    const pv = ticks.reduce((sum, t) => sum + t.price * t.size, 0)
    const vol = ticks.reduce((sum, t) => sum + t.size, 0)
    return vol ? pv / vol : 0
  }

  private calculateSpread(bids: MarketTick[], asks: MarketTick[]): number {
    const bestBid = bids[0]?.price ?? 0
    const bestAsk = asks[0]?.price ?? 0
    return bestAsk && bestBid ? (bestAsk - bestBid) / ((bestAsk + bestBid) / 2) : 0
  }

  async analyze(symbol: string): Promise<NodexMetrics> {
    const { bids, asks } = await this.fetchBook(symbol)
    return {
      symbol,
      vwap: this.calculateVWAP(bids.concat(asks)),
      spread: this.calculateSpread(bids, asks)
    }
  }
}