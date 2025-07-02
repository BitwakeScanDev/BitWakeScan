import express from "express"
import { WatchRouteService } from "./watchRouteService"

const app = express()
app.use(express.json())

const service = new WatchRouteService(process.env.SOLANA_RPC_ENDPOINT!)

app.post("/watchroute", async (req, res) => {
  try {
    const { addresses, limit } = req.body
    if (!Array.isArray(addresses) || !addresses.length) {
      return res.status(400).json({ success: false, error: "addresses array required" })
    }
    const events = await service.watch(addresses, limit || 10)
    res.json({ success: true, events })
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message })
  }
})

const port = process.env.PORT || 3000
app.listen(port, () => console.log(`WatchRoute API listening on port ${port}`))