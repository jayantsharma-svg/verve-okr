import { Router } from 'express'
import { requireAuth, requireMinRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { query, queryOne, queryMany, withTransaction } from '../db/client.js'
import { AppError } from '../middleware/error.js'
import {
  CreateAppraisalCycleSchema,
  SelfAppraisalSchema,
  ManagerFinalizeSchema,
  RequestFeedbackSchema,
  SubmitFeedbackSchema,
} from '@okr-tool/core'
import * as XLSX from 'xlsx'
import { sendNotification } from '../slack/notifications.js'

const router = Router()
router.use(requireAuth)

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Find or create the appraisal record for user in the active cycle */
async function getOrCreateRecord(cycleId: string, employeeId: string) {
  const existing = await queryOne<{ id: string }>(
    'SELECT id FROM appraisal_records WHERE cycle_id = $1 AND employee_id = $2',
    [cycleId, employeeId],
  )
  if (existing) return existing

  // Find manager
  const mgr = await queryOne<{ manager_id: string }>(
    `SELECT manager_id FROM users WHERE id = $1`,
    [employeeId],
  )
  const managerId = mgr?.manager_id ?? employeeId

  return queryOne<{ id: string }>(
    `INSERT INTO appraisal_records (cycle_id, employee_id, manager_id)
     VALUES ($1, $2, $3) ON CONFLICT (cycle_id, employee_id) DO NOTHING RETURNING id`,
    [cycleId, employeeId, managerId],
  )
}

async function activeCycle() {
  return queryOne<{ id: string; status: string }>(
    `SELECT id, status FROM appraisal_cycles
     WHERE status NOT IN ('draft','closed')
     ORDER BY created_at DESC LIMIT 1`,
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// APPRAISAL CYCLES (admin only)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/appraisal-cycles', async (req, res, next) => {
  try {
    const rows = await queryMany(
      'SELECT * FROM appraisal_cycles ORDER BY created_at DESC',
    )
    res.json({ data: rows })
  } catch (err) { next(err) }
})

router.post('/appraisal-cycles', requireMinRole('admin'), validate(CreateAppraisalCycleSchema), async (req, res, next) => {
  try {
    const { name, periodStart, periodEnd } = req.body
    const cycle = await queryOne(
      `INSERT INTO appraisal_cycles (name, period_start, period_end, created_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [name, periodStart, periodEnd, req.user!.sub],
    )
    res.status(201).json({ data: cycle })
  } catch (err) { next(err) }
})

const STATUS_FLOW: Record<string, string> = {
  draft: 'self_appraisal',
  self_appraisal: 'feedback_collection',
  feedback_collection: 'manager_review',
  manager_review: 'closed',
}

router.post('/appraisal-cycles/:id/advance', requireMinRole('admin'), async (req, res, next) => {
  try {
    const cycle = await queryOne<{ id: string; status: string }>(
      'SELECT id, status FROM appraisal_cycles WHERE id = $1',
      [req.params['id']],
    )
    if (!cycle) throw new AppError('NOT_FOUND', 'Cycle not found', 404)
    const next_status = STATUS_FLOW[(cycle as any).status]
    if (!next_status) throw new AppError('CONFLICT', 'Cycle is already closed', 409)
    const updated = await queryOne(
      `UPDATE appraisal_cycles SET status = $1 WHERE id = $2 RETURNING *`,
      [next_status, (cycle as any).id],
    )

    // Notify all employees with active appraisal records
    const employees = await queryMany<{ employee_id: string }>(
      'SELECT employee_id FROM appraisal_records WHERE cycle_id = $1',
      [(cycle as any).id],
    )
    for (const { employee_id } of employees as any[]) {
      sendNotification(employee_id, 'appraisal_update', {
        cycleName: (updated as any)?.name, newStatus: next_status,
      }).catch(() => {})
    }

    res.json({ data: updated })
  } catch (err) { next(err) }
})

// ═══════════════════════════════════════════════════════════════════════════════
// MY APPRAISAL RECORD
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/appraisals/me', async (req, res, next) => {
  try {
    const cycle = await activeCycle()
    if (!cycle) return res.json({ data: null })

    const record = await queryOne(
      `SELECT ar.*, u.name AS employee_name, u.email AS employee_email,
              u.department, u.team,
              m.name AS manager_name
       FROM appraisal_records ar
       JOIN users u ON u.id = ar.employee_id
       LEFT JOIN users m ON m.id = ar.manager_id
       WHERE ar.cycle_id = $1 AND ar.employee_id = $2`,
      [(cycle as any).id, req.user!.sub],
    )

    if (!record) {
      // Auto-create record
      await getOrCreateRecord((cycle as any).id, req.user!.sub)
      return res.json({ data: { cycleId: (cycle as any).id, cycleStatus: (cycle as any).status, selfSubmittedAt: null } })
    }

    // Include OKR comments and feedback requests
    const okrComments = await queryMany(
      `SELECT aoc.*, o.title AS objective_title FROM appraisal_okr_comments aoc
       JOIN objectives o ON o.id = aoc.objective_id
       WHERE aoc.appraisal_record_id = $1`,
      [(record as any).id],
    )
    const feedbackRequests = await queryMany(
      `SELECT afr.*, u.name AS provider_name FROM appraisal_feedback_requests afr
       JOIN users u ON u.id = afr.feedback_provider_id
       WHERE afr.appraisal_record_id = $1`,
      [(record as any).id],
    )

    res.json({ data: { ...(record as any), cycleStatus: (cycle as any).status, okrComments, feedbackRequests } })
  } catch (err) { next(err) }
})

// ─── Self-appraisal submission ────────────────────────────────────────────────

router.post('/appraisals/self', validate(SelfAppraisalSchema), async (req, res, next) => {
  try {
    const user = req.user!
    const cycle = await activeCycle()
    if (!cycle) throw new AppError('NOT_FOUND', 'No active appraisal cycle', 404)
    if ((cycle as any).status !== 'self_appraisal') {
      throw new AppError('CONFLICT', 'Self-appraisal is not currently open', 409)
    }

    const { selfAppraisalText, okrComments } = req.body

    let record = await queryOne<{ id: string }>(
      'SELECT id FROM appraisal_records WHERE cycle_id = $1 AND employee_id = $2',
      [(cycle as any).id, user.sub],
    )
    if (!record) {
      record = await getOrCreateRecord((cycle as any).id, user.sub) as any
    }
    if (!record) throw new AppError('INTERNAL_ERROR', 'Could not create appraisal record', 500)

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE appraisal_records SET self_appraisal_text = $1, self_submitted_at = NOW()
         WHERE id = $2`,
        [selfAppraisalText, (record as any).id],
      )
      for (const c of (okrComments ?? [])) {
        await client.query(
          `INSERT INTO appraisal_okr_comments (appraisal_record_id, objective_id, employee_comment)
           VALUES ($1,$2,$3)
           ON CONFLICT (appraisal_record_id, objective_id) DO UPDATE
           SET employee_comment = EXCLUDED.employee_comment`,
          [(record as any).id, c.objectiveId, c.employeeComment],
        )
      }
    })

    const updated = await queryOne('SELECT * FROM appraisal_records WHERE id = $1', [(record as any).id])
    res.json({ data: updated })
  } catch (err) { next(err) }
})

