import express, { Request, Response, NextFunction } from "express"
import { WatchRouteService } from "./watchRouteService"
import { z } from "zod"
import { PublicKey } from "@solana/web3.js"

// --- App setup ---
const app = express()
app.disable("x-powered-by")
app.set("trust proxy", true)
app.use(express.json({ limit: "200kb", strict: true }))

// --- Health check ---
app.get("/healthz", (_req: Request, res: Response) => {
  res.status(200).json({ success: true, status: "ok" })
})

// --- Env validation & service bootstrap ---
const RPC = process.env.SOLANA_RPC_ENDPOINT
if (!RPC) {
  // eslint-disable-next-line no-console
  console.error("Missing SOLANA_RPC_ENDPOINT environment variable")
  process.exit(1)
}
const service = new WatchRouteService(RPC)

// --- Helpers ---
const isPublicKey = (s: string): boolean => {
  try {
    new PublicKey(s)
    return true
  } catch {
    return false
  }
}

const bodySchema = z.object({
  addresses: z.array(z.string().trim().refine(isPublicKey, "invalid Solana address")).min(1),
  limit: z.union([z.number(), z.string()]).optional().transform(v => {
    if (v === undefined) return 10
    const n = typeof v === "number" ? v : Number(v)
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
      throw new Error("limit must be a positive integer")
    }
    return Math.min(n, 1000)
  })
})

// --- Content-Type guard for POSTs ---
app.use((req, res, next) => {
  if (req.method === "POST") {
    const ct = (req.headers["content-type"] || "").toString()
    if (!ct.includes("application/json")) {
      return res.status(415).json({ success: false, error: "unsupported_media_type", message: "Use application/json" })
    }
  }
  next()
})

// --- Route: watchroute ---
app.post("/watchroute", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { addresses, limit } = bodySchema.parse(req.body)
    const events = await service.watch(addresses, limit)
    res.status(200).json({ success: true, count: events.length, events })
  } catch (err) {
    if (err instanceof z.ZodError) {
      const errors = err.errors.map(e => ({ field: e.path.join(".") || "body", message: e.message }))
      return res.status(400).json({ success: false, error: "invalid_request", errors })
    }
    next(err)
  }
})

// --- 404 fallback ---
app.use((_req, res) => {
  res.status(404).json({ success: false, error: "not_found", message: "Route not found" })
})

// --- Global error handler ---
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  // eslint-disable-next-line no-console
  console.error("watchroute_error", err)
  res.status(500).json({ success: false, error: "internal_error", message: "Internal server error" })
})

// --- Start server with graceful shutdown ---
const port = Number(process.env.PORT) || 3000
const server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`WatchRoute API listening on port ${port}`)
})

const shutdown = (signal: string) => {
  // eslint-disable-next-line no-console
  console.log(`Received ${signal}, shutting down`)
  server.close(err => {
    if (err) {
      // eslint-disable-next-line no-console
      console.error("Error during shutdown", err)
      process.exit(1)
    }
    process.exit(0)
  })
}

process.on("SIGINT", () => shutdown("SIGINT"))
process.on("SIGTERM", () => shutdown("SIGTERM"))
