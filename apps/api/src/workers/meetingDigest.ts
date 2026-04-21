/**
 * Meeting Digest worker.
 * Fetches upcoming calendar events and sends an OKR briefing to the meeting organiser
 * via Slack DM or email before each meeting.
 */
import { google } from 'googleapis'
import nodemailer from 'nodemailer'
import { queryOne, queryMany, query } from '../db/client.js'
import { getSlackClient } from '../slack/notifications.js'
import { buildMeetingDigestBlocks, type AttendeeWithOkrs } from '../slack/blocks.js'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DigestSettings {
  user_id: string
  enabled: boolean
  lead_time_minutes: number
  calendar_id: string | null
}

interface ObjectiveRow {
  id: string
  title: string
  level: string
  kr_count: string | number
  avg_progress_pct: string | number | null
  worst_confidence: string | null
}

// ─── runMeetingDigest ─────────────────────────────────────────────────────────

export async function runMeetingDigest(opts: { userId: string }): Promise<void> {
  // 1. Load digest settings
  const settings = await queryOne<DigestSettings>(
    'SELECT user_id, enabled, lead_time_minutes, calendar_id FROM meeting_digest_settings WHERE user_id = $1',
    [opts.userId],
  )
  if (!settings || !settings.enabled) return

  // 2. Load Google OAuth token with calendar scope
  const tokenRow = await queryOne<{
    access_token: string
    refresh_token: string
    expires_at: string
  }>(
    `SELECT access_token, refresh_token, expires_at
     FROM google_oauth_tokens
     WHERE user_id = $1 AND 'https://www.googleapis.com/auth/calendar.readonly' = ANY(scopes)`,
    [opts.userId],
  )
  if (!tokenRow) {
    console.warn(`[MeetingDigest] No Calendar token for user ${opts.userId}`)
    return
  }

  // 3. Init Google auth
  const auth = new google.auth.OAuth2(
    process.env['GOOGLE_CLIENT_ID'],
    process.env['GOOGLE_CLIENT_SECRET'],
  )
  auth.setCredentials({
    access_token: tokenRow.access_token,
    refresh_token: tokenRow.refresh_token,
  })

  // 4. Create calendar client
  const calendar = google.calendar({ version: 'v3', auth })

  // 5. Fetch events in the look-ahead window
  const now = new Date()
  const timeMax = new Date(now.getTime() + settings.lead_time_minutes * 60_000)
  const calendarId = settings.calendar_id ?? 'primary'

  let events: any[] = []
  try {
    const res = await calendar.events.list({
      calendarId,
      timeMin: now.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 10,
    })
    events = res.data.items ?? []
  } catch (err) {
    console.error(`[MeetingDigest] Calendar API error for user ${opts.userId}:`, err)
    return
  }

  // 6. Process each qualifying event
  for (const event of events) {
    const attendees: any[] = event.attendees ?? []
    if (attendees.length < 2) continue

    // a. Extract attendee emails
    const emails = attendees
      .map((a: any) => a.email)
      .filter((e: any): e is string => typeof e === 'string')

    // b. Find matching users
    const users = await queryMany<{ id: string; name: string; email: string }>(
      'SELECT id, name, email FROM users WHERE email = ANY($1) AND is_active = TRUE',
      [emails],
    )

    // c. Fetch OKRs for each attendee user
    const attendeesWithOkrs: AttendeeWithOkrs[] = []
    for (const user of users) {
      const objectives = await queryMany<ObjectiveRow>(
        `SELECT o.id, o.title, o.level,
                COUNT(kr.id) FILTER (WHERE kr.status = 'active') AS kr_count,
                ROUND(AVG(
                  CASE WHEN (kr.target_value - kr.start_value) = 0 THEN 0
                  ELSE ((kr.current_value - kr.start_value)::float / (kr.target_value - kr.start_value)) * 100
                  END
                ) FILTER (WHERE kr.status = 'active')) AS avg_progress_pct,
                MIN(kr.confidence) FILTER (WHERE kr.status = 'active' AND kr.confidence IN ('at_risk','off_track')) AS worst_confidence
         FROM objectives o
         LEFT JOIN key_results kr ON kr.objective_id = o.id
         WHERE o.owner_id = $1 AND o.status = 'active'
         GROUP BY o.id, o.title, o.level
         ORDER BY o.created_at DESC
         LIMIT 5`,
        [user.id],
      )

      attendeesWithOkrs.push({
        name: user.name,
        email: user.email,
        objectives: objectives.map((obj) => ({
          title: obj.title,
          level: obj.level,
          krCount: Number(obj.kr_count ?? 0),
          avgProgressPct: obj.avg_progress_pct !== null ? Number(obj.avg_progress_pct) : null,
          worstConfidence: obj.worst_confidence,
        })),
      })
    }

    // d. Send the digest
    await sendDigest(opts.userId, event, attendeesWithOkrs, settings)
  }
}

// ─── runAllDigests ────────────────────────────────────────────────────────────

