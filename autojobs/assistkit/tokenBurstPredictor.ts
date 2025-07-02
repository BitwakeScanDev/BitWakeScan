export interface BurstPrediction {
  start: number     // Unix‐ms
  end: number       // Unix‐ms
  confidence: number // 0.0–1.0
}

export class TokenBurstPredictor {
  /**
   * Given a time series of volumes, detect the most recent “burst” window.
   * @param series array of [timestamp, volume]
   */
  predict(series: Array<[number, number]>): BurstPrediction | null {
    if (series.length < 2) return null

    // compute simple moving average over full series
    const totalVol = series.reduce((sum, [, v]) => sum + v, 0)
    const avgVol = totalVol / series.length

    // find contiguous window where volume > 2× average
    let burstStart: number | null = null
    let burstEnd: number | null = null

    for (const [ts, vol] of series) {
      if (vol > avgVol * 2) {
        burstStart = burstStart ?? ts
        burstEnd = ts
      }
    }
    if (burstStart === null) return null

    // confidence = (peakVolume / average) capped at 1.0
    const peak = Math.max(...series.map(([, v]) => v))
    const confidence = Math.min(1, peak / (avgVol * 3))

    return { start: burstStart, end: burstEnd!, confidence }
  }
}
