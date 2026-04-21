import { WebClient } from '@slack/web-api'
import { queryOne } from '../db/client.js'
import { buildNotificationBlocks } from './blocks.js'

// ─── Slack WebClient singleton ────────────────────────────────────────────────

let _client: WebClient | null = null

export function getSlackClient(): WebClient {
  if (!_client) _client = new WebClient(process.env['SLACK_BOT_TOKEN'])
  return _client
}

// ─── sendNotification ─────────────────────────────────────────────────────────

type NotificationType =
  | 'checkin_reminder'
  | 'at_risk_alert'
  | 'review_request'
  | 'appraisal_update'
  | 'collaborator_request'

const PREF_COLUMN: Record<NotificationType, string> = {
  checkin_reminder:    'checkin_reminders',
  at_risk_alert:       'at_risk_alerts',
  review_request:      'review_requests',
  appraisal_update:    'appraisal_updates',
  collaborator_request: 'collaborator_requests',
}

export async function sendNotification(
  userId: string,
  type: NotificationType,
  payload: Record<string, any>,
): Promise<void> {
  try {
    // 1. Fetch notification prefs (fall back to all-enabled defaults)
    const prefs = await queryOne(
      'SELECT * FROM notification_prefs WHERE user_id = $1',
      [userId],
    ) as Record<string, any> | null

    const channel     = prefs?.channel ?? 'slack'
    const prefColumn  = PREF_COLUMN[type]
    const typeEnabled = prefs ? Boolean(prefs[prefColumn] ?? true) : true

    // 2. Only proceed if channel is slack and the notification type is enabled
    if (channel !== 'slack' || !typeEnabled) {
      return
    }

    // 3. Look up the user's Slack user ID
    const user = await queryOne(
      'SELECT slack_user_id FROM users WHERE id = $1',
      [userId],
    ) as { slack_user_id: string | null } | null

    if (!user?.slack_user_id) {
      console.warn(`[Slack] No slack_user_id for OKR user ${userId} — skipping notification`)
      return
    }

    // 4. Send DM
    const client = getSlackClient()
    await client.chat.postMessage({
      channel: user.slack_user_id,
      blocks:  buildNotificationBlocks(type, payload),
      text:    `Verve: ${type.replace(/_/g, ' ')}`,  // fallback text for notifications
    })
  } catch (err) {
    console.error(`[Slack] Failed to send notification (type=${type}, userId=${userId}):`, err)
  }
}
