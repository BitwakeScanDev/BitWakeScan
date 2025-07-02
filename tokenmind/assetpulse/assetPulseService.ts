import { Connection, PublicKey, ParsedAccountData, ConfirmedSignatureInfo } from "@solana/web3.js"

export interface PulsePoint {
  timestamp: number
  transferCount: number
  totalBalance: number
}

export class AssetPulseService {
  private conn: Connection

  constructor(rpcUrl: string) {
    this.conn = new Connection(rpcUrl, "confirmed")
  }

  async fetchPulse(mint: string, limit = 100): Promise<PulsePoint[]> {
    const key = new PublicKey(mint)
    const sigs: ConfirmedSignatureInfo[] = await this.conn.getSignaturesForAddress(key, { limit })
    const points: PulsePoint[] = []

    for (const { signature, blockTime } of sigs) {
      if (!blockTime) continue
      const [tx, accounts] = await Promise.all([
        this.conn.getParsedConfirmedTransaction(signature),
        this.conn.getParsedTokenAccountsByOwner(key, {
          programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
        })
      ])
      if (!tx) continue

      const transferCount = tx.transaction.message.instructions.filter(
        instr => (instr as any).program === "spl-token" && (instr as any).parsed?.type === "transfer"
      ).length

      const totalBalance = accounts.value.reduce((sum, acc) => {
        const info = (acc.account.data as ParsedAccountData).parsed.info.tokenAmount
        return sum + Number(info.uiAmount)
      }, 0)

      points.push({ timestamp: blockTime * 1000, transferCount, totalBalance })
    }

    return points.sort((a, b) => a.timestamp - b.timestamp)
  }
}
