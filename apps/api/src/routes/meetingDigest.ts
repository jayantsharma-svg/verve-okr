import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { queryOne, query } from '../db/client.js'
import { runMeetingDigest } from '../workers/meetingDigest.js'

const router = Router()
router.use(requireAuth)

// GET /meeting-digest/settings
router.get('/settings', async (req, res, next) => {
  try {
    const row = await queryOne(
      'SELECT user_id, enabled, lead_time_minutes, calendar_id, updated_at FROM meeting_digest_settings WHERE user_id = $1',
      [req.user!.sub],
    )
    res.json({ data: row ?? null })
  } catch (err) { next(err) }
})

// PATCH /meeting-digest/settings
router.patch('/settings', async (req, res, next) => {
  try {
    const { enabled, leadTimeMinutes, calendarId } = req.body as {
      enabled?: boolean
      leadTimeMinutes?: number
      calendarId?: string | null
    }
    const row = await queryOne(
      `INSERT INTO meeting_digest_settings (user_id, enabled, lead_time_minutes, calendar_id, updated_at)
       VALUES ($1, COALESCE($2, FALSE), COALESCE($3, 60), $4, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         enabled           = COALESCE($2, meeting_digest_settings.enabled),
         lead_time_minutes = COALESCE($3, meeting_digest_settings.lead_time_minutes),
         calendar_id       = COALESCE($4, meeting_digest_settings.calendar_id),
         updated_at        = NOW()
       RETURNING user_id, enabled, lead_time_minutes, calendar_id, updated_at`,
      [req.user!.sub, enabled ?? null, leadTimeMinutes ?? null, calendarId ?? null],
    )
    res.json({ data: row })
  } catch (err) { next(err) }
})

// POST /meeting-digest/test
router.post('/test', async (req, res, next) => {
  try {
    // Fire-and-forget — surface errors via console log inside the worker
    runMeetingDigest({ userId: req.user!.sub }).catch((err) =>
      console.error('[MeetingDigest] Test run error:', err),
    )
    res.json({ data: { message: 'Digest run triggered' } })
  } catch (err) { next(err) }
})

export default router
