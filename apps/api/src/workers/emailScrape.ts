/**
 * Email intelligence worker.
 * Reads Gmail, extracts OKR updates via Claude AI, and stores extractions for user review.
 */
import { google } from 'googleapis'
import { queryOne, queryMany, query } from '../db/client.js'
import { extractOkrUpdatesFromEmail } from '../services/claude.js'

export async function runEmailScrape(opts: {
  userId: string
  triggeredBy: string
}): Promise<void> {
  const consent = await queryOne<{
    consent_level: string
  }>(
    'SELECT consent_level FROM email_scraping_consent WHERE user_id = $1',
    [opts.userId],
  )
  if (!consent || consent.consent_level === 'none') return

  const tokenRow = await queryOne<{
    access_token: string; refresh_token: string; expires_at: string
  }>(
    `SELECT access_token, refresh_token, expires_at
     FROM google_oauth_tokens WHERE user_id = $1 AND $2 = ANY(scopes)`,
    [opts.userId, 'https://www.googleapis.com/auth/gmail.readonly'],
  )
  if (!tokenRow) {
    console.warn(`[EmailScrape] No Gmail token for user ${opts.userId}`)
    return
  }

  // Create job record
  const job = await queryOne<{ id: string }>(
    `INSERT INTO email_scrape_jobs (user_id, triggered_by, status)
     VALUES ($1, $2, 'running') RETURNING id`,
    [opts.userId, opts.triggeredBy],
  )
  if (!job) return

  try {
    const auth = new google.auth.OAuth2(
      process.env['GOOGLE_CLIENT_ID'],
      process.env['GOOGLE_CLIENT_SECRET'],
    )
    auth.setCredentials({
      access_token: tokenRow.access_token,
      refresh_token: tokenRow.refresh_token,
    })

    const gmail = google.gmail({ version: 'v1', auth })

    // Fetch emails from the last 7 days
    const since = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000)
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: `after:${since} -from:me`,
      maxResults: 50,
    })

    const messages = listRes.data.messages ?? []

    // Fetch user's active KRs for context
    const activeKRs = await queryMany<{
      id: string; title: string; objective_id: string; objective_title: string
      current_value: number; target_value: number; unit: string | null
    }>(
      `SELECT kr.id, kr.title, kr.objective_id, o.title AS objective_title,
              kr.current_value, kr.target_value, kr.unit
       FROM key_results kr
       JOIN objectives o ON o.id = kr.objective_id
       WHERE o.owner_id = $1 AND o.status = 'active' AND kr.status = 'active'`,
      [opts.userId],
    )

    let extractionCount = 0

    for (const msg of messages) {
      if (!msg.id) continue
      const full = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'snippet',
      })
      const snippet = full.data.snippet ?? ''
      if (snippet.length < 20) continue

      const updates = await extractOkrUpdatesFromEmail({
        userId: opts.userId,
        emailBody: snippet,
        activeKeyResults: activeKRs.map((kr) => ({
          id: kr.id,
          title: kr.title,
          objectiveId: kr.objective_id,
          objectiveTitle: kr.objective_title,
          currentValue: kr.current_value,
          targetValue: kr.target_value,
          unit: kr.unit,
        })),
      })

      for (const upd of updates) {
        if (!upd.note && !upd.newValue) continue

        const decision =
          consent.consent_level === 'capture_all' ? 'accepted' : 'pending'

        await query(
          `INSERT INTO email_scrape_extractions
             (job_id, gmail_message_id, extracted_text, proposed_update, user_decision)
           VALUES ($1,$2,$3,$4,$5)`,
          [
            job.id, msg.id, snippet,
            JSON.stringify({
              objectiveId: upd.objectiveId,
              keyResultId: upd.keyResultId,
              newValue: upd.newValue,
              confidence: upd.confidence,
              note: upd.note,
              reasoning: upd.reasoning,
              sourceSnippet: upd.sourceSnippet,
            }),
            decision,
          ],
        )

        // If capture_all: apply update immediately
        if (decision === 'accepted' && upd.keyResultId && upd.newValue !== null) {
          await applyExtraction(upd.keyResultId, upd.newValue, upd.confidence, upd.note, opts.userId)
        }

        extractionCount++
      }
    }

    await query(
      `UPDATE email_scrape_jobs SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [job.id],
    )
    console.log(`[EmailScrape] Job ${job.id}: ${extractionCount} extractions from ${messages.length} emails.`)
  } catch (err) {
    await query(
      `UPDATE email_scrape_jobs SET status = 'failed', error_message = $1 WHERE id = $2`,
      [err instanceof Error ? err.message : String(err), job.id],
    )
    throw err
  }
}

/**
 * Triggered by a daily cron job. Finds users whose consent schedule is due
 * and enqueues an email_scrape job for each of them.
 */
export async function runScheduledEmailScrapes(): Promise<void> {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sun … 6=Sat
  const isEndOfDay = true        // always true — this runs once a day
  const isEndOfWeek = dayOfWeek === 5 // Friday

  // Build a list of qualifying users per schedule type
  const users = await queryMany<{ user_id: string; schedule: string }>(
    `SELECT user_id, schedule FROM email_scraping_consent
     WHERE consent_level != 'none'
       AND (
         schedule = 'end_of_day'
         OR (schedule = 'end_of_week'   AND $1)
         OR (schedule = 'end_of_period' AND $2)
       )`,
    [isEndOfWeek, isEndOfWeek], // end_of_period treated same as end_of_week for now
  )

  // Skip users who already have a job run today
  const due = await Promise.all(
    users.map(async (u) => {
      const recent = await queryOne(
        `SELECT 1 FROM email_scrape_jobs
         WHERE user_id = $1
           AND triggered_by = 'scheduled'
           AND run_at > NOW() - INTERVAL '20 hours'`,
        [u.user_id],
      )
      return recent ? null : u.user_id
    }),
  )

  const dueUserIds = due.filter((id): id is string => id !== null)

  const { enqueueJob } = await import('../services/jobQueue.js')
  for (const userId of dueUserIds) {
    await enqueueJob('email_scrape', { userId, triggeredBy: 'scheduled' })
  }

  console.log(`[EmailScrape] Scheduled run: enqueued ${dueUserIds.length} job(s).`)
}

async function applyExtraction(
  keyResultId: string,
  newValue: number,
  confidence: string | null,
  note: string | null,
  userId: string,
): Promise<void> {
  const kr = await queryOne<{ current_value: number; confidence: string }>(
    'SELECT current_value, confidence FROM key_results WHERE id = $1',
    [keyResultId],
  )
  if (!kr) return

  await query(
    `UPDATE key_results SET current_value = $1, confidence = COALESCE($2, confidence),
     last_checkin_at = NOW(), updated_at = NOW() WHERE id = $3`,
    [newValue, confidence, keyResultId],
  )
  await query(
    `INSERT INTO checkins (key_result_id, author_id, previous_value, new_value, confidence, note)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [keyResultId, userId, kr.current_value, newValue, confidence ?? kr.confidence, note],
  )
}
