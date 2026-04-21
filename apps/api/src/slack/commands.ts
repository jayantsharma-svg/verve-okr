import type { App } from '@slack/bolt'
import { queryOne, queryMany } from '../db/client.js'
import { buildStatusBlocks, buildCheckinModal } from './blocks.js'

const FRONTEND_URL = process.env['FRONTEND_URL'] ?? 'http://localhost:3000'

const NOT_LINKED_MSG =
  `Your Slack account is not linked to a Verve account. ` +
  `Please log in at <${FRONTEND_URL}|${FRONTEND_URL}>`

async function findUserBySlackId(slackUserId: string) {
  return queryOne(
    'SELECT * FROM users WHERE slack_user_id = $1',
    [slackUserId],
  ) as Promise<{ id: string; name: string; email: string } | null>
}

async function fetchObjectivesWithKRs(ownerId: string) {
  const objectives = await queryMany(
    `SELECT o.*, u.name AS owner_name
     FROM objectives o
     JOIN users u ON u.id = o.owner_id
     WHERE o.owner_id = $1 AND o.status = 'active'
     ORDER BY o.created_at DESC
     LIMIT 5`,
    [ownerId],
  ) as any[]

  if (objectives.length > 0) {
    const ids = objectives.map((o: any) => o.id)
    const krs = await queryMany(
      `SELECT * FROM key_results WHERE objective_id = ANY($1::uuid[]) AND status = 'active'`,
      [ids],
    ) as any[]

    // Attach KRs to their parent objective
    for (const obj of objectives) {
      obj.keyResults = krs.filter((kr: any) => kr.objective_id === obj.id)
    }
  }

  return objectives
}

export function registerCommands(app: App): void {

  // ─── /okr-status ──────────────────────────────────────────────────────────

  app.command('/okr-status', async ({ ack, body, respond }) => {
    await ack()
    try {
      const user = await findUserBySlackId(body.user_id)
      if (!user) {
        await respond({ text: NOT_LINKED_MSG, response_type: 'ephemeral' })
        return
      }

      const objectives = await fetchObjectivesWithKRs(user.id)
      await respond({
        response_type: 'ephemeral',
        blocks: buildStatusBlocks(objectives),
      })
    } catch (err) {
      console.error('[Slack] /okr-status error:', err)
      await respond({ text: 'An error occurred while fetching your OKRs. Please try again.', response_type: 'ephemeral' })
    }
  })

  // ─── /okr-checkin ─────────────────────────────────────────────────────────

  app.command('/okr-checkin', async ({ ack, body, respond, client }) => {
    await ack()
    try {
      const user = await findUserBySlackId(body.user_id)
      if (!user) {
        await respond({ text: NOT_LINKED_MSG, response_type: 'ephemeral' })
        return
      }

      const objectives = await fetchObjectivesWithKRs(user.id)

      await client.views.open({
        trigger_id: body.trigger_id,
        view: buildCheckinModal(objectives),
      })
    } catch (err) {
      console.error('[Slack] /okr-checkin error:', err)
      await respond({ text: 'An error occurred while opening the check-in form. Please try again.', response_type: 'ephemeral' })
    }
  })
}
