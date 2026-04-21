/**
 * Check-in reminder worker.
 * Finds users with KRs that haven't been updated in 7+ days and sends
 * a Slack DM (or email) nudge via the existing notification system.
 */
import { queryMany } from '../db/client.js'
import { sendNotification } from '../slack/notifications.js'

const STALE_DAYS = 7

export async function sendCheckinReminders(): Promise<void> {
  // Find every active user who owns at least one stale active KR
  const users = await queryMany<{ id: string; name: string }>(
    `SELECT DISTINCT u.id, u.name
     FROM users u
     JOIN objectives o  ON o.owner_id   = u.id AND o.status = 'active'
     JOIN key_results kr ON kr.objective_id = o.id AND kr.status = 'active'
     WHERE u.is_active = TRUE
       AND (
         kr.last_checkin_at IS NULL
         OR kr.last_checkin_at < NOW() - INTERVAL '${STALE_DAYS} days'
       )`,
  )

  console.log(`[CheckinReminder] Found ${users.length} user(s) with stale KRs`)

  for (const user of users) {
    await remindUser(user.id, user.name).catch((err) =>
      console.error(`[CheckinReminder] Failed for user ${user.id}:`, err),
    )
  }
}

async function remindUser(userId: string, userName: string): Promise<void> {
  // Fetch the user's stale KRs (up to 5 for the notification body)
  const staleKrs = await queryMany<{
    kr_title: string
    objective_title: string
    last_checkin_at: string | null
  }>(
    `SELECT kr.title AS kr_title,
            o.title  AS objective_title,
            kr.last_checkin_at
     FROM key_results kr
     JOIN objectives o ON o.id = kr.objective_id
     WHERE o.owner_id = $1
       AND o.status = 'active'
       AND kr.status = 'active'
       AND (
         kr.last_checkin_at IS NULL
         OR kr.last_checkin_at < NOW() - INTERVAL '${STALE_DAYS} days'
       )
     ORDER BY kr.last_checkin_at ASC NULLS FIRST
     LIMIT 5`,
    [userId],
  )

  if (staleKrs.length === 0) return   // race condition guard

  const krLines = (staleKrs as any[]).map((kr) => {
    const age = kr.last_checkin_at
      ? `${Math.floor((Date.now() - new Date(kr.last_checkin_at).getTime()) / 86_400_000)}d ago`
      : 'never'
    return `• *${kr.kr_title}* (${kr.objective_title}) — last updated ${age}`
  })

  await sendNotification(userId, 'checkin_reminder', {
    userName,
    staleKrCount: staleKrs.length,
    // Single message string the existing buildNotificationBlocks will use
    message: `Hi ${userName}, you have *${staleKrs.length}* key result${staleKrs.length !== 1 ? 's' : ''} that ${staleKrs.length !== 1 ? 'haven\'t' : 'hasn\'t'} been updated in over a week:\n\n${krLines.join('\n')}`,
  })

  console.log(`[CheckinReminder] Reminded user ${userId} (${staleKrs.length} stale KRs)`)
}
