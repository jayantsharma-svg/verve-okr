import type { App } from '@slack/bolt'
import { queryOne, query } from '../db/client.js'
import { getSlackClient } from './notifications.js'

export function registerActions(app: App): void {

  // ─── checkin_submit modal ─────────────────────────────────────────────────

  app.view('checkin_submit', async ({ ack, body, view, client }) => {
    await ack()
    try {
      // Extract values from the modal state
      const values      = view.state.values
      const objectiveId = values['objective_block']?.['select_objective']?.selected_option?.value
      const newValueStr = values['value_block']?.['new_value']?.value
      const confidence  = values['confidence_block']?.['confidence']?.selected_option?.value ?? 'on_track'
      const note        = values['note_block']?.['note']?.value ?? null

      if (!objectiveId || !newValueStr) {
        console.warn('[Slack] checkin_submit: missing objectiveId or newValue')
        return
      }

      const newValue = parseFloat(newValueStr)
      if (isNaN(newValue)) {
        console.warn('[Slack] checkin_submit: newValue is not a number:', newValueStr)
        return
      }

      // 1. Resolve submitting Slack user → OKR user
      const slackUserId = body.user.id
      const user = await queryOne(
        'SELECT * FROM users WHERE slack_user_id = $1',
        [slackUserId],
      ) as { id: string; name: string; slack_user_id: string } | null

      if (!user) {
        console.warn(`[Slack] checkin_submit: no OKR user found for Slack user ${slackUserId}`)
        return
      }

      // 2. Find the first active KR for the selected objective owned by this user
      const kr = await queryOne(
        `SELECT kr.*
         FROM key_results kr
         JOIN objectives o ON o.id = kr.objective_id
         WHERE kr.objective_id = $1
           AND kr.status = 'active'
           AND o.owner_id = $2
         ORDER BY kr.created_at ASC
         LIMIT 1`,
        [objectiveId, user.id],
      ) as { id: string; title: string; current_value: number } | null

      if (!kr) {
        console.warn(`[Slack] checkin_submit: no active KR found for objective ${objectiveId} / user ${user.id}`)
        return
      }

      const previousValue = Number(kr.current_value ?? 0)

      // 3. Insert check-in record
      await query(
        `INSERT INTO checkins (key_result_id, author_id, previous_value, new_value, confidence, note)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [kr.id, user.id, previousValue, newValue, confidence, note],
      )

      // 4. Update key result
      await query(
        `UPDATE key_results
         SET current_value = $1, confidence = $2, last_checkin_at = NOW()
         WHERE id = $3`,
        [newValue, confidence, kr.id],
      )

      // 5. Send DM confirmation
      const slack = getSlackClient()
      await slack.chat.postMessage({
        channel: slackUserId,
        text:    `✅ Check-in recorded for *${kr.title}*! New value: ${newValue}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `✅ *Check-in recorded!*\n*Key Result:* ${kr.title}\n*New value:* ${newValue} _(was ${previousValue})_`,
            },
          },
          ...(note ? [{
            type: 'section',
            text: { type: 'mrkdwn', text: `*Note:* ${note}` },
          }] : []),
        ],
      })
    } catch (err) {
      console.error('[Slack] checkin_submit error:', err)
    }
  })
}