export async function runAllDigests(): Promise<void> {
  const users = await queryMany<{ user_id: string }>(
    'SELECT user_id FROM meeting_digest_settings WHERE enabled = TRUE',
  )
  for (const { user_id } of users) {
    await runMeetingDigest({ userId: user_id }).catch((err) =>
      console.error(`[MeetingDigest] Failed for user ${user_id}:`, err),
    )
  }
}

// ─── sendDigest ───────────────────────────────────────────────────────────────

async function sendDigest(
  userId: string,
  event: any,
  attendees: AttendeeWithOkrs[],
  settings: DigestSettings,
): Promise<void> {
  // 1. Load notification prefs
  const prefs = await queryOne<{ channel: string }>(
    'SELECT channel FROM notification_prefs WHERE user_id = $1',
    [userId],
  )
  const channel = prefs?.channel ?? 'slack'

  // 2. Load user record for Slack ID and email
  const userRow = await queryOne<{ slack_user_id: string | null; email: string; name: string }>(
    'SELECT slack_user_id, email, name FROM users WHERE id = $1',
    [userId],
  )
  if (!userRow) {
    console.warn(`[MeetingDigest] User ${userId} not found, skipping digest`)
    return
  }

  // 3. Try Slack first when channel preference is slack and user has a Slack ID
  if (channel === 'slack' && userRow.slack_user_id) {
    try {
      const client = getSlackClient()
      await client.chat.postMessage({
        channel: userRow.slack_user_id,
        blocks: buildMeetingDigestBlocks(event, attendees),
        text: 'Pre-meeting OKR digest',
      })
      console.log(`[MeetingDigest] Slack digest sent to user ${userId} for event "${event.summary ?? 'Untitled'}"`)
      return
    } catch (err) {
      console.error(`[MeetingDigest] Slack send failed for user ${userId}, falling back to email:`, err)
    }
  }

  // 4. Email fallback (or primary channel when channel === 'email')
  await sendEmailDigest(userRow.email, userRow.name, event, attendees)
}

// ─── sendEmailDigest ──────────────────────────────────────────────────────────

async function sendEmailDigest(
  toEmail: string,
  toName: string,
  event: any,
  attendees: AttendeeWithOkrs[],
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env['SMTP_HOST'] ?? 'localhost',
    port: parseInt(process.env['SMTP_PORT'] ?? '587', 10),
    auth: process.env['SMTP_USER']
      ? { user: process.env['SMTP_USER'], pass: process.env['SMTP_PASS'] }
      : undefined,
  })

  const eventTitle = event.summary ?? 'Upcoming Meeting'
  const startTime = event.start?.dateTime
    ? new Date(event.start.dateTime).toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
      })
    : 'Time unknown'
  const attendeeCount = (event.attendees ?? []).length
  const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:3000'

  const levelEmoji: Record<string, string> = {
    company: '🏢', department: '🏬', team: '👥', individual: '👤',
  }
  const confEmoji: Record<string, string> = {
    on_track: '🟢', at_risk: '🟡', off_track: '🔴',
  }

  const attendeeHtml = attendees
    .slice(0, 5)
    .map((att) => {
      const objRows =
        att.objectives.length === 0
          ? '<li style="color:#6b7280;">No active OKRs</li>'
          : att.objectives
              .slice(0, 3)
              .map((obj) => {
                const emoji = levelEmoji[obj.level] ?? '📌'
                const pct = obj.avgProgressPct !== null ? `${obj.avgProgressPct}%` : 'N/A'
                const conf = obj.worstConfidence ? confEmoji[obj.worstConfidence] ?? '⚪' : '🟢'
                return `<li>${emoji} ${obj.title} — <strong>${pct}</strong> ${conf}</li>`
              })
              .join('')

      return `
        <div style="margin-bottom:16px;padding:12px;background:#f9fafb;border-radius:8px;">
          <p style="margin:0 0 8px;font-weight:600;color:#111827;">${att.name}</p>
          <ul style="margin:0;padding-left:18px;color:#374151;">${objRows}</ul>
        </div>`
    })
    .join('')

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111827;">
  <h2 style="margin-bottom:4px;">📅 Pre-meeting OKR Digest</h2>
  <p style="color:#6b7280;margin-top:0;">Here's the OKR status for everyone in your upcoming meeting.</p>

  <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px;margin-bottom:20px;">
    <p style="margin:0 0 4px;font-size:16px;font-weight:700;">${eventTitle}</p>
    <p style="margin:0;color:#374151;">${startTime} · ${attendeeCount} attendees</p>
  </div>

  <h3 style="margin-bottom:12px;">Attendee OKR Status</h3>
  ${attendeeHtml || '<p style="color:#6b7280;">No matching users found in Verve.</p>'}

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
  <p style="color:#9ca3af;font-size:12px;">
    Sent by <a href="${frontendUrl}" style="color:#6b7280;">Verve</a>
  </p>
</body>
</html>`

  await transporter.sendMail({
    from: process.env['SMTP_USER'] ?? `noreply@${process.env['GOOGLE_WORKSPACE_DOMAIN'] ?? 'capillarytech.com'}`,
    to: toEmail,
    subject: `📅 OKR Digest: ${eventTitle}`,
    html,
  })

  console.log(`[MeetingDigest] Email digest sent to ${toEmail} for event "${eventTitle}"`)
}
