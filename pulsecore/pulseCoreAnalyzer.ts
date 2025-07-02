import { PulsePoint } from "./pulseCoreService"

export interface AnalysisResult {
  averageTransfers: number
  peakSupply: number
  transferRateChange: number[]
}

export class PulseCoreAnalyzer {
  analyze(series: PulsePoint[]): AnalysisResult {
    const transfers = series.map(p => p.transfers)
    const supplies = series.map(p => p.totalSupply)

    const avgTransfers = transfers.reduce((s, v) => s + v, 0) / (transfers.length || 1)
    const peakSupply = Math.max(...supplies, 0)

    const rateChanges: number[] = []
    for (let i = 1; i < transfers.length; i++) {
      const prev = transfers[i - 1] || 1
      rateChanges.push((transfers[i] - prev) / prev)
    }

    return { averageTransfers: avgTransfers, peakSupply, transferRateChange: rateChanges }
  }
}
