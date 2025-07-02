import express from "express"
import { TokenVisionService } from "./tokenVisionService"
import { TokenVisionAnalytics } from "./tokenVisionAnalytics"
import { TokenVisionReporter } from "./tokenVisionReporter"

const app = express()
app.use(express.json())

const service = new TokenVisionService(process.env.SOLANA_RPC_ENDPOINT!)
const analytics = new TokenVisionAnalytics()
const reporter = new TokenVisionReporter()

app.post("/vision", async (req, res) => {
  try {
    const { mint, limit } = req.body
    const series = await service.fetchRawData(mint, limit || 100)
    const metrics = analytics.compute(series)
    const report = reporter.generate(mint, series, metrics)
    res.json({ success: true, report })
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message })
  }
})

app.listen(process.env.PORT || 3000, () =>
  console.log(`TokenVision API listening on port ${process.env.PORT || 3000}`)
)
