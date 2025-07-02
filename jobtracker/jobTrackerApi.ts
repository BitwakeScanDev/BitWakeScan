
import express from "express"
import { JobTracker } from "./jobTracker"

const app = express()
app.use(express.json())

const tracker = new JobTracker()

app.post("/jobs", (req, res) => {
  const { title } = req.body
  if (!title) return res.status(400).json({ success: false, error: "title required" })
  const job = tracker.create(title)
  res.status(201).json({ success: true, job })
})

app.get("/jobs", (req, res) => {
  res.json({ success: true, jobs: tracker.list() })
})

app.patch("/jobs/:id", (req, res) => {
  const { status } = req.body
  if (!status) return res.status(400).json({ success: false, error: "status required" })
  const ok = tracker.updateStatus(req.params.id, status)
  return ok
    ? res.json({ success: true })
    : res.status(404).json({ success: false, error: "job not found" })
})

const port = process.env.PORT || 3000
app.listen(port, () => console.log(`JobTracker API on port ${port}`))
