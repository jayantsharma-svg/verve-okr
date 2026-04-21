const FRONTEND_URL = process.env['FRONTEND_URL'] ?? 'http://localhost:3000'

// ─── AttendeeWithOkrs ─────────────────────────────────────────────────────────

export interface AttendeeWithOkrs {
  name: string
  email: string
  objectives: Array<{
    title: string
    level: string
    krCount: number
    avgProgressPct: number | null
    worstConfidence: string | null
  }>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function levelBadge(level: string): string {
  switch (level) {
    case 'company':    return '🏢'
    case 'department': return '🏬'
    case 'team':       return '👥'
    case 'individual': return '👤'
    default:           return '📌'
  }
}

function confidenceEmoji(confidence: string): string {
  switch (confidence) {
    case 'on_track': return '🟢'
    case 'at_risk':  return '🟡'
    case 'off_track': return '🔴'
    default:         return '⚪'
  }
}

function progressBar(current: number, target: number, positions = 10): string {
  const ratio = target > 0 ? Math.min(current / target, 1) : 0
  const filled = Math.round(ratio * positions)
  return '▓'.repeat(filled) + '░'.repeat(positions - filled)
}

// ─── buildStatusBlocks ────────────────────────────────────────────────────────

export function buildStatusBlocks(objectives: any[]): any[] {
  const blocks: any[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '📊 Your OKR Status', emoji: true },
    },
  ]

  const display = objectives.slice(0, 5)

  if (display.length === 0) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '_No active objectives found._' },
    })
    return blocks
  }

  for (const obj of display) {
    blocks.push({ type: 'divider' })

    const badge = levelBadge(obj.level)
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${badge} ${obj.title}*  •  _${obj.level}_`,
      },
    })

    const krs: any[] = obj.keyResults ?? obj.key_results ?? []
    if (krs.length === 0) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: '  _No active key results._' },
      })
    } else {
      for (const kr of krs) {
        const current = Number(kr.current_value ?? 0)
        const target  = Number(kr.target_value ?? 0)
        const bar     = progressBar(current, target)
        const conf    = confidenceEmoji(kr.confidence ?? 'on_track')
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `  • *${kr.title}*\n    \`${bar}\` ${current} / ${target}  ${conf}`,
          },
        })
      }
    }
  }

  return blocks
}

// ─── buildCheckinModal ────────────────────────────────────────────────────────

export function buildCheckinModal(objectives: any[]): any {
  const objectiveOptions = objectives.map((o: any) => ({
    text:  { type: 'plain_text', text: o.title, emoji: true },
    value: o.id,
  }))

  if (objectiveOptions.length === 0) {
    objectiveOptions.push({
      text:  { type: 'plain_text', text: 'No active objectives', emoji: true },
      value: 'none',
    })
  }

  return {
    type: 'modal',
    callback_id: 'checkin_submit',
    title: { type: 'plain_text', text: 'Check In', emoji: true },
    submit: { type: 'plain_text', text: 'Submit Check-in', emoji: true },
    close:  { type: 'plain_text', text: 'Cancel', emoji: true },
    blocks: [
      {
        type: 'input',
        block_id: 'objective_block',
        label: { type: 'plain_text', text: 'Objective', emoji: true },
        element: {
          type: 'static_select',
          action_id: 'select_objective',
          placeholder: { type: 'plain_text', text: 'Select an objective', emoji: true },
          options: objectiveOptions,
        },
      },
      {
        type: 'input',
        block_id: 'kr_block',
        label: { type: 'plain_text', text: 'Key Result', emoji: true },
        element: {
          type: 'plain_text_input',
          action_id: 'select_kr',
          placeholder: { type: 'plain_text', text: 'Key result will be selected automatically', emoji: true },
          initial_value: 'first',
        },
        hint: {
          type: 'plain_text',
          text: 'The first active KR for the selected objective will be updated.',
          emoji: true,
        },
        optional: true,
      },
      {
        type: 'input',
        block_id: 'value_block',
        label: { type: 'plain_text', text: 'New Value', emoji: true },
        element: {
          type: 'plain_text_input',
          action_id: 'new_value',
          placeholder: { type: 'plain_text', text: 'Enter new value', emoji: true },
        },
      },
      {
        type: 'input',
        block_id: 'confidence_block',
        label: { type: 'plain_text', text: 'Confidence', emoji: true },
        element: {
          type: 'static_select',
          action_id: 'confidence',
          placeholder: { type: 'plain_text', text: 'Select confidence level', emoji: true },
          options: [
            { text: { type: 'plain_text', text: '🟢 On Track',  emoji: true }, value: 'on_track'  },
            { text: { type: 'plain_text', text: '🟡 At Risk',   emoji: true }, value: 'at_risk'   },
            { text: { type: 'plain_text', text: '🔴 Off Track', emoji: true }, value: 'off_track' },
          ],
        },
      },
      {
        type: 'input',
        block_id: 'note_block',
        label: { type: 'plain_text', text: 'Note', emoji: true },
        element: {
          type: 'plain_text_input',
          action_id: 'note',
          multiline: true,
          placeholder: { type: 'plain_text', text: 'Optional note', emoji: true },
        },
        optional: true,
      },
    ],
  }
}

