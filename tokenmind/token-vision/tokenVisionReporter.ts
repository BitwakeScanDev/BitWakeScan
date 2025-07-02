import { RawPoint } from "./tokenVisionService"
import { Metrics } from "./tokenVisionAnalytics"

export interface VisionReport {
  mint: string
  periodStart: number
  periodEnd: number
  metrics: Metrics
  dataPoints: RawPoint[]
}

export class TokenVisionReporter {
  generate(mint: string, series: RawPoint[], metrics: Metrics): VisionReport {
    const periodStart = series[0]?.timestamp || Date.now()
    const periodEnd = series[series.length - 1]?.timestamp || Date.now()
    return { mint, periodStart, periodEnd, metrics, dataPoints: series }
  }
}
