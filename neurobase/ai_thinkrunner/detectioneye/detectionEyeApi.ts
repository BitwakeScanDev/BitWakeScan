
import express from "express"
import { DetectionEyeService } from "./detectionEyeService"

const app = express()
app.use(express.json())

const service = new DetectionEyeService(process.env.SOLANA_RPC_ENDPOINT!)

app.post("/detect", async (req, res) => {
  try {
    const { mint, limit, threshold } = req.body
    if (!mint) return res.status(400).json({ success: false, error: "mint required" })

    const events = await service.fetchTransfers(mint, limit || 100)
    const anomalies = service.detectAnomalies(events, threshold || 1_000_000)
    res.json({ success: true, anomalies })
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message })
  }
})

app.listen(process.env.PORT || 3000, () =>
  console.log(`DetectionEye API listening on port ${process.env.PORT || 3000}`)
)
