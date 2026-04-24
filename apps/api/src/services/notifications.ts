/**
 * Notification service — routes notifications to Slack or Gmail based on user preference.
 */
import { queryOne } from '../db/client.js'

interface NotificationPayload {
  userId: string
  type: string
  data: Record<string, unknown>
}

export async function sendNotification(payload: NotificationPayload): Promise<void> {
  const prefs = await queryOne<{
    channel: string; checkin_reminders: boolean; review_requests: boolean
    at_risk_alerts: boolean; appraisal_updates: boolean; collaborator_requests: boolean
  }>(
    'SELECT * FROM notification_prefs WHERE user_id = $1',
    [payload.userId],
  )

  // Default to gmail if no prefs set
  const channel = prefs?.channel ?? 'gmail'

  // Check per-type opt-in
  const optedIn = (() => {
    switch (payload.type) {
      case 'checkin_reminder':      return prefs?.checkin_reminders ?? true
      case 'review_request':        return prefs?.review_requests ?? true
      case 'at_risk_alert':         return prefs?.at_risk_alerts ?? true
      case 'appraisal_update':      return prefs?.appraisal_updates ?? true
      case 'collaborator_request':  return prefs?.collaborator_requests ?? true
      default:                      return true
    }
  })()

  if (!optedIn) return

  if (channel === 'slack') {
    await sendSlackNotification(payload)
  } else {
    await sendGmailNotification(payload)
  }
}

async function sendSlackNotification(payload: NotificationPayload): Promise<void> {
  const user = await queryOne<{ slack_user_id: string | null; email: string }>(
    'SELECT slack_user_id, email FROM users WHERE id = $1',
    [payload.userId],
  )
  if (!user?.slack_user_id) {
    // Fall back to email if no Slack ID linked
    return sendGmailNotification(payload)
  }

  const { WebClient } = await import('@slack/web-api')
  const slack = new WebClient(process.env['SLACK_BOT_TOKEN'])

  const blocks = buildSlackBlocks(payload)
  await slack.chat.postMessage({
    channel: user.slack_user_id,
    text: getNotificationText(payload),
    blocks,
  })
}

async function sendGmailNotification(payload: NotificationPayload): Promise<void> {
  const user = await queryOne<{ email: string; name: string }>(
    'SELECT email, name FROM users WHERE id = $1',
    [payload.userId],
  )
  if (!user) return

  // Use nodemailer with Gmail API credentials (service account with domain-wide delegation)
  const { createTransport } = await import('nodemailer')

  const { google } = await import('googleapis')
  const keyBase64 = process.env['GOOGLE_SERVICE_ACCOUNT_KEY_BASE64']!
  const keyJson = JSON.parse(Buffer.from(keyBase64, 'base64').toString('utf8'))

  const auth = new google.auth.GoogleAuth({
    credentials: keyJson,
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    subject: `noreply@${process.env['GOOGLE_WORKSPACE_DOMAIN']}`,
  } as any)
  const accessToken = await auth.getAccessToken()

  const transport = createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: `noreply@${process.env['GOOGLE_WORKSPACE_DOMAIN']}`,
      accessToken: accessToken ?? undefined,
    },
  })

  const { subject, html } = buildEmailContent(payload, user.name)
  await transport.sendMail({
    from: `Verve <noreply@${process.env['GOOGLE_WORKSPACE_DOMAIN']}>`,
    to: user.email,
    subject,
    html,
  })
}

function getNotificationText(payload: NotificationPayload): string {
  switch (payload.type) {
    case 'checkin_reminder':     return '⏰ Time for your weekly OKR check-in!'
    case 'review_request':       return '📋 You have a new OKR review to complete.'
    case 'at_risk_alert':        return '⚠️ A key result is at risk.'
    case 'appraisal_update':     return '📊 Your appraisal has been updated.'
    case 'collaborator_request': return '🤝 You have been invited to collaborate on an OKR.'
    default:                     return 'You have a new OKR notification.'
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSlackBlocks(payload: NotificationPayload): any[] {
  const frontendUrl = process.env['FRONTEND_URL']
  const text = getNotificationText(payload)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks: any[] = [
    { type: 'section', text: { type: 'mrkdwn', text } },
  ]

  if (payload.type === 'checkin_reminder') {
    blocks.push({
      type: 'actions',
      elements: [{
        type: 'button',
        text: { type: 'plain_text', text: 'Go to Check-in' },
        url: `${frontendUrl}/checkin`,
        action_id: 'open_checkin',
      }],
    })
  }

  if (payload.type === 'collaborator_request' && payload.data['requestId']) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button', style: 'primary',
          text: { type: 'plain_text', text: 'Accept' },
          action_id: `collab_accept_${payload.data['requestId']}`,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Decline' },
          action_id: `collab_decline_${payload.data['requestId']}`,
        },
      ],
    })
  }

  return blocks
}

export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetToken: string,
): Promise<void> {
  const { createTransport } = await import('nodemailer')
  const { google } = await import('googleapis')

  const keyBase64 = process.env['GOOGLE_SERVICE_ACCOUNT_KEY_BASE64']!
  const keyJson = JSON.parse(Buffer.from(keyBase64, 'base64').toString('utf8'))

  const auth = new google.auth.GoogleAuth({
    credentials: keyJson,
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    subject: `noreply@${process.env['GOOGLE_WORKSPACE_DOMAIN']}`,
  } as any)
  const accessToken = await auth.getAccessToken()

  const transport = createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: `noreply@${process.env['GOOGLE_WORKSPACE_DOMAIN']}`,
      accessToken: accessToken ?? undefined,
    },
  })

  const resetUrl = `${process.env['FRONTEND_URL']}/reset-password?token=${resetToken}`

  await transport.sendMail({
    from: `Verve <noreply@${process.env['GOOGLE_WORKSPACE_DOMAIN']}>`,
    to: email,
    subject: 'Reset your Verve password',
    html: `
      <p>Hi ${name},</p>
      <p>You requested a password reset. Click the link below to set a new password.
         This link expires in <strong>1 hour</strong>.</p>
      <p><a href="${resetUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Reset Password</a></p>
      <p>If you didn't request this, you can safely ignore this email.</p>
      <p style="color:#999;font-size:12px;">Verve &mdash; <a href="${process.env['FRONTEND_URL']}">Capillary Technologies</a></p>
    `,
  })
}

function buildEmailContent(
  payload: NotificationPayload,
  userName: string,
): { subject: string; html: string } {
  const frontendUrl = process.env['FRONTEND_URL']
  const subject = getNotificationText(payload).replace(/[⏰📋⚠️📊🤝]/u, '').trim()
  const html = `
    <p>Hi ${userName},</p>
    <p>${getNotificationText(payload)}</p>
    <p><a href="${frontendUrl}">Open Verve</a></p>
    <p style="color:#999;font-size:12px;">You are receiving this because you have OKR notifications enabled.
    <a href="${frontendUrl}/settings/notifications">Manage preferences</a></p>
  `
  return { subject, html }
}
