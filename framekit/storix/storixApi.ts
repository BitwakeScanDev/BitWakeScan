import express, { Request, Response, NextFunction } from "express"
import { StorixClient } from "./storixClient"
import { z } from "zod"

// ---------- Env & App Setup ----------

const AZURE_CONN = process.env.AZURE_STORAGE_CONNECTION_STRING
const CONTAINER = process.env.STORIX_CONTAINER_NAME
const PORT = Number(process.env.PORT || 3000)
const JSON_LIMIT = process.env.JSON_LIMIT || "5mb" // allow override

if (!AZURE_CONN) throw new Error("AZURE_STORAGE_CONNECTION_STRING is required")
if (!CONTAINER) throw new Error("STORIX_CONTAINER_NAME is required")

const app = express()
app.disable("x-powered-by")
app.use(express.json({ limit: JSON_LIMIT }))

// Basic hardening headers
app.use((_, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("Referrer-Policy", "no-referrer")
  next()
})

const client = new StorixClient(AZURE_CONN, CONTAINER)

// ---------- Schemas ----------

const uploadBodySchema = z.object({
  key: z.string().min(1).max(1024),
  /** Base64-encoded binary payload */
  data: z.string().min(1),
})

type UploadBody = z.infer<typeof uploadBodySchema>

// ---------- Utilities ----------

function decodeBase64ToBuffer(b64: string): Buffer {
  // Validate base64 shape to avoid silent truncation
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64.replace(/\s+/g, ""))) {
    throw new Error("Invalid base64 payload")
  }
  return Buffer.from(b64, "base64")
}

// async route wrapper
const aw =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next)

// ---------- Routes ----------

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, time: new Date().toISOString() })
})

app.post(
  "/storix/upload",
  aw(async (req, res) => {
    const parsed = uploadBodySchema.safeParse(req.body)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`)
      return res.status(400).json({ success: false, error: `Invalid body: ${errors.join("; ")}` })
    }

    const { key, data } = parsed.data as UploadBody
    const buf = decodeBase64ToBuffer(data)

    // Optional: reject empty payloads explicitly
    if (buf.length === 0) {
      return res.status(400).json({ success: false, error: "Empty payload" })
    }

    await client.upload(key, buf)
    res.status(201).json({ success: true, key, size: buf.length })
  })
)

app.get(
  "/storix/download/:key",
  aw(async (req, res) => {
    const key = req.params.key
    if (!key) return res.status(400).json({ success: false, error: "key required" })

    const buf = await client.download(key)

    // Best-effort headers; content-type may be overridden by client if supported
    res.status(200)
      .setHeader("Content-Type", "application/octet-stream")
      .setHeader("Content-Length", String(buf.length))
      .setHeader("Cache-Control", "private, max-age=0, must-revalidate")
      .send(buf)
  })
)

// 405 for other methods on known paths
app.all("/storix/upload", (_req, res) => res.status(405).json({ success: false, error: "Method Not Allowed" }))
app.all("/storix/download/:key", (_req, res) => res.status(405).json({ success: false, error: "Method Not Allowed" }))

// ---------- Error Handler ----------

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = typeof err?.status === "number" ? err.status : 500
  const msg =
    err?.name === "AbortError"
      ? "Request timed out"
      : err?.message || "Internal Server Error"
  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error("[Storix API] Unhandled error:", err)
  }
  res.status(status).json({ success: false, error: msg })
})

// ---------- Start ----------

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Storix API listening on ${PORT}`)
})
