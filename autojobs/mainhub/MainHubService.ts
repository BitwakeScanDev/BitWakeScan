import fetch from "node-fetch"

export interface HubTask {
  id: string
  type: string
  params: Record<string, any>
  status: "pending" | "running" | "done" | "error"
}

export class MainHubService {
  private tasks: HubTask[] = []

  createTask(type: string, params: Record<string, any>): HubTask {
    const task: HubTask = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type,
      params,
      status: "pending"
    }
    this.tasks.push(task)
    return task
  }

  listTasks(): HubTask[] {
    return [...this.tasks]
  }

  async runTask(id: string): Promise<HubTask | undefined> {
    const task = this.tasks.find(t => t.id === id)
    if (!task) return
    task.status = "running"
    try {
      // dispatch based on type
      let result
      if (task.type === "fetchPrice") {
        const { symbol, apiUrl } = task.params
        const res = await fetch(`${apiUrl}/price/${symbol}`)
        result = await res.json()
      } else if (task.type === "scanTransfers") {
        const { mint, rpcUrl } = task.params
        // placeholder: call a scanTransfer endpoint
        const res = await fetch(`${rpcUrl}/transfers/${mint}`)
        result = await res.json()
      } else {
        throw new Error("Unknown task type")
      }
      task.params.result = result
      task.status = "done"
    } catch {
      task.status = "error"
    }
    return task
  }
}
