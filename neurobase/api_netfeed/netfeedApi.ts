
import express from "express"
import { Connection, PublicKey, ConfirmedSignatureInfo } from "@solana/web3.js"

const app = express()
app.use(express.json())

const conn = new Connection(process.env.SOLANA_RPC_ENDPOINT!, "confirmed")


app.get("/netfeed/transactions/:address", async (req, res) => {
  try {
    const address = new PublicKey(req.params.address)
    const limit = Number(req.query.limit) || 10
    const sigs: ConfirmedSignatureInfo[] = await conn.getSignaturesForAddress(address, { limit })
    res.json({ success: true, signatures: sigs.map(s => s.signature) })
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message })
  }
})


app.post("/netfeed/subscribe", (req, res) => {
  const { address } = req.body
  if (!address) return res.status(400).json({ success: false, error: "address required" })
  const token = `sub_${Buffer.from(address).toString("hex")}_${Date.now()}`
  res.json({ success: true, subscription: token })
})

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`NetFeed API listening on port ${port}`)
})
