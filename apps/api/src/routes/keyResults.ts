/**
 * Standalone /key-results routes.
 * The API client calls /key-results/:id directly (without the parent objective
 * in the path), so we expose these convenience routes that delegate to the same
 * logic as the nested /objectives/:objId/key-results/:krId handlers.
 */
import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { queryOne, queryMany, withTransaction } from '../db/client.js'
import { AppError } from '../middleware/errorHandler.js'
import { writeAudit, detectClient } from '../services/audit.js'
import { sendNotification } from '../services/notifications.js'
import { z } from 'zod'

const router = Router()
router.use(requireAuth)

const CreateCheckinSchema = z.object({
  newValue:   z.number(),
  confidence: z.enum(['on_track', 'at_risk', 'off_track']),
  note:       z.string().optional(),
})

const UpdateKeyResultSchema = z.object({
  title:       z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  targetValue: z.number().optional(),
  unit:        z.string().nullable().optional(),
  status:      z.string().optional(),
})

// ─── GET /key-results/:id/checkins ───────────────────────────────────────────
router.get('/:id/checkins', async (req: Request, res: Response, next) => {
  try {
    const rows = await queryMany(
      `SELECT c.*, u.name AS author_name
       FROM checkins c
       LEFT JOIN users u ON u.id = c.author_id
       WHERE c.key_result_id = $1
       ORDER BY c.created_at DESC`,
      [req.params['id']],
    )
    res.json({ data: rows })
  } catch (err) {
    next(err)
  }
})

// ─── POST /key-results/:id/checkins ──────────────────────────────────────────
router.post('/:id/checkins', validate(CreateCheckinSchema), async (req: Request, res: Response, next) => {
  try {
    const user = req.user!
    const krId = req.params['id']!
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

// ─── PATCH /key-results/:id ───────────────────────────────────────────────────
router.patch('/:id', validate(UpdateKeyResultSchema), async (req: Request, res: Response, next) => {
  try {
    const user = req.user!
    const krId = req.params['id']!

    const existing = await queryOne<{ owner_id: string }>(
      'SELECT owner_id FROM key_results WHERE id = $1',
      [krId],
    )
    if (!existing) throw new AppError('NOT_FOUND', 'Key result not found', 404)
    if (existing.owner_id !== user.sub && user.role !== 'admin') {
      throw new AppError('FORBIDDEN', 'Only the owner can update this key result', 403)
    }

    const { title, description, targetValue, unit, status } = req.body
    const updated = await queryOne(
      `UPDATE key_results SET
         title        = COALESCE($1, title),
         description  = COALESCE($2, description),
         target_value = COALESCE($3, target_value),
         unit         = COALESCE($4, unit),
         status       = COALESCE($5, status),
         updated_at   = NOW()
       WHERE id = $6 RETURNING *`,
      [title, description, targetValue, unit, status, krId],
    )

    await writeAudit({
      actorId: user.sub, action: 'update', entityType: 'key_result', entityId: krId,
      newJson: updated as any, client: detectClient(req),
    })

    res.json({ data: updated })
  } catch (err) {
    next(err)
  }
})

export { router as keyResultsRouter }
