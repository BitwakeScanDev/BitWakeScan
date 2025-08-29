import express, { Request, Response, NextFunction } from "express"
import cors from "cors"
import morgan from "morgan"
import { z } from "zod"
import { JobTracker, Job } from "./jobTracker"
import { randomUUID } from "crypto"

const app = express()

// ----- Constants & helpers -----
const STATUSES = ["pending", "in_progress", "completed"] as const
type JobStatus = (typeof STATUSES)[number]

const asyncHandler =
  <T extends Request>(fn: (req: T, res: Response, next: NextFunction) => Promise<any> | any) =>
  (req: T, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next)

// Attach request id for correlation
app.use((req, res, next) => {
  const id = (req.headers["x-request-id"] as string) || randomUUID()
  res.locals.requestId = id
  res.setHeader("X-Request-Id", id)
  next()
})

// Morgan with request-id token
morgan.token("rid", (req, res) => (res.locals?.requestId as string) || "-")

// ----- Middlewares -----
app.use(
  cors({
    origin: true,
    credentials: true,
  })
)
app.use(express.json())

// Log format with request id
app.use(
  morgan(':rid :method :url :status :res[content-length] - :response-time ms', {
    skip: (req) => req.path === "/health",
  })
)

// ----- Zod schemas -----
const createJobSchema = z.object({
  title: z.string().min(1, "title is required"),
})

const updateJobSchema = z.object({
  status: z.enum(STATUSES, {
    errorMap: () => ({ message: "invalid status" }),
  }),
})

const idParamSchema = z.object({
  id: z.string().min(1, "id is required"),
})

const listQuerySchema = z.object({
  status: z.enum(STATUSES).optional(),
  limit: z
    .string()
    .transform(v => Number(v))
    .refine(n => Number.isFinite(n) && n > 0 && n <= 1000, "limit must be 1..1000")
    .optional()
    .default("100") // default as string to pass transform; corrected below
    .transform(v => (typeof v === "string" ? Number(v) : (v as number))),
  offset: z
    .string()
    .transform(v => Number(v))
    .refine(n => Number.isFinite(n) && n >= 0, "offset must be >= 0")
    .optional()
    .default("0")
    .transform(v => (typeof v === "string" ? Number(v) : (v as number))),
})

// ----- Tracker -----
const tracker = new JobTracker()

// ----- Routes (versioned) -----
const api = express.Router()

api.post(
  "/jobs",
  asyncHandler((req: Request, res: Response) => {
    const { title } = createJobSchema.parse(req.body)
    const job: Job = tracker.create(title)
    res
      .status(201)
      .setHeader("Location", `/api/v1/jobs/${job.id}`)
      .json({ success: true, job })
  })
)

api.get(
  "/jobs",
  asyncHandler((req: Request, res: Response) => {
    const { status, limit, offset } = listQuerySchema.parse(req.query)
    let jobs = tracker.list()
    if (status) {
      jobs = jobs.filter(j => j.status === status)
    }
    const window = jobs.slice(offset, offset + limit)
    res.json({
      success: true,
      total: jobs.length,
      limit,
      offset,
      jobs: window,
    })
  })
)

api.get(
  "/jobs/:id",
  asyncHandler((req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params)
    const job = tracker.get(id)
    if (!job) {
      return res.status(404).json({ success: false, error: "job not found" })
    }
    res.json({ success: true, job })
  })
)

api.patch(
  "/jobs/:id",
  asyncHandler((req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params)
    const { status } = updateJobSchema.parse(req.body)
    const updated = tracker.updateStatus(id, status as JobStatus)
    if (!updated) {
      return res.status(404).json({ success: false, error: "job not found" })
    }
    const job = tracker.get(id)!
    res.json({ success: true, job })
  })
)

app.use("/api/v1", api)

// Health check (lightweight, unversioned OK)
app.get("/health", (_req, res) => {
  res.json({
    success: true,
    status: "ok",
    uptimeSec: Math.round(process.uptime()),
    pid: process.pid,
  })
})

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ success: false, error: "Not Found" })
})

// ----- Error handler (must be last) -----
// Handles Zod errors, JSON parse errors, and generic errors
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const requestId = res.locals?.requestId
  if (err instanceof z.ZodError) {
    return res
      .status(400)
      .json({ success: false, requestId, errors: err.errors })
  }
  if (err?.type === "entity.parse.failed" || err instanceof SyntaxError) {
    return res
      .status(400)
      .json({ success: false, requestId, error: "Invalid JSON payload" })
  }
  console.error(`[${requestId ?? "-"}]`, err)
  res.status(500).json({ success: false, requestId, error: "Internal server error" })
})

// ----- Start server -----
const port = Number(process.env.PORT) || 3000
const server = app.listen(port, () => {
  console.log(`🚀 JobTracker API listening on http://localhost:${port}`)
})

// Graceful shutdown
const shutdown = (signal: string) => {
  console.log(`\n${signal} received — shutting down...`)
  server.close(err => {
    if (err) {
      console.error("Error during server close:", err)
      process.exitCode = 1
    }
    process.exit()
  })
}
process.on("SIGINT", () => shutdown("SIGINT"))
process.on("SIGTERM", () => shutdown("SIGTERM"))
