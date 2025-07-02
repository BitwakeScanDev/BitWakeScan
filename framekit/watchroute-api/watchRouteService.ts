import { Connection, PublicKey, ConfirmedSignatureInfo } from "@solana/web3.js"

export interface RouteEvent {
  address: string
  signature: string
  timestamp: number
}

export class WatchRouteService {
  private conn: Connection

  constructor(rpcUrl: string) {
    this.conn = new Connection(rpcUrl, "confirmed")
  }

  async watch(addresses: string[], limit = 10): Promise<RouteEvent[]> {
    const events: RouteEvent[] = []
    for (const addr of addresses) {
      const key = new PublicKey(addr)
      const sigs: ConfirmedSignatureInfo[] = await this.conn.getSignaturesForAddress(key, { limit })
      sigs.forEach(s => {
        if (s.blockTime) {
          events.push({ address: addr, signature: s.signature, timestamp: s.blockTime * 1000 })
        }
      })
    }
    return events.sort((a, b) => a.timestamp - b.timestamp)
  }
}