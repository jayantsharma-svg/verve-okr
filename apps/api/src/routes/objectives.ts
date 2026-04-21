import { Router } from 'express'
import type { Request, Response } from 'express'
import {
  CreateObjectiveSchema,
  UpdateObjectiveSchema,
  ApproveObjectiveSchema,
  ListObjectivesSchema,
  CreateKeyResultSchema,
  UpdateKeyResultSchema,
  CreateCheckinSchema,
  InviteCollaboratorSchema,
  RespondCollaboratorSchema,
} from '@okr-tool/core'
import { query, queryOne, queryMany, withTransaction } from '../db/client.js'
import { requireAuth, requireMinRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { AppError } from '../middleware/error.js'
import { writeAudit, detectClient } from '../middleware/audit.js'
import { enqueueJob } from '../services/jobQueue.js'
import { sendNotification } from '../slack/notifications.js'

const router = Router()
router.use(requireAuth)

// ─── Helper: resolve visibility filter based on role ─────────────────────────

function buildVisibilityClause(userId: string, role: string, dept: string | null, team: string | null) {
  if (role === 'admin') return 'TRUE'
  // User can see: their own, public in their dept/team, or OKRs where they are collaborator
  return `(
    o.owner_id = '${userId}'
    OR (o.visibility = 'public' AND (o.department = '${dept}' OR o.team = '${team}' OR o.level = 'company'))
    OR EXISTS (
      SELECT 1 FROM okr_collaborators oc
      WHERE oc.objective_id = o.id AND oc.collaborator_user_id = '${userId}' AND oc.status = 'accepted'
    )
    OR EXISTS (
      SELECT 1 FROM okr_collaborators oc
      JOIN user_hierarchy uh ON uh.ancestor_id = '${userId}'
      WHERE oc.objective_id = o.id AND oc.collaborator_user_id = uh.descendant_id AND oc.status = 'accepted'
    )
  )`
}

// ─── List objectives ──────────────────────────────────────────────────────────

router.get('/', validate(ListObjectivesSchema, 'query'), async (req: Request, res: Response, next) => {
  try {
    const { cycleId, level, department, team, ownerId, status, search, page, perPage } = req.query as any
    const user = req.user!

    const userRow = await queryOne<{ department: string | null; team: string | null }>(
      'SELECT department, team FROM users WHERE id = $1',
      [user.sub],
    )

    const conditions: string[] = [
      `o.status != 'deleted'`,
      buildVisibilityClause(user.sub, user.role, userRow?.department ?? null, userRow?.team ?? null),
    ]
    const params: unknown[] = []

    if (cycleId) { params.push(cycleId); conditions.push(`o.cycle_id = $${params.length}`) }
    if (level) { params.push(level); conditions.push(`o.level = $${params.length}`) }
    if (department) { params.push(department); conditions.push(`o.department = $${params.length}`) }
    if (team) { params.push(team); conditions.push(`o.team = $${params.length}`) }
    if (ownerId) { params.push(ownerId); conditions.push(`o.owner_id = $${params.length}`) }
    if (status) { params.push(status); conditions.push(`o.status = $${params.length}`) }
    if (search) { params.push(`%${search}%`); conditions.push(`o.title ILIKE $${params.length}`) }

    const offset = (page - 1) * perPage
    params.push(perPage, offset)

    const rows = await queryMany(
      `SELECT o.*, u.name AS owner_name, u.email AS owner_email,
              COALESCE(
                (SELECT MAX(CASE kr.confidence WHEN 'off_track' THEN 2 WHEN 'at_risk' THEN 1 ELSE 0 END)
                 FROM key_results kr WHERE kr.objective_id = o.id AND kr.status != 'deleted'),
                0
              ) AS worst_confidence_rank,
              (SELECT COUNT(*) FROM key_results kr WHERE kr.objective_id = o.id AND kr.status != 'deleted') AS kr_count,
              (SELECT ROUND(AVG(CASE WHEN kr.target_value = kr.start_value THEN 0
                ELSE ((kr.current_value - kr.start_value) / NULLIF(kr.target_value - kr.start_value, 0)) * 100
               END)) FROM key_results kr WHERE kr.objective_id = o.id AND kr.status != 'deleted') AS avg_progress_pct,
              (SELECT s.overall_score FROM okr_smart_scores s WHERE s.objective_id = o.id ORDER BY s.scored_at DESC LIMIT 1) AS smart_overall_score
       FROM objectives o
       JOIN users u ON u.id = o.owner_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY o.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    )

    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM objectives o WHERE ${conditions.slice(0, conditions.length - 0).join(' AND ')}`,
      params.slice(0, params.length - 2),
    )

    res.json({ data: rows, meta: { total: parseInt(countResult?.count ?? '0'), page, perPage } })
  } catch (err) {
    next(err)
  }
})

// ─── Get single objective with KRs ───────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const objective = await queryOne(
      `SELECT o.*, u.name AS owner_name, u.email AS owner_email,
              p.title AS parent_title
       FROM objectives o
       JOIN users u ON u.id = o.owner_id
       LEFT JOIN objectives p ON p.id = o.parent_objective_id
       WHERE o.id = $1 AND o.status != 'deleted'`,
      [req.params['id']],
    )
    if (!objective) throw new AppError('NOT_FOUND', 'Objective not found', 404)

    const keyResults = await queryMany(
      `SELECT kr.*, u.name AS owner_name FROM key_results kr
       JOIN users u ON u.id = kr.owner_id
       WHERE kr.objective_id = $1 AND kr.status != 'deleted' ORDER BY kr.created_at`,
      [req.params['id']],
    )

    // Attach check-ins to each KR
    const krIds = (keyResults as any[]).map((kr: any) => kr.id)
    const allCheckins = krIds.length
      ? await queryMany(
          `SELECT c.*, u.name AS author_name FROM checkins c
           JOIN users u ON u.id = c.author_id
           WHERE c.key_result_id = ANY($1::uuid[])
           ORDER BY c.created_at DESC`,
          [krIds],
        )
      : []
    const checkinsByKr: Record<string, any[]> = {}
    for (const c of allCheckins as any[]) {
      if (!checkinsByKr[c.key_result_id]) checkinsByKr[c.key_result_id] = []
      checkinsByKr[c.key_result_id].push(c)
    }
    const keyResultsWithCheckins = (keyResults as any[]).map((kr: any) => ({
      ...kr,
      checkins: checkinsByKr[kr.id] ?? [],
    }))

    const collaborators = await queryMany(
      `SELECT oc.*, u.name, u.email FROM okr_collaborators oc
       JOIN users u ON u.id = oc.collaborator_user_id
       WHERE oc.objective_id = $1`,
      [req.params['id']],
    )

    const smartScore = await queryOne(
      `SELECT * FROM okr_smart_scores WHERE objective_id = $1 ORDER BY scored_at DESC LIMIT 1`,
      [req.params['id']],
    )

    res.json({ data: { ...objective, keyResults: keyResultsWithCheckins, collaborators, smartScore } })
  } catch (err) {
    next(err)
  }
})

