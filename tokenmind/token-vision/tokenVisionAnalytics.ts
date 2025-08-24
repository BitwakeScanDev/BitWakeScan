import { Wallet } from "@solanatracker/solanatracker-sdk"
import type { VaultResult } from "@/ai"
import type { GetBalanceArgumentsType, GetBalanceResultBodyType } from "./types"

export async function fetchTokenBalance(
  vault: Wallet,
  params: GetBalanceArgumentsType
): Promise<VaultResult<GetBalanceResultBodyType>> {
  try {
    const mainAddress = await vault.getDefaultAddress()

    if (!params.assetId) {
      const allBalances = await mainAddress.getAllBalances()
      const body: GetBalanceResultBodyType = {
        balance: allBalances,
        ...(params.includeMetadata && { metadataIncluded: true }),
      }
      return {
        message: "✅ Fetched balances for all assets",
        body,
      }
    }

    const balance = await mainAddress.getBalance(params.assetId)
    const result: GetBalanceResultBodyType = {
      balance,
      ...(params.includeMetadata && {
        tokenInfo: await mainAddress.getTokenInfo(params.assetId),
      }),
    }

    return {
      message: `✅ Fetched balance for asset ${params.assetId}: ${balance}`,
      body: result,
    }
  } catch (err: any) {
    return {
      message: `❌ Failed to retrieve balance: ${err?.message || String(err)}`,
    }
  }
}

// -------------------- Token analytics --------------------

export interface Metrics {
  averageTransfers: number
  maxSupply: number
  transferSpikeTimestamps: number[]
}

export class TokenVisionAnalytics {
  compute(series: { timestamp: number; transfers: number; supply: number }[]): Metrics {
    const transfers = series.map(p => p.transfers)
    const supplies = series.map(p => p.supply)

    const avgTransfers = transfers.reduce((s, v) => s + v, 0) / (transfers.length || 1)
    const maxSupply = Math.max(...supplies, 0)

    const mean = avgTransfers
    const std = Math.sqrt(
      transfers.reduce((s, v) => s + (v - mean) ** 2, 0) / (transfers.length || 1)
    )

    const spikes = series
      .filter(p => (p.transfers - mean) / (std || 1) > 2)
      .map(p => p.timestamp)

    return {
      averageTransfers: avgTransfers,
      maxSupply,
      transferSpikeTimestamps: spikes,
    }
  }
}
