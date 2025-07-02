
import { Connection, PublicKey, ConfirmedSignatureInfo } from "@solana/web3.js"

export interface TransferEvent {
  signature: string
  source: string
  destination: string
  amount: number
  timestamp: number
}

export class DetectionEyeService {
  private conn: Connection

  constructor(rpcUrl: string) {
    this.conn = new Connection(rpcUrl, "confirmed")
  }

  async fetchTransfers(mint: string, limit = 100): Promise<TransferEvent[]> {
    const key = new PublicKey(mint)
    const sigs = await this.conn.getSignaturesForAddress(key, { limit })
    const events: TransferEvent[] = []
    for (const { signature, blockTime } of sigs) {
      if (!blockTime) continue
      const tx = await this.conn.getParsedConfirmedTransaction(signature)
      if (!tx) continue
      for (const instr of tx.transaction.message.instructions as any[]) {
        if (instr.program === "spl-token" && instr.parsed?.type === "transfer") {
          const info = instr.parsed.info
          events.push({
            signature,
            source: info.source,
            destination: info.destination,
            amount: Number(info.amount),
            timestamp: blockTime * 1000
          })
        }
      }
    }
    return events
  }

  detectAnomalies(events: TransferEvent[], threshold = 1_000_000): TransferEvent[] {
    return events.filter(e => e.amount >= threshold)
  }
}