// ─── Feedback requests ────────────────────────────────────────────────────────

router.post('/appraisals/:id/feedback-requests', validate(RequestFeedbackSchema), async (req, res, next) => {
  try {
    const { feedbackProviderIds } = req.body
    const record = await queryOne<{ id: string; employee_id: string }>(
      'SELECT id, employee_id FROM appraisal_records WHERE id = $1',
      [req.params['id']],
    )
    if (!record) throw new AppError('NOT_FOUND', 'Record not found', 404)
    if ((record as any).employee_id !== req.user!.sub) {
      throw new AppError('FORBIDDEN', 'Not your appraisal record', 403)
    }

    for (const providerId of feedbackProviderIds) {
      await query(
        `INSERT INTO appraisal_feedback_requests (appraisal_record_id, requested_by, feedback_provider_id)
         VALUES ($1,$2,$3) ON CONFLICT (appraisal_record_id, feedback_provider_id) DO NOTHING`,
        [(record as any).id, req.user!.sub, providerId],
      )
    }
    res.json({ data: { message: 'Feedback requests sent' } })
  } catch (err) { next(err) }
})

// ─── Submit feedback (by provider) ───────────────────────────────────────────

router.post('/appraisal-feedback/:id/submit', validate(SubmitFeedbackSchema), async (req, res, next) => {
  try {
    const { feedbackText } = req.body
    const updated = await queryOne(
      `UPDATE appraisal_feedback_requests
       SET status = 'submitted', feedback_text = $1, submitted_at = NOW()
       WHERE id = $2 AND feedback_provider_id = $3 RETURNING *`,
      [feedbackText, req.params['id'], req.user!.sub],
    )
    if (!updated) throw new AppError('NOT_FOUND', 'Feedback request not found', 404)
    res.json({ data: updated })
  } catch (err) { next(err) }
})

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM (manager view)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/appraisals/team', async (req, res, next) => {
  try {
    const cycle = await activeCycle()
    if (!cycle) return res.json({ data: [] })

    const records = await queryMany(
      `SELECT ar.*, u.name AS employee_name, u.email AS employee_email,
              u.department, u.team, $3 AS cycle_status
       FROM appraisal_records ar
       JOIN users u ON u.id = ar.employee_id
       WHERE ar.manager_id = $1 AND ar.cycle_id = $2
       ORDER BY u.name`,
      [req.user!.sub, (cycle as any).id, (cycle as any).status],
    )
    res.json({ data: records })
  } catch (err) { next(err) }
})

