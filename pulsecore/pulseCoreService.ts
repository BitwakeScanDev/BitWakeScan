import pLimit from "p-limit"
import {
  Connection,
  PublicKey,
  ConfirmedSignatureInfo,
  ParsedAccountData,
  ParsedInstruction,
  PartiallyDecodedInstruction,
} from "@solana/web3.js"

export interface PulsePoint {
  timestamp: number
  transfers: number
  totalSupply: number
}

export interface FetchOptions {
  /** How many signatures to fetch (default: 100) */
  limit?: number
  /** Max concurrent RPC calls when fetching transactions (default: 5) */
  concurrency?: number
}

export class PulseCoreService {
  private conn: Connection

  constructor(rpcUrl: string) {
    this.conn = new Connection(rpcUrl, "confirmed")
  }

  /**
   * Fetches PulsePoints for a given mint:
   *  - totalSupply fetched once via getTokenSupply
   *  - scans recent signatures up to `limit`
   *  - counts how many SPL-Token “transfer” instructions per tx
   */
  public async fetch(
    mint: string,
    opts: FetchOptions = {}
  ): Promise<PulsePoint[]> {
    const { limit = 100, concurrency = 5 } = opts

    // validate and build PublicKey
    let mintKey: PublicKey
    try {
      mintKey = new PublicKey(mint)
    } catch {
      throw new Error(`Invalid mint address: ${mint}`)
    }

    // 1) fetch total supply once
    let totalSupply = 0
    try {
      const supplyRes = await this.conn.getTokenSupply(mintKey)
      totalSupply = Number(supplyRes.value.uiAmount)
    } catch (err: any) {
      console.warn(`Failed to fetch token supply: ${err.message}`)
    }

    // 2) get recent signatures
    const sigs: ConfirmedSignatureInfo[] = await this.conn.getSignaturesForAddress(
      mintKey,
      { limit }
    )

    // 3) prepare concurrency limiter
    const limitRpc = pLimit(concurrency)
    const points: PulsePoint[] = []

    // 4) for each signature, fetch tx and count transfer instrs
    await Promise.all(
      sigs.map(({ signature, blockTime }) =>
        limitRpc(async () => {
          if (!blockTime) return

          try {
            const tx = await this.conn.getParsedConfirmedTransaction(signature)
            if (!tx) return

            // count transfer instructions (parsed or raw)
            const instrs: (ParsedInstruction | PartiallyDecodedInstruction)[] =
              tx.transaction.message.instructions
            const transfers = instrs.filter(instr => {
              // parsed SPL-token transfers have program === "spl-token" and parsed.type === "transfer"
              // fallback: check programId for SPL Token program
              const parsed = (instr as ParsedInstruction).parsed
              if (parsed && parsed.type === "transfer") {
                return (instr as ParsedInstruction).program === "spl-token"
              }
              return (
                (instr as PartiallyDecodedInstruction).programId.toBase58() ===
                "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
              )
            }).length

            points.push({
              timestamp: blockTime * 1000,
              transfers,
              totalSupply,
            })
          } catch (err: any) {
            console.warn(`Error processing ${signature}: ${err.message}`)
          }
        })
      )
    )

    // 5) sort by ascending timestamp
    return points.sort((a, b) => a.timestamp - b.timestamp)
  }
}
