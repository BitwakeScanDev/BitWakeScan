import pLimit from "p-limit"
import {
  Connection,
  PublicKey,
  ConfirmedSignatureInfo,
  ParsedInstruction,
  PartiallyDecodedInstruction,
  ParsedTransactionWithMeta,
  Commitment,
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
  /** Include inner instructions (default: true) */
  includeInner?: boolean
  /** Commitment level (default: "confirmed") */
  commitment?: Commitment
}

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
)

type AnyInstr = ParsedInstruction | PartiallyDecodedInstruction

export class PulseCoreService {
  private conn: Connection

  constructor(rpcUrl: string, commitment: Commitment = "confirmed") {
    this.conn = new Connection(rpcUrl, commitment)
  }

  /**
   * Fetches PulsePoints for a given mint:
   *  - totalSupply fetched once via getTokenSupply
   *  - scans recent signatures up to `limit`
   *  - counts SPL Token transfers for THIS mint across top-level & (optionally) inner instructions
   */
  public async fetch(
    mint: string,
    opts: FetchOptions = {}
  ): Promise<PulsePoint[]> {
    const {
      limit = 100,
      concurrency = 5,
      includeInner = true,
      commitment = "confirmed",
    } = opts

    // 0) validate and build PublicKey
    let mintKey: PublicKey
    try {
      mintKey = new PublicKey(mint)
    } catch {
      throw new Error(`Invalid mint address: ${mint}`)
    }

    // 1) total supply (prefer uiAmount for safe JS number)
    let totalSupply = 0
    try {
      const supplyRes = await this.conn.getTokenSupply(mintKey, commitment)
      // uiAmount can be null for very small tokens; fall back to decimals math
      if (supplyRes.value.uiAmount != null) {
        totalSupply = Number(supplyRes.value.uiAmount)
      } else {
        const amount = Number(supplyRes.value.amount) // string
        const decimals = supplyRes.value.decimals
        totalSupply = amount / Math.pow(10, decimals)
      }
    } catch (err: any) {
      console.warn(`[PulseCore] Failed to fetch token supply: ${err?.message ?? err}`)
    }

    // 2) get recent signatures that touched the mint account
    const sigs: ConfirmedSignatureInfo[] = await this.conn.getSignaturesForAddress(
      mintKey,
      { limit },
      commitment
    )

    if (sigs.length === 0) return []

    // 3) concurrency limiter
    const limitRpc = pLimit(Math.max(1, concurrency))
    const points: PulsePoint[] = []

    // 4) fetch each tx, count transfers for THIS mint
    await Promise.all(
      sigs.map(({ signature, blockTime }) =>
        limitRpc(async () => {
          if (!blockTime) return
          try {
            const tx = (await this.conn.getParsedTransaction(signature, {
              commitment,
              maxSupportedTransactionVersion: 0,
            })) as ParsedTransactionWithMeta | null
            if (!tx) return

            const transfers = this.countMintTransfers(tx, mintKey, includeInner)
            points.push({
              timestamp: blockTime * 1000,
              transfers,
              totalSupply,
            })
          } catch (err: any) {
            console.warn(`[PulseCore] Error processing ${signature}: ${err?.message ?? err}`)
          }
        })
      )
    )

    // 5) sort ASC by timestamp
    return points.sort((a, b) => a.timestamp - b.timestamp)
  }

  /** Count number of SPL-Token transfer instructions for the given mint within a parsed tx */
  private countMintTransfers(
    tx: ParsedTransactionWithMeta,
    mintKey: PublicKey,
    includeInner: boolean
  ): number {
    const message = tx.transaction.message as any
    const meta = tx.meta

    // Build a set of account addresses that are token accounts for this mint (from pre/post balances)
    const mintB58 = mintKey.toBase58()
    const accountKeys: string[] = (message.accountKeys || []).map((k: any) =>
      typeof k === "string" ? k : k.pubkey?.toString?.() ?? k.pubkey?.toBase58?.()
    )
    const idxToAddr = (i: number) => accountKeys[i]

    const mintTokenAccounts = new Set<string>()
    const collect = (balances?: Array<{ accountIndex: number; mint: string }>) => {
      if (!balances) return
      for (const b of balances) {
        if (b?.mint === mintB58) {
          const addr = idxToAddr(b.accountIndex)
          if (addr) mintTokenAccounts.add(addr)
        }
      }
    }
    collect(meta?.preTokenBalances as any)
    collect(meta?.postTokenBalances as any)

    // Helper: does instruction touch any known token account of our mint?
    const touchesMintAccount = (ix: AnyInstr): boolean => {
      const accs =
        "accounts" in ix
          ? (ix.accounts as (string | PublicKey)[]).map(a =>
              typeof a === "string" ? a : a.toBase58()
            )
          : []
      return accs.some(a => mintTokenAccounts.has(a))
    }

    // Check if a parsed token instruction is a transfer for our mint
    const isParsedMintTransfer = (ix: ParsedInstruction): boolean => {
      if (ix.program !== "spl-token" || !ix.parsed) return false
      const t = (ix.parsed as any).type
      if (!t || !String(t).toLowerCase().startsWith("transfer")) return false
      const info = (ix.parsed as any).info || {}
      // transferChecked usually includes mint; legacy transfer might not
      if (info.mint) {
        return info.mint === mintB58
      }
      // Fallback: intersect accounts with our mint token accounts
      return touchesMintAccount(ix)
    }

    const isRawTokenProg = (ix: AnyInstr): boolean =>
      "programId" in ix && (ix.programId as PublicKey).equals(TOKEN_PROGRAM_ID)

    const countInList = (list: AnyInstr[]): number =>
      list.reduce((n, ix) => {
        if ("parsed" in ix && isParsedMintTransfer(ix as ParsedInstruction)) return n + 1
        if (!("parsed" in ix) && isRawTokenProg(ix) && touchesMintAccount(ix)) return n + 1
        return n
      }, 0)

    let count = 0
    const topLevel = (message.instructions || []) as AnyInstr[]
    count += countInList(topLevel)

    if (includeInner && meta?.innerInstructions?.length) {
      for (const inner of meta.innerInstructions) {
        const instrs = (inner as any).instructions as AnyInstr[]
        count += countInList(instrs)
      }
    }

    return count
  }
}
