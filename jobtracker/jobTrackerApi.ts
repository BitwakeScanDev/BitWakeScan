import express, { Request, Response, NextFunction } from "express"
import cors from "cors"
import morgan from "morgan"
import { z } from "zod"
import { JobTracker, Job } from "./jobTracker"

const app = express()

// Middlewares
app.use(cors())
app.use(express.json())
app.use(morgan("dev"))

// Zod schemas for request validation
const createJobSchema = z.object({
  title: z.string().min(1, "title is required"),
})

const updateJobSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed"], {
    errorMap: () => ({ message: "invalid status" }),
  }),
})

// Tracker instance
const tracker = new JobTracker()

// Error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err)
  if (err instanceof z.ZodError) {
    return res.status(400).json({ success: false, errors: err.errors })
  }
  res.status(500).json({ success: false, error: "Internal server error" })
})

// Routes
app.post("/jobs", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title } = createJobSchema.parse(req.body)
    const job: Job = tracker.create(title)
    return res.status(201).json({ success: true, job })
  } catch (err) {
    return next(err)
  }
})

app.get("/jobs", (_req: Request, res: Response) => {
  const jobs = tracker.list()
  res.json({ success: true, jobs })
})

app.patch("/jobs/:id", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = updateJobSchema.parse(req.body)
    const updated = tracker.updateStatus(req.params.id, status)
    if (!updated) {
      return res.status(404).json({ success: false, error: "job not found" })
    }
    const job = tracker.get(req.params.id)!
    return res.json({ success: true, job })
  } catch (err) {
    return next(err)
  }
})

// Health check
app.get("/health", (_req, res) => {
  res.json({ success: true, status: "ok" })
})

// Start server
const port = Number(process.env.PORT) || 3000
app.listen(port, () => {
  console.log(`🚀 JobTracker API listening on http://localhost:${port}`)
})
