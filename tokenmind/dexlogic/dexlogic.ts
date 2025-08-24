import fetch from "node-fetch"

interface Order { price: number; size: number }
interface Book { bids: Order[]; asks: Order[] }
interface SpreadResult {
  symbol: string
  bestBid: number
  bestAsk: number
  vwapBid: number
  vwapAsk: number
  midPrice: number
  spreadAbs: number
  spreadPct: number
  timestamp: string
}
interface ArbPair {
  base: string
  quote: string
  baseMid: number
  quoteMid: number
  diffAbs: number
  diffPct: number
  timestamp: string
}

export class DexLogic {
  constructor(private apiBase: string) {}

  private async fetchBook(symbol: string, depth = 50): Promise<Book> {
    const res = await fetch(`${this.apiBase}/markets/${symbol}/orderbook?depth=${depth}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    const data = await res.json()
    return {
      bids: Array.isArray(data?.bids) ? data.bids : [],
      asks: Array.isArray(data?.asks) ? data.asks : [],
    }
  }

  private vwap(side: Order[]): number {
    let pv = 0
    let vol = 0
    for (const o of side) {
      if (o.price > 0 && o.size > 0) {
        pv += o.price * o.size
        vol += o.size
      }
    }
    return vol > 0 ? pv / vol : 0
  }

  async computeSpread(symbol: string): Promise<SpreadResult> {
    const { bids, asks } = await this.fetchBook(symbol)
    const bestBid = bids[0]?.price ?? 0
    const bestAsk = asks[0]?.price ?? 0
    const vwapBid = this.vwap(bids)
    const vwapAsk = this.vwap(asks)

    const mid = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : (vwapBid && vwapAsk ? (vwapBid + vwapAsk) / 2 : 0)
    const spreadAbs = bestAsk && bestBid ? bestAsk - bestBid : 0
    const spreadPct = mid > 0 ? spreadAbs / mid : 0

    return {
      symbol,
      bestBid,
      bestAsk,
      vwapBid,
      vwapAsk,
      midPrice: mid,
      spreadAbs,
      spreadPct,
      timestamp: new Date().toISOString(),
    }
  }

  async detectArbitrage(pairs: [string, string][]): Promise<ArbPair[]> {
    const results: ArbPair[] = []
    for (const [a, b] of pairs) {
      try {
        const [sa, sb] = await Promise.all([this.computeSpread(a), this.computeSpread(b)])
        const diffAbs = sa.midPrice - sb.midPrice
        const denom = (sa.midPrice + sb.midPrice) / 2 || 1
        const diffPct = diffAbs / denom
        results.push({
          base: a,
          quote: b,
          baseMid: sa.midPrice,
          quoteMid: sb.midPrice,
          diffAbs,
          diffPct,
          timestamp: new Date().toISOString(),
        })
      } catch (e: any) {
        results.push({
          base: a,
          quote: b,
          baseMid: 0,
          quoteMid: 0,
          diffAbs: 0,
          diffPct: 0,
          timestamp: new Date().toISOString(),
        })
      }
    }
    return results.sort((x, y) => Math.abs(y.diffPct) - Math.abs(x.diffPct))
  }
}