// ─── Get objective alignment tree ────────────────────────────────────────────

router.get('/:id/tree', async (req: Request, res: Response, next) => {
  try {
    const rows = await queryMany(
      `WITH RECURSIVE tree AS (
         SELECT o.id, o.title, o.level, o.status, o.owner_id, o.parent_objective_id, 0 AS depth
         FROM objectives o WHERE o.id = $1 AND o.status != 'deleted'
         UNION ALL
         SELECT o.id, o.title, o.level, o.status, o.owner_id, o.parent_objective_id, t.depth + 1
         FROM objectives o JOIN tree t ON o.parent_objective_id = t.id
         WHERE o.status != 'deleted' AND t.depth < 5
       )
       SELECT t.*, u.name AS owner_name FROM tree t JOIN users u ON u.id = t.owner_id`,
      [req.params['id']],
    )
    res.json({ data: rows })
  } catch (err) {
    next(err)
  }
})

// ─── Create objective ─────────────────────────────────────────────────────────

router.post('/', validate(CreateObjectiveSchema), async (req: Request, res: Response, next) => {
  try {
    const body = req.body
    const user = req.user!

    // Determine approval status: individual = active immediately, team+ = pending_approval
    const requiresApproval = body.level !== 'individual'
    const status = requiresApproval ? 'pending_approval' : 'active'

    const objective = await queryOne(
      `INSERT INTO objectives
         (title, description, level, owner_id, department, team,
          parent_objective_id, cycle_id, status, visibility, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        body.title, body.description ?? null, body.level, user.sub,
        body.department ?? null, body.team ?? null, body.parentObjectiveId ?? null,
        body.cycleId, status, body.visibility ?? 'public', user.sub,
      ],
    )

    // Enqueue SMART+ scoring
    await enqueueJob('smart_score', { objectiveId: (objective as any).id })

    await writeAudit({
      actorId: user.sub, action: 'create', entityType: 'objective',
      entityId: (objective as any).id, newJson: objective as any,
      client: detectClient(req),
    })

    res.status(201).json({ data: objective })
  } catch (err) {
    next(err)
  }
})

// ─── Update objective ─────────────────────────────────────────────────────────

router.patch('/:id', validate(UpdateObjectiveSchema), async (req: Request, res: Response, next) => {
  try {
    const user = req.user!
    const existing = await queryOne<{ owner_id: string; status: string }>(
      'SELECT owner_id, status FROM objectives WHERE id = $1',
      [req.params['id']],
    )
    if (!existing) throw new AppError('NOT_FOUND', 'Objective not found', 404)

    // Only owner or admin can update
    if (existing.owner_id !== user.sub && user.role !== 'admin') {
      throw new AppError('FORBIDDEN', 'Only the owner can update this objective', 403)
    }

    const body = req.body
    const updated = await queryOne(
      `UPDATE objectives SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         parent_objective_id = COALESCE($3, parent_objective_id),
         visibility = COALESCE($4, visibility),
         status = COALESCE($5, status),
         updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [body.title, body.description, body.parentObjectiveId, body.visibility, body.status, req.params['id']],
    )

    // Re-score if title/description changed significantly
    if (body.title || body.description) {
      await enqueueJob('smart_score', { objectiveId: req.params['id'] })
    }

    await writeAudit({
      actorId: user.sub, action: 'update', entityType: 'objective',
      entityId: req.params['id'], oldJson: existing as any, newJson: updated as any,
      client: detectClient(req),
    })

    res.json({ data: updated })
  } catch (err) {
    next(err)
  }
})

