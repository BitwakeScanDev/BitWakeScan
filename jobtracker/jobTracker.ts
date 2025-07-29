import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'

export enum JobStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
}

export interface Job {
  readonly id: string
  title: string
  status: JobStatus
  readonly createdAt: Date
  updatedAt: Date
}

export interface JobUpdate {
  title?: string
  status?: JobStatus
}

export interface JobTrackerEvents {
  jobCreated: (job: Job) => void
  jobUpdated: (job: Job) => void
  jobRemoved: (id: string) => void
}

/**
 * JobTracker manages in‑memory jobs with filtering, pagination,
 * and strongly‑typed events.
 */
export class JobTracker extends EventEmitter {
  private jobs = new Map<string, Job>()

  constructor() {
    super()
  }

  public on<K extends keyof JobTrackerEvents>(
    event: K,
    listener: JobTrackerEvents[K]
  ): this {
    return super.on(event, listener as any)
  }

  public off<K extends keyof JobTrackerEvents>(
    event: K,
    listener: JobTrackerEvents[K]
  ): this {
    return super.off(event, listener as any)
  }

  /**
   * Create a new job
   */
  public create(title: string): Job {
    const now = new Date()
    const job: Job = {
      id: uuidv4(),
      title,
      status: JobStatus.Pending,
      createdAt: now,
      updatedAt: now,
    }
    this.jobs.set(job.id, job)
    this.emit('jobCreated', job)
    return { ...job }
  }

  /**
   * List jobs with optional filtering & pagination
   */
  public list(options?: {
    status?: JobStatus
    page?: number
    pageSize?: number
  }): Job[] {
    let arr = Array.from(this.jobs.values())
    if (options?.status) {
      arr = arr.filter(j => j.status === options.status)
    }
    if (options?.page && options.pageSize) {
      const start = (options.page - 1) * options.pageSize
      arr = arr.slice(start, start + options.pageSize)
    }
    return arr.map(j => ({ ...j }))
  }

  /**
   * Get a job by id
   */
  public get(id: string): Job | undefined {
    const job = this.jobs.get(id)
    return job ? { ...job } : undefined
  }

  /**
   * Update title or status of an existing job
   */
  public update(id: string, changes: JobUpdate): Job {
    const job = this.jobs.get(id)
    if (!job) throw new Error(`Job not found: ${id}`)
    if (changes.title !== undefined) job.title = changes.title
    if (changes.status !== undefined) job.status = changes.status
    job.updatedAt = new Date()
    this.emit('jobUpdated', { ...job })
    return { ...job }
  }

  /**
   * Update only the status field
   */
  public updateStatus(id: string, status: JobStatus): Job {
    return this.update(id, { status })
  }

  /**
   * Remove a job by id
   */
  public remove(id: string): boolean {
    const existed = this.jobs.delete(id)
    if (existed) {
      this.emit('jobRemoved', id)
    }
    return existed
  }

  /**
   * Clear all jobs, returns number removed
   */
  public clearAll(): number {
    const count = this.jobs.size
    const ids = Array.from(this.jobs.keys())
    this.jobs.clear()
    ids.forEach(id => this.emit('jobRemoved', id))
    return count
  }

  /**
   * Count jobs, optionally by status
   */
  public count(status?: JobStatus): number {
    if (!status) return this.jobs.size
    return Array.from(this.jobs.values()).filter(j => j.status === status)
      .length
  }
}
