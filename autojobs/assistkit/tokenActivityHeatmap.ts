export type HeatmapPoint = {
  weekday: number // 0 = Sunday, …, 6 = Saturday
  hour: number // 0–23
  count: number
}

export interface HeatmapOptions {
  /** Normalize counts into 0–1 scale */
  normalize?: boolean
  /** Ignore timestamps <= 0 or invalid dates (default: true) */
  skipInvalid?: boolean
  /** Optional time zone (default: UTC). Pass "local" to use system local time */
  timeZone?: "utc" | "local"
}

export class TokenActivityHeatmap {
  /**
   * Build a 7×24 heatmap from an array of timestamps.
   * @param timestamps Unix‐ms timestamps of transfer events
   * @param opts Optional configuration
   */
  build(timestamps: number[], opts: HeatmapOptions = {}): HeatmapPoint[] {
    const { normalize = false, skipInvalid = true, timeZone = "utc" } = opts
    const buckets: Record<string, number> = {}

    for (const ts of timestamps) {
      if (!Number.isFinite(ts) || ts <= 0) {
        if (skipInvalid) continue
        else throw new Error(`Invalid timestamp: ${ts}`)
      }
      const d = new Date(ts)
      if (isNaN(d.getTime())) {
        if (skipInvalid) continue
        else throw new Error(`Invalid date from timestamp: ${ts}`)
      }

      const weekday = timeZone === "utc" ? d.getUTCDay() : d.getDay()
      const hour = timeZone === "utc" ? d.getUTCHours() : d.getHours()
      const key = `${weekday}-${hour}`
      buckets[key] = (buckets[key] || 0) + 1
    }

    const points: HeatmapPoint[] = []
    let maxCount = 0
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const key = `${day}-${hour}`
        const count = buckets[key] || 0
        if (count > maxCount) maxCount = count
        points.push({ weekday: day, hour, count })
      }
    }

    if (normalize && maxCount > 0) {
      return points.map(p => ({
        ...p,
        count: p.count / maxCount,
      }))
    }

    return points
  }

  /**
   * Convert the heatmap into a matrix [7][24] for easier visualization
   */
  toMatrix(points: HeatmapPoint[]): number[][] {
    const matrix: number[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => 0)
    )
    for (const p of points) {
      matrix[p.weekday][p.hour] = p.count
    }
    return matrix
  }
}