// ─── buildMeetingDigestBlocks ─────────────────────────────────────────────────

export function buildMeetingDigestBlocks(event: any, attendees: AttendeeWithOkrs[]): any[] {
  const eventTitle = event.summary ?? 'Upcoming Meeting'
  const startTime = event.start?.dateTime
    ? new Date(event.start.dateTime).toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
      })
    : 'Time unknown'
  const attendeeCount = (event.attendees ?? []).length

  const blocks: any[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '📅 Pre-meeting OKR Digest', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${eventTitle}*\n${startTime}  ·  ${attendeeCount} attendees`,
      },
    },
    { type: 'divider' },
  ]

  const displayAttendees = attendees.slice(0, 5)

  if (displayAttendees.length === 0) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '_No matching users found in Verve._' },
    })
  }

  for (const att of displayAttendees) {
    const header: any = {
      type: 'section',
      text: { type: 'mrkdwn', text: `*${att.name}*` },
    }
    blocks.push(header)

    if (att.objectives.length === 0) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: '• _No active OKRs_' },
      })
    } else {
      const lines = att.objectives.slice(0, 3).map((obj) => {
        const emoji = levelBadge(obj.level)
        const pct = obj.avgProgressPct !== null ? `${obj.avgProgressPct}%` : 'N/A'
        const conf = confidenceEmoji(obj.worstConfidence ?? 'on_track')
        return `• ${emoji} ${obj.title} — ${pct} · ${conf}`
      })
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: lines.join('\n') },
      })
    }
  }

  blocks.push({ type: 'divider' })
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Sent by Verve · <${FRONTEND_URL}|Open Verve>`,
      },
    ],
  })

  return blocks
}

// ─── buildNotificationBlocks ──────────────────────────────────────────────────

export function buildNotificationBlocks(type: string, payload: any): any[] {
  type Config = { emoji: string; title: string; body: string }

  function cfg(): Config {
    switch (type) {
      case 'checkin_reminder':
        return {
          emoji: '⏰',
          title: 'Check-in Reminder',
          body:  payload.message ?? `It's time to check in on your OKRs${payload.objectiveTitle ? ` for *${payload.objectiveTitle}*` : ''}.`,
        }
      case 'at_risk_alert':
        return {
          emoji: '🚨',
          title: 'At-Risk Alert',
          body:  payload.message ?? `Key result *${payload.krTitle ?? 'unknown'}* is now at risk.`,
        }
      case 'review_request':
        return {
          emoji: '📋',
          title: 'Review Request',
          body:  payload.message ?? `You have a new review request${payload.reviewerName ? ` from *${payload.reviewerName}*` : ''}.`,
        }
      case 'appraisal_update':
        return {
          emoji: '📝',
          title: 'Appraisal Update',
          body:  payload.message ?? `Your appraisal has been updated${payload.cycleTitle ? ` for cycle *${payload.cycleTitle}*` : ''}.`,
        }
      case 'collaborator_request':
        return {
          emoji: '🤝',
          title: 'Collaborator Request',
          body:  payload.message ?? `*${payload.inviterName ?? 'Someone'}* invited you to collaborate on *${payload.objectiveTitle ?? 'an objective'}*.`,
        }
      default:
        return {
          emoji: '🔔',
          title: 'Verve Notification',
          body:  payload.message ?? 'You have a new notification.',
        }
    }
  }

  const { emoji, title, body } = cfg()

  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${emoji} ${title}`, emoji: true },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: body },
    },
    { type: 'divider' },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text:  { type: 'plain_text', text: 'Open Verve', emoji: true },
          url:   FRONTEND_URL,
          style: 'primary',
        },
      ],
    },
  ]
}
