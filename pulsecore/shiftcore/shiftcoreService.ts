import { Connection, PublicKey, ConfirmedSignatureInfo, ParsedConfirmedTransaction } from "@solana/web3.js"

export interface TransferRecord {
  signature: string
  from: string
  to: string
  amount: number
  timestamp: number
}

export class ShiftcoreService {
  private conn: Connection

  constructor(rpcUrl: string) {
    this.conn = new Connection(rpcUrl, "confirmed")
  }

  async fetchTransfers(mint: string, limit = 100): Promise<TransferRecord[]> {
    const key = new PublicKey(mint)
    const sigs = await this.conn.getSignaturesForAddress(key, { limit })
    const records: TransferRecord[] = []

    for (const { signature, blockTime } of sigs) {
      if (!blockTime) continue
      const tx = await this.conn.getParsedConfirmedTransaction(signature)
      if (!tx) continue
      for (const instr of tx.transaction.message.instructions as any[]) {
        if (instr.program === "spl-token" && instr.parsed?.type === "transfer") {
          const info = instr.parsed.info
          records.push({
            signature,
            from: info.source,
            to: info.destination,
            amount: Number(info.amount),
            timestamp: blockTime * 1000
          })
        }
      }
    }

    return records
  }
}
