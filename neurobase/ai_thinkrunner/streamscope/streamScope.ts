import { Connection, PublicKey, ConfirmedSignatureInfo } from "@solana/web3.js"

export interface StreamPoint {
  timestamp: number
  transferCount: number
}

export class StreamScope {
  private conn: Connection

  constructor(rpcUrl: string) {
    this.conn = new Connection(rpcUrl, "confirmed")
  }

  async stream(mint: string, limit = 100): Promise<StreamPoint[]> {
    const key = new PublicKey(mint)
    const sigs: ConfirmedSignatureInfo[] = await this.conn.getSignaturesForAddress(key, { limit })
    return sigs
      .filter(s => s.blockTime)
      .map(s => ({ timestamp: s.blockTime! * 1000, transferCount: 1 }))
      .sort((a, b) => a.timestamp - b.timestamp)
  }
}
