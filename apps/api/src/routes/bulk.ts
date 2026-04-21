/**
 * Bulk import routes.
 * Files are processed in-memory (no GCS in dev).
 */
import { Router } from 'express'
import multer from 'multer'
import * as XLSX from 'xlsx'
import { requireAuth } from '../middleware/auth.js'
import { query, queryOne, queryMany, withTransaction } from '../db/client.js'
import { AppError } from '../middleware/error.js'
import type { BulkRowResult } from '@okr-tool/core'

const router = Router()
router.use(requireAuth)

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

// ─── Template download ────────────────────────────────────────────────────────

router.get('/templates/download', (req, res) => {
  const type = (req.query['type'] as string) ?? 'create'
  const wb = XLSX.utils.book_new()

  let headers: string[]
  let example: Record<string, string>

  if (type === 'create') {
    headers = ['title', 'description', 'level', 'department', 'team', 'cycle_id', 'visibility', 'owner_email']
    example = {
      title: 'Example OKR title',
      description: 'Optional description',
      level: 'department',
      department: 'Engineering',
      team: '',
      cycle_id: '(paste cycle UUID here)',
      visibility: 'public',
      owner_email: 'owner@capillary.com',
    }
  } else {
    headers = ['key_result_id', 'new_value', 'note']
    example = {
      key_result_id: '(paste KR UUID here)',
      new_value: '42',
      note: 'Optional check-in note',
    }
  }

  const ws = XLSX.utils.json_to_sheet([example], { header: headers })
  XLSX.utils.book_append_sheet(wb, ws, 'Template')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename=okr_${type}_template.xlsx`)
  res.send(buffer)
})

// ─── Upload & validate ────────────────────────────────────────────────────────

router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    const user = req.user!
    const jobType = (req.body as any).jobType as 'create' | 'update'
    if (!req.file) throw new AppError('VALIDATION_ERROR', 'No file uploaded', 400)
    if (!['create', 'update'].includes(jobType)) {
      throw new AppError('VALIDATION_ERROR', 'jobType must be create or update', 400)
    }

    // Parse file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]!]!
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

    if (rows.length === 0) throw new AppError('VALIDATION_ERROR', 'File contains no rows', 400)
    if (rows.length > 500) throw new AppError('VALIDATION_ERROR', 'File exceeds 500 rows', 400)

    // Validate rows
    const results: BulkRowResult[] = []
    let successRows = 0
    let errorRows = 0

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!
      const rowResult = await validateRow(row, i + 2, user.sub, jobType)
      results.push(rowResult)
      if (rowResult.status === 'error') errorRows++
      else successRows++
    }

    // Persist job
    const job = await queryOne<{ id: string }>(
      `INSERT INTO bulk_import_jobs
         (user_id, job_type, file_name, file_storage_path, total_rows, success_rows, error_rows, row_results, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'preview') RETURNING id`,
      [
        user.sub, jobType, req.file.originalname, '',
        rows.length, successRows, errorRows,
        JSON.stringify(results),
      ],
    )

    res.json({ data: { id: (job as any).id, jobType, totalRows: rows.length, successRows, errorRows, rowResults: results, status: 'preview' } })
  } catch (err) { next(err) }
})

// ─── Get job ──────────────────────────────────────────────────────────────────

router.get('/jobs/:id', async (req, res, next) => {
  try {
    const job = await queryOne(
      'SELECT * FROM bulk_import_jobs WHERE id = $1 AND user_id = $2',
      [req.params['id'], req.user!.sub],
    )
    if (!job) throw new AppError('NOT_FOUND', 'Job not found', 404)
    res.json({ data: job })
  } catch (err) { next(err) }
})

// ─── Commit ───────────────────────────────────────────────────────────────────

router.post('/commit', async (req, res, next) => {
  try {
    const user = req.user!
    const { jobId } = req.body as { jobId: string }

    const job = await queryOne<{
      id: string; user_id: string; job_type: string; row_results: any; status: string
    }>(
      'SELECT * FROM bulk_import_jobs WHERE id = $1',
      [jobId],
    )
    if (!job) throw new AppError('NOT_FOUND', 'Job not found', 404)
    if ((job as any).user_id !== user.sub && user.role !== 'admin') {
      throw new AppError('FORBIDDEN', 'Forbidden', 403)
    }
    if ((job as any).status !== 'preview') {
      throw new AppError('CONFLICT', 'Job is not in preview state', 409)
    }

    const rowResults: BulkRowResult[] = typeof (job as any).row_results === 'string'
      ? JSON.parse((job as any).row_results)
      : (job as any).row_results

    await withTransaction(async (client) => {
      for (const row of rowResults) {
        if (row.status === 'error') continue
        const d = row.data as any

        if ((job as any).job_type === 'create') {
          // Resolve owner_id from email if provided
          let ownerId = user.sub
          if (d.owner_email) {
            const owner = await client.query(
              'SELECT id FROM users WHERE email = $1 AND is_active = TRUE',
              [d.owner_email],
            )
            if (owner.rows[0]) ownerId = owner.rows[0].id
          }

          const objResult = await client.query(
            `INSERT INTO objectives
               (title, description, level, owner_id, department, team,
                cycle_id, status, visibility, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
            [
              d.title, d.description ?? null, d.level, ownerId,
              d.department ?? null, d.team ?? null, d.cycle_id,
              d.level !== 'individual' ? 'pending_approval' : 'active',
              d.visibility ?? 'public', user.sub,
            ],
          )
          row.createdId = objResult.rows[0]?.id
        } else if ((job as any).job_type === 'update') {
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

    res.json({ data: { status: 'committed', jobId } })
  } catch (err) { next(err) }
})

// ─── Row validator ────────────────────────────────────────────────────────────

async function validateRow(
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
      errors.push(`level "${row['level']}" is invalid (must be company/department/team/individual)`)
    }
    if (!row['cycle_id']) errors.push('cycle_id is required')
    if (row['level'] === 'department' && !row['department']) warnings.push('department not set')
    if (row['level'] === 'team' && !row['team']) warnings.push('team not set')
  } else {
    if (!row['key_result_id']) errors.push('key_result_id is required')
    if (row['new_value'] === undefined || row['new_value'] === '') {
      errors.push('new_value is required')
    } else if (isNaN(Number(row['new_value']))) {
      errors.push('new_value must be a number')
    }
  }

  return {
    rowNumber: rowNum,
    status: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'success',
    data: { ...row, owner_id: userId },
    errors,
    warnings,
  }
}

export default router
