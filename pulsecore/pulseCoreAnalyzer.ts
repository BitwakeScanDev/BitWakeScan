import { EventEmitter } from 'events'

export interface PulsePoint {
  timestamp: number
  transfers: number
  totalSupply: number
}

export interface AnalysisResult {
  averageTransfers: number
  medianTransfers: number
  peakSupply: number
  transferRateChanges: number[]
  supplyVolatility: number
}

export class PulseCoreAnalyzer extends EventEmitter {
  public analyze(series: PulsePoint[]): AnalysisResult {
    if (!series.length) {
      throw new Error('Cannot analyze an empty series')
    }

    const transfers = series.map(p => p.transfers)
    const supplies = series.map(p => p.totalSupply)

    const averageTransfers = this.computeAverage(transfers)
    const medianTransfers = this.computeMedian(transfers)
    const peakSupply = Math.max(...supplies)
    const transferRateChanges = this.computeRateChanges(transfers)
    const supplyVolatility = this.computeStdDev(supplies)

    const result: AnalysisResult = {
      averageTransfers,
      medianTransfers,
      peakSupply,
      transferRateChanges,
      supplyVolatility,
    }

    this.emit('analysisComplete', result)
    return result
  }

  private computeAverage(values: number[]): number {
    const sum = values.reduce((acc, v) => acc + v, 0)
    return sum / values.length
  }

  private computeMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2
  }

  private computeRateChanges(values: number[]): number[] {
    const changes: number[] = []
    for (let i = 1; i < values.length; i++) {
      const prev = values[i - 1] || 1
      changes.push((values[i] - prev) / prev)
    }
    return changes
  }

  private computeStdDev(values: number[]): number {
    const mean = this.computeAverage(values)
    const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length
    return Math.sqrt(variance)
  }
}