// ─── Approve / Reject / Send back ─────────────────────────────────────────────

router.post('/:id/approval', validate(ApproveObjectiveSchema), async (req: Request, res: Response, next) => {
  try {
    const user = req.user!
    const { action, reason } = req.body as { action: string; reason?: string }

    const objective = await queryOne<{ id: string; level: string; owner_id: string; status: string }>(
      'SELECT id, level, owner_id, status FROM objectives WHERE id = $1',
      [req.params['id']],
    )
    if (!objective) throw new AppError('NOT_FOUND', 'Objective not found', 404)
    if (objective.status !== 'pending_approval') {
      throw new AppError('CONFLICT', 'Objective is not pending approval', 409)
    }

    // Only team_lead+ can approve
    if (!['admin', 'dept_lead', 'team_lead'].includes(user.role)) {
      throw new AppError('FORBIDDEN', 'Insufficient permissions to approve', 403)
    }

    let newStatus: string
    let rejectionReason: string | null = null
    if (action === 'approve') newStatus = 'active'
    else if (action === 'reject') { newStatus = 'closed'; rejectionReason = reason ?? null }
    else { newStatus = 'draft'; rejectionReason = reason ?? null } // send_back

    const updated = await queryOne(
      `UPDATE objectives SET status = $1, rejection_reason = $2,
       approved_by = $3, approved_at = CASE WHEN $1 = 'active' THEN NOW() ELSE NULL END,
       updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [newStatus, rejectionReason, user.sub, req.params['id']],
    )

    await writeAudit({
      actorId: user.sub, action: action === 'approve' ? 'approve' : 'reject',
      entityType: 'objective', entityId: req.params['id'],
      client: detectClient(req),
    })

    res.json({ data: updated })
  } catch (err) {
    next(err)
  }
})

// ─── Soft delete ──────────────────────────────────────────────────────────────

router.delete('/:id', async (req: Request, res: Response, next) => {
  try {
    const user = req.user!
    const objective = await queryOne<{ owner_id: string }>(
      'SELECT owner_id FROM objectives WHERE id = $1',
      [req.params['id']],
    )
    if (!objective) throw new AppError('NOT_FOUND', 'Objective not found', 404)
    if (objective.owner_id !== user.sub && user.role !== 'admin') {
      throw new AppError('FORBIDDEN', 'Only the owner can delete this objective', 403)
    }
    await query(
      `UPDATE objectives SET status = 'deleted', updated_at = NOW() WHERE id = $1`,
      [req.params['id']],
    )
    await writeAudit({ actorId: user.sub, action: 'delete', entityType: 'objective', entityId: req.params['id'] })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// KEY RESULTS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/:id/key-results', async (req: Request, res: Response, next) => {
  try {
    const rows = await queryMany(
      `SELECT kr.*, u.name AS owner_name, u.email AS owner_email
       FROM key_results kr JOIN users u ON u.id = kr.owner_id
       WHERE kr.objective_id = $1 ORDER BY kr.created_at`,
      [req.params['id']],
    )
    res.json({ data: rows })
  } catch (err) {
    next(err)
  }
})

router.post('/:id/key-results', validate(CreateKeyResultSchema), async (req: Request, res: Response, next) => {
  try {
    const user = req.user!
    const body = req.body
    const ownerId = body.ownerId ?? user.sub

    const kr = await queryOne(
      `INSERT INTO key_results
         (objective_id, title, description, owner_id, metric_type,
          start_value, target_value, current_value, unit)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$6,$8) RETURNING *`,
      [req.params['id'], body.title, body.description ?? null, ownerId,
       body.metricType, body.startValue, body.targetValue, body.unit ?? null],
    )
    await writeAudit({
      actorId: user.sub, action: 'create', entityType: 'key_result',
      entityId: (kr as any).id, newJson: kr as any, client: detectClient(req),
    })
    res.status(201).json({ data: kr })
  } catch (err) {
    next(err)
  }
})

// ─── Check-ins ────────────────────────────────────────────────────────────────

router.post('/:objectiveId/key-results/:krId/checkins', validate(CreateCheckinSchema), async (req: Request, res: Response, next) => {
  try {
    const user = req.user!
    const { krId } = req.params
    const { newValue, confidence, note } = req.body as { newValue: number; confidence: string; note?: string }

    const kr = await queryOne<{ current_value: number; title: string; owner_id: string; confidence: string }>(
      'SELECT current_value, title, owner_id, confidence FROM key_results WHERE id = $1',
      [krId],
    )
    if (!kr) throw new AppError('NOT_FOUND', 'Key result not found', 404)

    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO checkins (key_result_id, author_id, previous_value, new_value, confidence, note)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [krId, user.sub, kr.current_value, newValue, confidence, note ?? null],
      )
      await client.query(
        `UPDATE key_results SET current_value = $1, confidence = $2,
         last_checkin_at = NOW(), updated_at = NOW() WHERE id = $3`,
        [newValue, confidence, krId],
      )
    })

    await writeAudit({
      actorId: user.sub, action: 'checkin', entityType: 'key_result', entityId: krId,
      oldJson: { value: kr.current_value }, newJson: { value: newValue, confidence },
      client: detectClient(req),
    })

    // Fire at-risk alert if confidence degraded
    if (['at_risk', 'off_track'].includes(confidence) && kr.confidence === 'on_track') {
      sendNotification(kr.owner_id, 'at_risk_alert', {
        krTitle: kr.title, confidence, newValue,
      }).catch(() => {})
    }

    res.status(201).json({ data: { message: 'Check-in recorded', newValue, confidence } })
  } catch (err) {
    next(err)
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// COLLABORATORS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/:id/collaborators', async (req: Request, res: Response, next) => {
  try {
    const rows = await queryMany(
      `SELECT oc.*, u.name, u.email FROM okr_collaborators oc
       JOIN users u ON u.id = oc.collaborator_user_id
       WHERE oc.objective_id = $1`,
      [req.params['id']],
    )
    res.json({ data: rows })
  } catch (err) {
    next(err)
  }
})

router.post('/:id/collaborators', validate(InviteCollaboratorSchema), async (req: Request, res: Response, next) => {
  try {
    const user = req.user!
    const { collaboratorUserId } = req.body as { collaboratorUserId: string }

    const objective = await queryOne<{ owner_id: string }>(
      'SELECT owner_id FROM objectives WHERE id = $1',
      [req.params['id']],
    )
    if (!objective) throw new AppError('NOT_FOUND', 'Objective not found', 404)
    if (objective.owner_id !== user.sub && user.role !== 'admin') {
      throw new AppError('FORBIDDEN', 'Only the owner can add collaborators', 403)
    }

    const collab = await queryOne(
      `INSERT INTO okr_collaborators (objective_id, invited_by, collaborator_user_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (objective_id, collaborator_user_id) DO NOTHING
       RETURNING *`,
      [req.params['id'], user.sub, collaboratorUserId],
    )

    if (collab) {
      const obj = await queryOne<{ title: string }>('SELECT title FROM objectives WHERE id = $1', [req.params['id']])
      sendNotification(collaboratorUserId, 'collaborator_request', {
        objectiveTitle: (obj as any)?.title, invitedByName: req.user!.sub,
      }).catch(() => {})
    }

    res.status(201).json({ data: collab })
  } catch (err) {
    next(err)
  }
})

router.delete('/:id/collaborators/:userId', async (req: Request, res: Response, next) => {
  try {
    const user = req.user!
    await query(
      `DELETE FROM okr_collaborators WHERE objective_id = $1 AND collaborator_user_id = $2`,
      [req.params['id'], req.params['userId']],
    )
    await writeAudit({ actorId: user.sub, action: 'update', entityType: 'collaborator', entityId: req.params['id'] })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

export default router
