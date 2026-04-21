import crypto from 'node:crypto'
import { Router } from 'express'
import { OAuth2Client } from 'google-auth-library'
import { requireAuth } from '../middleware/auth.js'
import { query, queryOne, queryMany } from '../db/client.js'
import { AppError } from '../middleware/error.js'
import { enqueueJob } from '../services/jobQueue.js'

const gmailOAuthClient = new OAuth2Client(
  process.env['GOOGLE_CLIENT_ID'],
  process.env['GOOGLE_CLIENT_SECRET'],
  `${process.env['API_URL']}/email-intelligence/gmail/callback`,
)

function signState(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ userId })).toString('base64')
  const sig = crypto
    .createHmac('sha256', process.env['INTERNAL_TASKS_SECRET']!)
    .update(payload)
    .digest('hex')
  return `${payload}.${sig}`
}

function verifyState(state: string): string {
  const dot = state.lastIndexOf('.')
  if (dot === -1) throw new AppError('INVALID_STATE', 'Invalid OAuth state', 400)
  const payload = state.slice(0, dot)
  const sig = state.slice(dot + 1)
  const expected = crypto
    .createHmac('sha256', process.env['INTERNAL_TASKS_SECRET']!)
    .update(payload)
    .digest('hex')
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new AppError('INVALID_STATE', 'Invalid OAuth state signature', 400)
  }
  return JSON.parse(Buffer.from(payload, 'base64').toString()).userId as string
}

const router = Router()

// All routes require authentication
router.use(requireAuth)

// GET /email-intelligence/consent
router.get('/consent', async (req, res, next) => {
  try {
    const row = await queryOne(
      'SELECT * FROM email_scraping_consent WHERE user_id = $1',
      [req.user!.sub],
    )
    res.json({ data: row ?? null })
  } catch (err) { next(err) }
})

// POST /email-intelligence/consent
router.post('/consent', async (req, res, next) => {
  try {
    const { consentLevel, schedule } = req.body as {
      consentLevel: 'none' | 'capture_all' | 'capture_confirm'
      schedule: 'manual' | 'end_of_day' | 'end_of_week' | 'end_of_period'
    }

    if (!consentLevel || !schedule) {
      throw new AppError(400, 'consentLevel and schedule are required')
    }

    // Get existing consent to check if consentLevel is changing from 'none'
    const existing = await queryOne(
      'SELECT consent_level FROM email_scraping_consent WHERE user_id = $1',
      [req.user!.sub],
    )

    const wasNone = !existing || existing.consent_level === 'none'
    const isNowActive = consentLevel !== 'none'
    const setEnabledAt = wasNone && isNowActive

    const row = await queryOne(
      `INSERT INTO email_scraping_consent (user_id, consent_level, schedule, enabled_at, updated_at)
       VALUES ($1, $2, $3, ${setEnabledAt ? 'NOW()' : 'NULL'}, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         consent_level = EXCLUDED.consent_level,
         schedule = EXCLUDED.schedule,
         enabled_at = CASE
           WHEN email_scraping_consent.consent_level = 'none' AND EXCLUDED.consent_level != 'none'
           THEN NOW()
           ELSE email_scraping_consent.enabled_at
         END,
         updated_at = NOW()
       RETURNING *`,
      [req.user!.sub, consentLevel, schedule],
    )

    res.json({ data: row })
  } catch (err) { next(err) }
})

// POST /email-intelligence/scrape
router.post('/scrape', async (req, res, next) => {
  try {
    const consent = await queryOne<{ consent_level: string }>(
      'SELECT consent_level FROM email_scraping_consent WHERE user_id = $1',
      [req.user!.sub],
    )
    if (!consent || consent.consent_level === 'none') {
      throw new AppError('FORBIDDEN', 'Email scraping consent not granted', 403)
    }

    const hasToken = await queryOne(
      `SELECT 1 FROM google_oauth_tokens
       WHERE user_id = $1 AND $2 = ANY(scopes)`,
      [req.user!.sub, 'https://www.googleapis.com/auth/gmail.readonly'],
    )
    if (!hasToken) {
      throw new AppError('GMAIL_NOT_CONNECTED', 'Gmail not connected — visit /email-intelligence/gmail/connect first', 400)
    }

    await enqueueJob('email_scrape', { userId: req.user!.sub, triggeredBy: 'manual' })
    res.json({ data: { message: 'Email scrape job queued.' } })
  } catch (err) { next(err) }
})

