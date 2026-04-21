import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'

import authRouter from './routes/auth.js'
import objectivesRouter from './routes/objectives.js'
import cyclesRouter from './routes/cycles.js'
import bulkRouter from './routes/bulk.js'
import appraisalsRouter from './routes/appraisals.js'
import reviewsRouter from './routes/reviews.js'
import emailIntelligenceRouter from './routes/emailIntelligence.js'
import meetingDigestRouter from './routes/meetingDigest.js'
import adminSheetsRouter from './routes/adminSheets.js'
import { errorHandler, notFound } from './middleware/error.js'
import { requireAuth } from './middleware/auth.js'
import { handleJob } from './workers/jobHandler.js'
import { camelCaseResponse } from './middleware/camelCase.js'
import { initSlack } from './slack/index.js'
import { sendCheckinReminders } from './workers/checkinReminder.js'
import { exportToSheets } from './workers/sheetsExport.js'
import { syncGoogleDirectory } from './workers/orgSync.js'
import { runScheduledEmailScrapes } from './workers/emailScrape.js'

const app = express()
const PORT = parseInt(process.env['PORT'] ?? '3001', 10)

// ─── Security & parsing ───────────────────────────────────────────────────────
app.use(camelCaseResponse)
app.use(helmet())
app.use(cors({
  origin: process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
  credentials: true,
}))
app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())

// ─── Rate limiting ────────────────────────────────────────────────────────────
app.use('/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true }))
app.use(rateLimit({ windowMs: 60 * 1000, max: 200, standardHeaders: true }))

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }))

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/auth',                authRouter)
app.use('/objectives',         objectivesRouter)
app.use('/cycles',             cyclesRouter)
app.use('/bulk',               bulkRouter)
app.use('/',                   appraisalsRouter)
app.use('/',                   reviewsRouter)
app.use('/email-intelligence', emailIntelligenceRouter)
app.use('/meeting-digest',    meetingDigestRouter)
app.use('/admin/sheets',      adminSheetsRouter)

// ─── Me endpoints ─────────────────────────────────────────────────────────────
app.get('/me/collaborator-requests', requireAuth, async (req, res, next) => {
  try {
    const { queryMany } = await import('./db/client.js')
    const rows = await queryMany(
      `SELECT oc.*, o.title AS objective_title, u.name AS invited_by_name
       FROM okr_collaborators oc
       JOIN objectives o ON o.id = oc.objective_id
       JOIN users u ON u.id = oc.invited_by
       WHERE oc.collaborator_user_id = $1 AND oc.status = 'pending'`,
      [req.user!.sub],
    )
    res.json({ data: rows })
  } catch (err) { next(err) }
})

app.post('/me/collaborator-requests/:id/respond', requireAuth, async (req, res, next) => {
  try {
    const { query, queryOne } = await import('./db/client.js')
    const { decision } = req.body as { decision: 'accept' | 'decline' }
    const status = decision === 'accept' ? 'accepted' : 'declined'
    const updated = await queryOne(
      `UPDATE okr_collaborators SET status = $1, responded_at = NOW()
       WHERE id = $2 AND collaborator_user_id = $3 RETURNING *`,
      [status, req.params['id'], req.user!.sub],
    )
    res.json({ data: updated })
  } catch (err) { next(err) }
})

app.get('/me/notification-prefs', requireAuth, async (req, res, next) => {
  try {
    const { queryOne } = await import('./db/client.js')
    const prefs = await queryOne(
      'SELECT * FROM notification_prefs WHERE user_id = $1',
      [req.user!.sub],
    )
    res.json({ data: prefs })
  } catch (err) { next(err) }
})

app.patch('/me/notification-prefs', requireAuth, async (req, res, next) => {
  try {
    const { query } = await import('./db/client.js')
    const b = req.body as any
    await query(
      `INSERT INTO notification_prefs (user_id, channel, checkin_reminders, review_requests,
       at_risk_alerts, appraisal_updates, collaborator_requests)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (user_id) DO UPDATE SET
         channel = EXCLUDED.channel,
         checkin_reminders = COALESCE($3, notification_prefs.checkin_reminders),
         review_requests = COALESCE($4, notification_prefs.review_requests),
         at_risk_alerts = COALESCE($5, notification_prefs.at_risk_alerts),
         appraisal_updates = COALESCE($6, notification_prefs.appraisal_updates),
         collaborator_requests = COALESCE($7, notification_prefs.collaborator_requests),
         updated_at = NOW()`,
      [req.user!.sub, b.channel, b.checkinReminders, b.reviewRequests,
       b.atRiskAlerts, b.appraisalUpdates, b.collaboratorRequests],
    )
    res.json({ data: { message: 'Preferences updated' } })
  } catch (err) { next(err) }
})

