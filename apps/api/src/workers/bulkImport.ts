/**
 * Bulk import worker.
 * Reads a parsed file from GCS, validates rows, and commits to the database.
 */
import { Storage } from '@google-cloud/storage'
import * as XLSX from 'xlsx'
import { queryOne, query, withTransaction } from '../db/client.js'
import type { BulkRowResult } from '@okr-tool/core'

const storage = new Storage({ projectId: process.env['GCS_PROJECT_ID'] })
const BUCKET = process.env['GCS_BUCKET_NAME']!

export async function processBulkImport(jobId: string): Promise<void> {
  const job = await queryOne<{
    id: string; user_id: string; job_type: string; file_storage_path: string
  }>(
    'SELECT id, user_id, job_type, file_storage_path FROM bulk_import_jobs WHERE id = $1',
    [jobId],
  )
  if (!job) return

  await query(
    `UPDATE bulk_import_jobs SET status = 'validating' WHERE id = $1`,
    [jobId],
  )

  try {
    // Download file from GCS
    const [fileBuffer] = await storage.bucket(BUCKET).file(job.file_storage_path).download()
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]!]!
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

    const results: BulkRowResult[] = []
    let successRows = 0
    let errorRows = 0

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!
      const rowResult = await validateAndParseRow(row, i + 2, job.user_id, job.job_type)
      results.push(rowResult)
      if (rowResult.status === 'error') errorRows++
      else successRows++
    }

    await query(
      `UPDATE bulk_import_jobs
       SET status = 'preview', row_results = $1, total_rows = $2, success_rows = $3, error_rows = $4
       WHERE id = $5`,
      [JSON.stringify(results), rows.length, successRows, errorRows, jobId],
    )
  } catch (err) {
    await query(
      `UPDATE bulk_import_jobs SET status = 'failed' WHERE id = $1`,
      [jobId],
    )
    throw err
  }
}

export async function commitBulkImport(jobId: string, userId: string): Promise<void> {
  const job = await queryOne<{
    id: string; user_id: string; job_type: string; row_results: BulkRowResult[]
  }>(
    `SELECT id, user_id, job_type, row_results FROM bulk_import_jobs
     WHERE id = $1 AND status = 'preview'`,
    [jobId],
  )
  if (!job) throw new Error('Job not found or not in preview state')
  if (job.user_id !== userId) throw new Error('Unauthorized')

  await withTransaction(async (client) => {
    for (const row of job.row_results) {
      if (row.status === 'error') continue
      const d = row.data as any

      if (job.job_type === 'create') {
        const obj = await client.query(
          `INSERT INTO objectives
             (title, description, level, owner_id, department, team,
              cycle_id, status, visibility, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
          [
            d.title, d.description ?? null, d.level, d.owner_id ?? job.user_id,
            d.department ?? null, d.team ?? null, d.cycle_id,
            d.level !== 'individual' ? 'pending_approval' : 'active',
            d.visibility ?? 'public', job.user_id,
          ],
        )
        row.createdId = obj.rows[0]?.id
      } else if (job.job_type === 'update' && d.key_result_id && d.new_value !== undefined) {
        await client.query(
          'UPDATE key_results SET current_value = $1, updated_at = NOW() WHERE id = $2',
          [d.new_value, d.key_result_id],
        )
      }
    }
  })

  await query(
    `UPDATE bulk_import_jobs SET status = 'committed', committed_at = NOW() WHERE id = $1`,
    [jobId],
  )
}

async function validateAndParseRow(
  row: Record<string, unknown>,
  rowNum: number,
  userId: string,
  jobType: string,
): Promise<BulkRowResult> {
  const errors: string[] = []
  const warnings: string[] = []

  if (jobType === 'create') {
    if (!row['title']) errors.push('title is required')
    if (!row['level']) errors.push('level is required')
    else if (!['company', 'department', 'team', 'individual'].includes(String(row['level']))) {
      errors.push('level must be company, department, team, or individual')
    }
    if (!row['cycle_id']) errors.push('cycle_id is required')
    if (!row['department'] && row['level'] === 'department') warnings.push('department not set')
  } else if (jobType === 'update') {
    if (!row['key_result_id']) errors.push('key_result_id is required')
    if (row['new_value'] === undefined || row['new_value'] === '') errors.push('new_value is required')
  }

  return {
    rowNumber: rowNum,
    status: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'success',
    data: { ...row, owner_id: userId },
    errors,
    warnings,
  }
}
