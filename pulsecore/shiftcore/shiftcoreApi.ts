import express from "express"
import { ShiftcoreService } from "./shiftcoreService"
import { ShiftcoreAnalyzer } from "./shiftcoreAnalyzer"

const app = express()
app.use(express.json())

const service = new ShiftcoreService(process.env.SOLANA_RPC_ENDPOINT!)
const analyzer = new ShiftcoreAnalyzer()

app.post("/shiftcore/analyze", async (req, res) => {
  try {
    const { mint, limit } = req.body
    const records = await service.fetchTransfers(mint, limit || 100)
    const summary = analyzer.summarize(records)
    res.json({ success: true, summary, records })
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message })
  }
})

app.listen(process.env.PORT || 3000, () =>
  console.log(`Shiftcore API listening on port ${process.env.PORT || 3000}`)
)