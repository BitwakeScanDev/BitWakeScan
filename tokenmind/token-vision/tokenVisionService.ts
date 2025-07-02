import { Connection, PublicKey, ParsedAccountData, ConfirmedSignatureInfo } from "@solana/web3.js"

export interface RawPoint {
  timestamp: number
  transfers: number
  supply: number
}

export class TokenVisionService {
  private conn: Connection

  constructor(rpcUrl: string) {
    this.conn = new Connection(rpcUrl, "confirmed")
  }

  async fetchRawData(mint: string, limit = 100): Promise<RawPoint[]> {
    const key = new PublicKey(mint)
    const sigs: ConfirmedSignatureInfo[] = await this.conn.getSignaturesForAddress(key, { limit })
    const series: RawPoint[] = []
    for (const { signature, blockTime } of sigs) {
      if (!blockTime) continue
      const tx = await this.conn.getParsedConfirmedTransaction(signature)
      if (!tx) continue
      const accounts = await this.conn.getParsedTokenAccountsByOwner(key, {
        programId: new PublicKey()
      })
      const supply = accounts.value.reduce((sum, acc) => {
        const info = (acc.account.data as ParsedAccountData).parsed.info.tokenAmount
        return sum + Number(info.uiAmount)
      }, 0)
      series.push({
        timestamp: blockTime * 1000,
        transfers: tx.transaction.message.instructions.length,
        supply
      })
    }
    return series.sort((a, b) => a.timestamp - b.timestamp)
  }
}