router.post('/appraisals/:id/finalize', validate(ManagerFinalizeSchema), async (req, res, next) => {
  try {
    const user = req.user!
    const { rating, managerComments, okrComments } = req.body

    const record = await queryOne<{ id: string; manager_id: string }>(
      'SELECT id, manager_id FROM appraisal_records WHERE id = $1',
      [req.params['id']],
    )
    if (!record) throw new AppError('NOT_FOUND', 'Record not found', 404)
    if ((record as any).manager_id !== user.sub && user.role !== 'admin') {
      throw new AppError('FORBIDDEN', 'Not the manager of this record', 403)
    }

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE appraisal_records SET manager_rating = $1, manager_comments = $2,
         manager_finalized_at = NOW() WHERE id = $3`,
        [rating, managerComments, (record as any).id],
      )
      for (const c of (okrComments ?? [])) {
        await client.query(
          `INSERT INTO appraisal_okr_comments (appraisal_record_id, objective_id, manager_comment)
           VALUES ($1,$2,$3)
           ON CONFLICT (appraisal_record_id, objective_id) DO UPDATE
           SET manager_comment = EXCLUDED.manager_comment`,
          [(record as any).id, c.objectiveId, c.managerComment],
        )
      }
    })

    const updated = await queryOne('SELECT * FROM appraisal_records WHERE id = $1', [(record as any).id])
    res.json({ data: updated })
  } catch (err) { next(err) }
})

// ═══════════════════════════════════════════════════════════════════════════════
// HRBP REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/hrbp/appraisal-reports', requireMinRole('admin'), async (req, res, next) => {
  try {
    const { department, cycleId } = req.query as Record<string, string>
    const cycle = cycleId ? { id: cycleId } : await activeCycle()
    if (!cycle) return res.json({ data: [] })

    const conditions = [`ar.cycle_id = $1`]
    const params: unknown[] = [(cycle as any).id]
    if (department) { params.push(department); conditions.push(`u.department = $${params.length}`) }

    const records = await queryMany(
      `SELECT ar.*, u.name AS employee_name, u.email AS employee_email,
              u.department, u.team, m.name AS manager_name
       FROM appraisal_records ar
       JOIN users u ON u.id = ar.employee_id
       LEFT JOIN users m ON m.id = ar.manager_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY u.department, u.name`,
      params,
    )
    res.json({ data: records })
  } catch (err) { next(err) }
})

router.get('/hrbp/appraisal-reports/download', requireMinRole('admin'), async (req, res, next) => {
  try {
    const { department, cycleId } = req.query as Record<string, string>
    const cycle = cycleId ? { id: cycleId } : await activeCycle()
    if (!cycle) { res.status(404).json({ error: 'No active cycle' }); return }

    const records = await queryMany(
      `SELECT u.name AS employee, u.email, u.department, u.team, m.name AS manager,
              ar.manager_rating, ar.self_submitted_at, ar.manager_finalized_at,
              ar.overall_okr_achievement_pct
       FROM appraisal_records ar
       JOIN users u ON u.id = ar.employee_id
       LEFT JOIN users m ON m.id = ar.manager_id
       WHERE ar.cycle_id = $1 ${department ? 'AND u.department = $2' : ''}
       ORDER BY u.department, u.name`,
      department ? [(cycle as any).id, department] : [(cycle as any).id],
    )

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(records)
    XLSX.utils.book_append_sheet(wb, ws, 'Appraisal Report')
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename=appraisal_report.xlsx')
    res.send(buffer)
  } catch (err) { next(err) }
})

export default router
