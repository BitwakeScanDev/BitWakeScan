import { Connection, PublicKey, ConfirmedSignatureInfo, ParsedAccountData } from "@solana/web3.js"

export interface PulsePoint {
  timestamp: number
  transfers: number
  totalSupply: number
}

export class PulseCoreService {
  private conn: Connection

  constructor(rpcUrl: string) {
    this.conn = new Connection(rpcUrl, "confirmed")
  }

  async fetch(mint: string, limit = 100): Promise<PulsePoint[]> {
    const key = new PublicKey(mint)
    const sigs: ConfirmedSignatureInfo[] = await this.conn.getSignaturesForAddress(key, { limit })
    const points: PulsePoint[] = []

    for (const { signature, blockTime } of sigs) {
      if (!blockTime) continue
      const tx = await this.conn.getParsedConfirmedTransaction(signature)
      if (!tx) continue

      const accounts = await this.conn.getParsedTokenAccountsByOwner(key, {
        programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
      })
      const supply = accounts.value.reduce((sum, acc) => {
        const info = (acc.account.data as ParsedAccountData).parsed.info.tokenAmount
        return sum + Number(info.uiAmount)
      }, 0)

      const transfers = tx.transaction.message.instructions.filter(
        instr => (instr as any).program === "spl-token" && (instr as any).parsed?.type === "transfer"
      ).length

      points.push({ timestamp: blockTime * 1000, transfers, totalSupply: supply })
    }

    return points.sort((a, b) => a.timestamp - b.timestamp)
  }
}
