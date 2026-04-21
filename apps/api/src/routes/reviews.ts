import { Router } from 'express'
import { requireAuth, requireMinRole } from '../middleware/auth.js'
import { query, queryOne, queryMany, withTransaction } from '../db/client.js'
import { AppError } from '../middleware/error.js'
import { sendNotification } from '../slack/notifications.js'

const router = Router()
router.use(requireAuth)

// ═══════════════════════════════════════════════════════════════════════════════
// REVIEW ITEMS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /reviews — list review items for current user (as reviewer)
router.get('/reviews', async (req, res, next) => {
  try {
    const { status } = req.query as { status?: string }

    const conditions: string[] = ['ri.reviewer_id = $1']
    const params: unknown[] = [req.user!.sub]

    if (status) {
      params.push(status)
      conditions.push(`ri.status = $${params.length}`)
    }

    const rows = await queryMany(
      `SELECT
         ri.id,
         ri.review_cycle_id,
         ri.objective_id,
         ri.reviewer_id,
         ri.status,
         ri.note,
         ri.submitted_at,
         ri.reviewed_at,
         o.title AS objective_title,
         rc.name AS cycle_name,
         rc.name AS review_cycle_name,
         rc.review_date
       FROM review_items ri
       JOIN objectives o ON o.id = ri.objective_id
       JOIN review_cycles rc ON rc.id = ri.review_cycle_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY rc.review_date DESC, o.title`,
      params,
    )

    res.json({ data: rows })
  } catch (err) { next(err) }
})

// POST /reviews/:id/submit — submit a review item (set status=submitted)
router.post('/reviews/:id/submit', async (req, res, next) => {
  try {
    const { note } = req.body as { note?: string }

    const updated = await queryOne(
      `UPDATE review_items
       SET status = 'submitted', note = $1, submitted_at = NOW()
       WHERE id = $2 AND reviewer_id = $3
       RETURNING *`,
      [note ?? null, req.params['id'], req.user!.sub],
    )

    if (!updated) throw new AppError('NOT_FOUND', 'Review item not found or not assigned to you', 404)

    res.json({ data: updated })
  } catch (err) { next(err) }
})

// POST /reviews/:id/decide — approve or request revision (managers/admins)
router.post('/reviews/:id/decide', requireMinRole('team_lead'), async (req, res, next) => {
  try {
    const { action, note } = req.body as { action: 'approved' | 'revision_requested'; note?: string }

    if (!action || !['approved', 'revision_requested'].includes(action)) {
      throw new AppError('VALIDATION_ERROR', 'action must be "approved" or "revision_requested"', 400)
    }

    const item = await queryOne(
      'SELECT id FROM review_items WHERE id = $1',
      [req.params['id']],
    )
    if (!item) throw new AppError('NOT_FOUND', 'Review item not found', 404)

    const updated = await queryOne(
      `UPDATE review_items
       SET status = $1, note = $2, reviewed_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [action, note ?? null, req.params['id']],
    )

    res.json({ data: updated })
  } catch (err) { next(err) }
})

// ═══════════════════════════════════════════════════════════════════════════════
// REVIEW CYCLES (admin only)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /review-cycles — list all review cycles
router.get('/review-cycles', requireMinRole('admin'), async (_req, res, next) => {
  try {
    const rows = await queryMany(
      'SELECT * FROM review_cycles ORDER BY review_date DESC, created_at DESC',
    )
    res.json({ data: rows })
  } catch (err) { next(err) }
})

// POST /review-cycles — create review cycle and auto-populate review_items
router.post('/review-cycles', requireMinRole('admin'), async (req, res, next) => {
  try {
    const { cycleId, name, reviewDate, scope, department, team } = req.body as {
      cycleId: string
      name: string
      reviewDate: string
      scope: 'company' | 'department' | 'team'
      department?: string
      team?: string
    }

    if (!cycleId || !name || !reviewDate || !scope) {
      throw new AppError('VALIDATION_ERROR', 'cycleId, name, reviewDate, and scope are required', 400)
    }

    if (!['company', 'department', 'team'].includes(scope)) {
      throw new AppError('VALIDATION_ERROR', 'scope must be "company", "department", or "team"', 400)
    }

    if (scope === 'department' && !department) {
      throw new AppError('VALIDATION_ERROR', 'department is required when scope is "department"', 400)
    }

    if (scope === 'team' && !team) {
      throw new AppError('VALIDATION_ERROR', 'team is required when scope is "team"', 400)
    }

    const reviewerId = req.user!.sub

    await withTransaction(async (client) => {
      // Create the review cycle
      const cycle = await client.query(
        `INSERT INTO review_cycles (cycle_id, name, review_date, scope, department, team, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [cycleId, name, reviewDate, scope, department ?? null, team ?? null, reviewerId],
      )
      const newCycle = cycle.rows[0]

      // Build the objectives filter based on scope
      let objectivesQuery: string
      const objectivesParams: unknown[] = []

      if (scope === 'company') {
        objectivesQuery = `SELECT id FROM objectives WHERE status = 'active'`
      } else if (scope === 'department') {
        objectivesParams.push(department)
        objectivesQuery = `SELECT id FROM objectives WHERE status = 'active' AND department = $1`
      } else {
        // team scope
        objectivesParams.push(team)
        objectivesQuery = `SELECT id FROM objectives WHERE status = 'active' AND team = $1`
      }

      const objectives = await client.query(objectivesQuery, objectivesParams)

      // Insert review_items for each objective
      for (const obj of objectives.rows) {
        await client.query(
          `INSERT INTO review_items (review_cycle_id, objective_id, reviewer_id, status)
           VALUES ($1, $2, $3, 'pending')
           ON CONFLICT DO NOTHING`,
          [newCycle.id, obj.id, reviewerId],
        )
      }

      // Notify reviewer
      sendNotification(reviewerId, 'review_request', {
        reviewCycleName: name, reviewDate, objectiveCount: objectives.rows.length,
      }).catch(() => {})

      res.status(201).json({ data: newCycle })
    })
  } catch (err) { next(err) }
})

export default router
