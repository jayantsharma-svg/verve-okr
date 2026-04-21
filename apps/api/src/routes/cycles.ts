import { Router } from 'express'
import type { Request, Response } from 'express'
import { CreateCycleSchema, UpdateCycleStatusSchema } from '@okr-tool/core'
import { queryMany, queryOne, query } from '../db/client.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { AppError } from '../middleware/error.js'

const router = Router()
router.use(requireAuth)

router.get('/', async (_req: Request, res: Response, next) => {
  try {
    const rows = await queryMany(
      `SELECT c.*, u.name AS created_by_name
       FROM cycles c JOIN users u ON u.id = c.created_by
       ORDER BY c.start_date DESC`,
    )
    res.json({ data: rows })
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const cycle = await queryOne(
      'SELECT * FROM cycles WHERE id = $1',
      [req.params['id']],
    )
    if (!cycle) throw new AppError('NOT_FOUND', 'Cycle not found', 404)
    res.json({ data: cycle })
  } catch (err) {
    next(err)
  }
})

router.post('/', requireRole('admin'), validate(CreateCycleSchema), async (req: Request, res: Response, next) => {
  try {
    const body = req.body
    const cycle = await queryOne(
      `INSERT INTO cycles (name, type, start_date, end_date, department_override, team_override, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [body.name, body.type, body.startDate, body.endDate,
       body.departmentOverride ?? null, body.teamOverride ?? null, req.user!.sub],
    )
    res.status(201).json({ data: cycle })
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', requireRole('admin'), validate(UpdateCycleStatusSchema), async (req: Request, res: Response, next) => {
  try {
    const { status } = req.body as { status: string }
    const updated = await queryOne(
      'UPDATE cycles SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params['id']],
    )
    if (!updated) throw new AppError('NOT_FOUND', 'Cycle not found', 404)
    res.json({ data: updated })
  } catch (err) {
    next(err)
  }
})

export default router
