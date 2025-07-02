
import { Connection, PublicKey, ParsedAccountData } from "@solana/web3.js"

export interface DepthMetrics {
  midPrice: number
  spreadPercent: number
  totalDepth: number
}

export class TokenDepth {
  private conn = new Connection(process.env.SOLANA_RPC_ENDPOINT!, "confirmed")

  async getDepth(mint: string, levels = 10): Promise<DepthMetrics> {
    const res = await fetch(`${process.env.DEX_API_URL}/markets/${mint}/orderbook?depth=${levels}`)
    if (!res.ok) throw new Error(res.statusText)
    const { bids, asks } = await res.json() as { bids: [number, number][]; asks: [number, number][] }

    const [bestBid] = bids[0] || [0, 0]
    const [bestAsk] = asks[0] || [0, 0]
    const mid = (bestBid + bestAsk) / 2
    const spread = bestAsk && bestBid ? ((bestAsk - bestBid) / mid) * 100 : 0

    const depth = [...bids, ...asks]
      .slice(0, levels)
      .reduce((sum, [price, size]) => sum + price * size, 0)

    return { midPrice: mid, spreadPercent: Number(spread.toFixed(2)), totalDepth: depth }
  }
}