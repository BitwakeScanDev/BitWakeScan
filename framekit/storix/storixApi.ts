import express from "express"
import { StorixClient } from "./storixClient"

const app = express()
app.use(express.json())

const client = new StorixClient(
  process.env.AZURE_STORAGE_CONNECTION_STRING!,
  process.env.STORIX_CONTAINER_NAME!
)

app.post("/storix/upload", async (req, res) => {
  const { key, data } = req.body
  if (!key || data == null) {
    return res.status(400).json({ success: false, error: "key and data required" })
  }
  try {
    await client.upload(key, Buffer.from(data, "base64"))
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message })
  }
})

app.get("/storix/download/:key", async (req, res) => {
  try {
    const buf = await client.download(req.params.key)
    res.type("application/octet-stream").send(buf)
  } catch (e: any) {
    res.status(404).json({ success: false, error: e.message })
  }
})

const port = process.env.PORT || 3000
app.listen(port, () => console.log(`Storix API listening on ${port}`))
