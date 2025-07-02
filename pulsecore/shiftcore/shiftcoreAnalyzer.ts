
import { TransferRecord } from "./shiftcoreService"

export interface ShiftSummary {
  totalVolume: number
  uniqueSenders: number
  uniqueReceivers: number
  spikes: { timestamp: number; changePercent: number }[]
}

export class ShiftcoreAnalyzer {
  summarize(records: TransferRecord[]): ShiftSummary {
    const volume = records.reduce((sum, r) => sum + r.amount, 0)
    const senders = new Set(records.map(r => r.from)).size
    const receivers = new Set(records.map(r => r.to)).size

    const sorted = records.sort((a, b) => a.timestamp - b.timestamp)
    const spikes: { timestamp: number; changePercent: number }[] = []
    const window = 5
    for (let i = window; i < sorted.length; i++) {
      const prevSum = sorted.slice(i - window, i).reduce((s, r) => s + r.amount, 0)
      const currSum = sorted.slice(i - window + 1, i + 1).reduce((s, r) => s + r.amount, 0)
      if (prevSum > 0) {
        const change = ((currSum - prevSum) / prevSum) * 100
        if (change > 20) {
          spikes.push({ timestamp: sorted[i].timestamp, changePercent: Number(change.toFixed(2)) })
        }
      }
    }

    return { totalVolume: volume, uniqueSenders: senders, uniqueReceivers: receivers, spikes }
  }
}