export type HeatmapPoint = {
  weekday: number  // 0 = Sunday, …, 6 = Saturday
  hour: number     // 0–23
  count: number
}

export class TokenActivityHeatmap {
  /**
   * Build a 7×24 heatmap from an array of timestamps.
   * @param timestamps Unix‐ms timestamps of transfer events
   */
  build(timestamps: number[]): HeatmapPoint[] {
    const buckets: Record<string, number> = {}

    for (const ts of timestamps) {
      const d = new Date(ts)
      const key = `${d.getDay()}-${d.getHours()}`
      buckets[key] = (buckets[key] || 0) + 1
    }

    const points: HeatmapPoint[] = []
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const key = `${day}-${hour}`
        points.push({ weekday: day, hour, count: buckets[key] || 0 })
      }
    }
    return points
  }
}
