/**
 * Job queue abstraction over Google Cloud Tasks.
 * Falls back to in-process execution in development.
 */
import { CloudTasksClient } from '@google-cloud/tasks'

const client = new CloudTasksClient()

const PROJECT   = process.env['GCP_PROJECT_ID']!
const LOCATION  = process.env['GCP_TASKS_LOCATION'] ?? 'us-central1'
const QUEUE     = process.env['GCP_TASKS_QUEUE_NAME'] ?? 'okr-tool-jobs'
const API_URL   = process.env['INTERNAL_API_URL'] ?? 'http://localhost:3001'
const TASKS_SEC = process.env['INTERNAL_TASKS_SECRET']!

type JobType =
  | 'smart_score'
  | 'email_scrape'
  | 'bulk_process'
  | 'hierarchy_rebuild'
  | 'sheets_export'
  | 'notification'

interface JobPayload {
  smart_score: { objectiveId: string }
  email_scrape: { userId: string; triggeredBy: 'manual' | 'scheduled' }
  bulk_process: { jobId: string }
  hierarchy_rebuild: Record<string, never>
  sheets_export: { exportId?: string }
  notification: {
    userId: string
    type: string
    data: Record<string, unknown>
  }
}

export async function enqueueJob<T extends JobType>(
  type: T,
  payload: JobPayload[T],
  delaySeconds = 0,
): Promise<void> {
  if (process.env['NODE_ENV'] === 'development') {
    // Run inline in dev — import handler lazily to avoid circular deps
    console.log(`[JobQueue] Inline execution: ${type}`, payload)
    const { handleJob } = await import('../workers/jobHandler.js')
    // Don't await in dev — fire and forget like Cloud Tasks would
    handleJob(type, payload).catch((err: unknown) =>
      console.error(`[JobQueue] Inline job ${type} failed:`, err),
    )
    return
  }

  const parent = client.queuePath(PROJECT, LOCATION, QUEUE)
  const body = JSON.stringify({ type, payload })

  await client.createTask({
    parent,
    task: {
      httpRequest: {
        httpMethod: 'POST',
        url: `${API_URL}/internal/tasks/run`,
        headers: {
          'Content-Type': 'application/json',
          'X-Tasks-Secret': TASKS_SEC,
        },
        body: Buffer.from(body).toString('base64'),
      },
      ...(delaySeconds > 0
        ? { scheduleTime: { seconds: Math.floor(Date.now() / 1000) + delaySeconds } }
        : {}),
    },
  })
}