// ─── Org endpoints ────────────────────────────────────────────────────────────
app.get('/org/users', requireAuth, async (req, res, next) => {
  try {
    const { queryMany } = await import('./db/client.js')
    const { search } = req.query as { search?: string }
    const rows = await queryMany(
      `SELECT id, email, name, department, team, role FROM users
       WHERE is_active = TRUE ${search ? `AND (name ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%')` : ''}
       ORDER BY name LIMIT 100`,
      search ? [search] : [],
    )
    res.json({ data: rows })
  } catch (err) { next(err) }
})

app.get('/org/departments', requireAuth, async (_req, res, next) => {
  try {
    const { queryMany } = await import('./db/client.js')
    const rows = await queryMany(
      'SELECT DISTINCT department FROM users WHERE department IS NOT NULL AND is_active = TRUE ORDER BY department',
    )
    res.json({ data: rows.map((r: any) => r.department) })
  } catch (err) { next(err) }
})

app.get('/org/teams', requireAuth, async (_req, res, next) => {
  try {
    const { queryMany } = await import('./db/client.js')
    const rows = await queryMany(
      'SELECT DISTINCT team FROM users WHERE team IS NOT NULL AND is_active = TRUE ORDER BY team',
    )
    res.json({ data: rows.map((r: any) => r.team) })
  } catch (err) { next(err) }
})

// ─── Export endpoint ──────────────────────────────────────────────────────────
app.get('/export/okrs', requireAuth, async (req, res, next) => {
  try {
    const { queryMany } = await import('./db/client.js')
    const XLSX = await import('xlsx')
    const { cycleId, department, team, ownerId } = req.query as Record<string, string>

    const conditions: string[] = []
    const params: unknown[] = []
    if (cycleId)    { params.push(cycleId);    conditions.push(`cycle = (SELECT name FROM cycles WHERE id = $${params.length})`) }
    if (department) { params.push(department); conditions.push(`department = $${params.length}`) }
    if (team)       { params.push(team);       conditions.push(`team = $${params.length}`) }
    if (ownerId)    { params.push(ownerId);    conditions.push(`owner_email = (SELECT email FROM users WHERE id = $${params.length})`) }

    // Non-admin users can only export their own hierarchy
    if (req.user!.role !== 'admin') {
      params.push(req.user!.email)
      conditions.push(`owner_email = $${params.length}`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const rows = await queryMany(`SELECT * FROM v_okr_export ${where} ORDER BY cycle, department, team, owner_name`, params)

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'OKR Data')
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename=okrs.xlsx')
    res.send(buffer)
  } catch (err) { next(err) }
})

// ─── Internal Cloud Tasks endpoint ────────────────────────────────────────────
app.post('/internal/tasks/run', async (req, res, next) => {
  try {
    const secret = req.headers['x-tasks-secret']
    if (secret !== process.env['INTERNAL_TASKS_SECRET']) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const { type, payload } = req.body as { type: string; payload: unknown }
    await handleJob(type, payload)
    res.json({ ok: true })
  } catch (err) { next(err) }
})

// ─── 404 + error handling ─────────────────────────────────────────────────────
app.use(notFound)
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`[API] Running on http://localhost:${PORT}`)
  initSlack(app)
  scheduleJobs()
})

// ─── Dev / prod scheduler ─────────────────────────────────────────────────────
// In production these are triggered by Cloud Scheduler → Cloud Tasks.
// In dev we use a lightweight setInterval so the jobs still run locally.

function scheduleJobs() {
  if (process.env['NODE_ENV'] === 'production') return  // Cloud Scheduler handles this

  const DAY_MS  = 24 * 60 * 60 * 1000
  const WEEK_MS =  7 * DAY_MS

  // Check-in reminders — weekly (Monday morning in prod, every 7 days in dev)
  setInterval(() => {
    console.log('[Scheduler] Running weekly check-in reminders…')
    sendCheckinReminders().catch(err => console.error('[Scheduler] checkin_reminder failed:', err))
  }, WEEK_MS)

  // Google Sheets export — nightly
  setInterval(() => {
    console.log('[Scheduler] Running nightly Sheets export…')
    exportToSheets({}).catch(err => console.error('[Scheduler] sheets_export failed:', err))
  }, DAY_MS)

  // Google Directory org sync — nightly (runs after sheets so hierarchy is fresh)
  setInterval(() => {
    console.log('[Scheduler] Running nightly org sync…')
    syncGoogleDirectory().catch(err => console.error('[Scheduler] org_sync failed:', err))
  }, DAY_MS)

  // Email scrape — daily, checks each user's schedule preference
  setInterval(() => {
    console.log('[Scheduler] Running scheduled email scrapes…')
    runScheduledEmailScrapes().catch(err => console.error('[Scheduler] scheduled_email_scrape failed:', err))
  }, DAY_MS)

  console.log('[Scheduler] Dev jobs scheduled (check-in: weekly | sheets: nightly | org sync: nightly | email scrape: daily)')
}

export default app