// GET /email-intelligence/extractions
router.get('/extractions', async (req, res, next) => {
  try {
    const rows = await queryMany(
      `SELECT ese.*, esj.triggered_by, esj.status AS job_status, esj.run_at, esj.completed_at
       FROM email_scrape_extractions ese
       JOIN email_scrape_jobs esj ON esj.id = ese.job_id
       WHERE esj.user_id = $1 AND ese.user_decision = 'pending'
       ORDER BY ese.created_at DESC`,
      [req.user!.sub],
    )
    res.json({ data: rows })
  } catch (err) { next(err) }
})

// POST /email-intelligence/extractions/:id/decide
router.post('/extractions/:id/decide', async (req, res, next) => {
  try {
    const { id } = req.params as { id: string }
    const { decision } = req.body as { decision: 'accepted' | 'rejected' }

    if (!decision || !['accepted', 'rejected'].includes(decision)) {
      throw new AppError(400, "decision must be 'accepted' or 'rejected'")
    }

    // Update the extraction decision
    const extraction = await queryOne(
      `UPDATE email_scrape_extractions ese
       SET user_decision = $1, decided_at = NOW()
       FROM email_scrape_jobs esj
       WHERE ese.id = $2
         AND ese.job_id = esj.id
         AND esj.user_id = $3
       RETURNING ese.*`,
      [decision, id, req.user!.sub],
    )

    if (!extraction) {
      throw new AppError(404, 'Extraction not found')
    }

    // If accepted and keyResultId exists, update the KR's current value
    if (decision === 'accepted') {
      const proposedUpdate = extraction.proposed_update as {
        keyResultId?: string
        newValue?: number
      }
      if (proposedUpdate?.keyResultId && proposedUpdate?.newValue !== undefined) {
        await query(
          'UPDATE key_results SET current_value = $1 WHERE id = $2',
          [proposedUpdate.newValue, proposedUpdate.keyResultId],
        )
      }
    }

    res.json({ data: extraction })
  } catch (err) { next(err) }
})

// GET /email-intelligence/gmail/status
router.get('/gmail/status', async (req, res, next) => {
  try {
    const row = await queryOne<{ updated_at: string }>(
      `SELECT updated_at FROM google_oauth_tokens
       WHERE user_id = $1 AND $2 = ANY(scopes)`,
      [req.user!.sub, 'https://www.googleapis.com/auth/gmail.readonly'],
    )
    res.json({ data: { connected: !!row, connectedAt: row?.updated_at ?? null } })
  } catch (err) { next(err) }
})

// GET /email-intelligence/gmail/connect
// Redirects the user to Google's consent screen to grant gmail.readonly access.
router.get('/gmail/connect', (req, res, next) => {
  try {
    const state = signState(req.user!.sub)
    const url = gmailOAuthClient.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/gmail.readonly'],
      prompt: 'consent',
      state,
    })
    res.redirect(url)
  } catch (err) { next(err) }
})

// GET /email-intelligence/gmail/callback
// Google redirects here after the user grants (or denies) access.
// No auth middleware — Google calls this directly.
router.get('/gmail/callback', async (req, res, next) => {
  try {
    const { code, state, error } = req.query as {
      code?: string; state?: string; error?: string
    }

    const frontendUrl = process.env['FRONTEND_URL']!

    if (error || !code || !state) {
      return res.redirect(`${frontendUrl}/email-intelligence?gmail_error=${error ?? 'missing_params'}`)
    }

    const userId = verifyState(state)

    const { tokens } = await gmailOAuthClient.getToken(code)
    if (!tokens.access_token || !tokens.refresh_token) {
      return res.redirect(`${frontendUrl}/email-intelligence?gmail_error=no_tokens`)
    }

    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString()

    await query(
      `INSERT INTO google_oauth_tokens (user_id, scopes, access_token, refresh_token, expires_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         scopes        = EXCLUDED.scopes,
         access_token  = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         expires_at    = EXCLUDED.expires_at,
         updated_at    = NOW()`,
      [
        userId,
        ['https://www.googleapis.com/auth/gmail.readonly'],
        tokens.access_token,
        tokens.refresh_token,
        expiresAt,
      ],
    )

    res.redirect(`${frontendUrl}/email-intelligence?gmail_connected=true`)
  } catch (err) { next(err) }
})

export default router
