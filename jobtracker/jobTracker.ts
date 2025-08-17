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
 * Utility to clone and freeze a job object
 */
const cloneJob = (job: Job): Job => Object.freeze({ ...job })

/**
 * In-memory job manager with event support
 */
export class JobTracker extends EventEmitter {
  private jobs = new Map<string, Job>()

  // Overloaded event handlers for strong typing
  public override on<K extends keyof JobTrackerEvents>(
    event: K,
    listener: JobTrackerEvents[K]
  ): this {
    return super.on(event, listener as any)
  }

  public override off<K extends keyof JobTrackerEvents>(
    event: K,
    listener: JobTrackerEvents[K]
  ): this {
    return super.off(event, listener as any)
  }

  /**
   * Create and store a new job
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
    this.emit('jobCreated', cloneJob(job))
    return cloneJob(job)
  }

  /**
   * Get all jobs with optional filters and pagination
   */
  public list(options?: {
    status?: JobStatus
    page?: number
    pageSize?: number
  }): Job[] {
    let filtered = Array.from(this.jobs.values())

    if (options?.status) {
      filtered = filtered.filter(j => j.status === options.status)
    }

    if (options?.page && options.pageSize) {
      const start = Math.max((options.page - 1) * options.pageSize, 0)
      const end = start + options.pageSize
      filtered = filtered.slice(start, end)
    }

    return filtered.map(cloneJob)
  }

  /**
   * Retrieve a job by its ID
   */
  public get(id: string): Job | undefined {
    const job = this.jobs.get(id)
    return job ? cloneJob(job) : undefined
  }

  /**
   * Apply updates to an existing job
   */
  public update(id: string, changes: JobUpdate): Job {
    const job = this.jobs.get(id)
    if (!job) throw new Error(`Job not found: ${id}`)

    if (changes.title !== undefined) {
      job.title = changes.title
    }

    if (changes.status !== undefined) {
      job.status = changes.status
    }

    job.updatedAt = new Date()
    this.emit('jobUpdated', cloneJob(job))
    return cloneJob(job)
  }

  /**
   * Update only the job's status
   */
  public updateStatus(id: string, status: JobStatus): Job {
    return this.update(id, { status })
  }

  /**
   * Remove a job and emit event if it existed
   */
  public remove(id: string): boolean {
    const existed = this.jobs.delete(id)
    if (existed) {
      this.emit('jobRemoved', id)
    }
    return existed
  }

  /**
   * Remove all jobs and emit `jobRemoved` for each
   */
  public clearAll(): number {
    const ids = Array.from(this.jobs.keys())
    this.jobs.clear()
    ids.forEach(id => this.emit('jobRemoved', id))
    return ids.length
  }

  /**
   * Get total count, or count by status
   */
  public count(status?: JobStatus): number {
    if (!status) return this.jobs.size
    return Array.from(this.jobs.values()).filter(j => j.status === status).length
  }
}
