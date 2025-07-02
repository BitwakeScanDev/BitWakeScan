import fetch from "node-fetch"

interface Order { price: number; size: number }
interface Book { bids: Order[]; asks: Order[] }
interface SpreadResult { symbol: string; spread: number; midPrice: number }
interface ArbPair { base: string; quote: string; diff: number }

export class DexLogic {
  constructor(private apiBase: string) {}

  private async fetchBook(symbol: string, depth = 50): Promise<Book> {
    const res = await fetch(`${this.apiBase}/markets/${symbol}/orderbook?depth=${depth}`)
    if (!res.ok) throw new Error(res.statusText)
    return res.json()
  }

  private vwap(side: Order[]): number {
    const pv = side.reduce((s, o) => s + o.price * o.size, 0)
    const vol = side.reduce((s, o) => s + o.size, 0)
    return vol ? pv / vol : 0
  }

  async computeSpread(symbol: string): Promise<SpreadResult> {
    const { bids, asks } = await this.fetchBook(symbol)
    const bestBid = bids[0]?.price || 0
    const bestAsk = asks[0]?.price || 0
    const mid = (bestBid + bestAsk) / 2
    const spread = bestAsk && bestBid ? (bestAsk - bestBid) / mid : 0
    return { symbol, spread, midPrice: mid }
  }

  async detectArbitrage(pairs: [string, string][]): Promise<ArbPair[]> {
    const results: ArbPair[] = []
    for (const [a, b] of pairs) {
      const [sa, sb] = await Promise.all([this.computeSpread(a), this.computeSpread(b)])
      const diff = sa.midPrice - sb.midPrice
      results.push({ base: a, quote: b, diff })
    }
    return results.sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff))
  }
}
