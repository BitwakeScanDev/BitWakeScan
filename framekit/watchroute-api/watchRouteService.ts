import { Connection, PublicKey, ConfirmedSignatureInfo } from "@solana/web3.js"

export interface RouteEvent {
  address: string
  signature: string
  timestamp: number
}

export class WatchRouteService {
  private readonly conn: Connection

  constructor(rpcUrl: string) {
    this.conn = new Connection(rpcUrl, "confirmed")
  }

  /**
   * Watches recent confirmed transactions for a list of addresses
   * and returns sorted RouteEvents.
   */
  async watch(addresses: string[], limit = 10): Promise<RouteEvent[]> {
    const events: RouteEvent[] = []

    for (const addr of addresses) {
      let key: PublicKey
      try {
        key = new PublicKey(addr)
      } catch {
        console.warn(`⚠️ Invalid address skipped: ${addr}`)
        continue
      }

      let sigs: ConfirmedSignatureInfo[] = []
      try {
        sigs = await this.conn.getSignaturesForAddress(key, { limit })
      } catch (err) {
        console.warn(`⚠️ Failed to fetch signatures for ${addr}: ${String(err)}`)
        continue
      }

      for (const s of sigs) {
        if (s.blockTime && s.signature) {
          events.push({
            address: addr,
            signature: s.signature,
            timestamp: s.blockTime * 1000
          })
        }
      }
    }

    return events.sort((a, b) => a.timestamp - b.timestamp)
  }
}
