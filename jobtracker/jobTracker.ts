import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'

/**
 * Possible states of a Job in the tracker
 */
export enum JobStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
}

/**
 * Basic shape of a tracked job
 */
export interface Job {
  id: string
  title: string
  status: JobStatus
  createdAt: Date
  updatedAt: Date
}

/**
 * Optional data for updating an existing job
 */
export interface JobUpdate {
  title?: string
  status?: JobStatus
}

/**
 * JobTracker manages a collection of jobs with create, list, update, and remove operations
 * Emits events: 'jobCreated', 'jobUpdated', 'jobRemoved'
 */
export class JobTracker extends EventEmitter {
  private jobs: Map<string, Job> = new Map()

  /**
   * Create a new job with a unique identifier
   * @param title - descriptive title of the job
   * @returns the newly created Job object
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
    return job
  }

  /**
   * Retrieve a snapshot list of all jobs
   * @returns array of Job objects
   */
  public list(): Job[] {
    return Array.from(this.jobs.values())
  }

  /**
   * Find a job by its identifier
   * @param id - unique job id
   * @returns Job or undefined if not found
   */
  public get(id: string): Job | undefined {
    return this.jobs.get(id)
  }

  /**
   * Update title or status of an existing job
   * @param id - unique job id
   * @param changes - partial update fields
   * @returns the updated Job or throws an Error if not found
   */
  public update(id: string, changes: JobUpdate): Job {
    const job = this.jobs.get(id)
    if (!job) {
      throw new Error(`Job not found: ${id}`)
    }
    if (changes.title !== undefined) {
      job.title = changes.title
    }
    if (changes.status !== undefined) {
      job.status = changes.status
    }
    job.updatedAt = new Date()
    this.jobs.set(id, job)
    this.emit('jobUpdated', job)
    return job
  }

  /**
   * Specifically update only the status of a job
   * @param id - unique job id
   * @param status - new JobStatus
   * @returns the updated Job or throws Error if not found
   */
  public updateStatus(id: string, status: JobStatus): Job {
    return this.update(id, { status })
  }

  /**
   * Remove a job from the tracker
   * @param id - unique job id
   * @returns true if removed, false if not found
   */
  public remove(id: string): boolean {
    const existed = this.jobs.delete(id)
    if (existed) {
      this.emit('jobRemoved', id)
    }
    return existed
  }

  /**
   * Clear all jobs from the tracker
   */
  public clearAll(): void {
    const ids = Array.from(this.jobs.keys())
    this.jobs.clear()
    ids.forEach(id => this.emit('jobRemoved', id))
  }
}

