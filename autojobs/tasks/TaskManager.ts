export interface Task {
  id: string
  title: string
  payload?: any
  createdAt: number
}

export class TaskManager {
  private tasks: Task[] = []

  create(title: string, payload?: any): Task {
    const task: Task = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      title,
      payload,
      createdAt: Date.now()
    }
    this.tasks.push(task)
    return task
  }

  list(): Task[] {
    return [...this.tasks]
  }

  remove(id: string): boolean {
    const before = this.tasks.length
    this.tasks = this.tasks.filter(t => t.id !== id)
    return this.tasks.length < before
  }
}
