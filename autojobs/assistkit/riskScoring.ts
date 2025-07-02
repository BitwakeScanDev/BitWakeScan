export interface RiskScore {
  address: string
  score: number
  level: "low" | "medium" | "high"
}

export class RiskScoring {
  /**  
   * Compute a simple risk score based on account data length 
   * (placeholder for more advanced on‐chain heuristics)
   */
  async compute(addressInfoSize: number): Promise<RiskScore> {
    const rawScore = Math.min(100, Math.round((addressInfoSize / 1024) * 10))
    const level: RiskScore["level"] =
      rawScore > 70 ? "high" : rawScore > 40 ? "medium" : "low"
    return {
      address: `size:${addressInfoSize}`,
      score: rawScore,
      level
    }
  }
}
