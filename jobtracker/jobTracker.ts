
export interface Job {
  id: string
  title: string
  status: "pending" | "running" | "completed" | "failed"
  createdAt: number
}

export class JobTracker {
  private jobs: Job[] = []

  create(title: string): Job {
    const job: Job = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      title,
      status: "pending",
      createdAt: Date.now()
    }
    this.jobs.push(job)
    return job
  }

  list(): Job[] {
    return [...this.jobs]
  }

  updateStatus(id: string, status: Job["status"]): boolean {
    const job = this.jobs.find(j => j.id === id)
    if (!job) return false
    job.status = status
    return true
  }
}
