import express from "express"
import { TaskManager } from "./TaskManager"

const app = express()
app.use(express.json())
const manager = new TaskManager()

app.get("/tasks", (req, res) => {
  res.json({ success: true, tasks: manager.list() })
})

app.post("/tasks", (req, res) => {
  const { title, payload } = req.body
  if (!title) return res.status(400).json({ success: false, error: "title required" })
  const task = manager.create(title, payload)
  res.status(201).json({ success: true, task })
})

app.delete("/tasks/:id", (req, res) => {
  const ok = manager.remove(req.params.id)
  ok ? res.json({ success: true }) : res.status(404).json({ success: false, error: "not found" })
})

const port = process.env.PORT || 3000
app.listen(port, () => console.log(`Tasks API listening on port ${port}`))
