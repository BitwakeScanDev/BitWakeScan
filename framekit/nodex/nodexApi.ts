
import express from "express"
import { NodexEngine } from "./nodexEngine"

const app = express()
app.use(express.json())

const engine = new NodexEngine(process.env.NODEX_API_URL!)

app.get("/nodex/analyze/:symbol", async (req, res) => {
  try {
    const metrics = await engine.analyze(req.params.symbol)
    res.json({ success: true, metrics })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

app.listen(process.env.PORT || 3000, () =>
  console.log(`Nodex API listening on port ${process.env.PORT || 3000}`)
)
