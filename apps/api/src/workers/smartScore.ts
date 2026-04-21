import { queryOne, queryMany, query } from '../db/client.js'
import { scoreOkrWithClaude } from '../services/claude.js'

export async function scoreObjective(objectiveId: string): Promise<void> {
  // Rate limit: one score per objective per day
  const recent = await queryOne(
    `SELECT id FROM okr_smart_scores
     WHERE objective_id = $1 AND DATE(scored_at) = CURRENT_DATE`,
    [objectiveId],
  )
  if (recent) {
    console.log(`[SmartScore] Already scored today: ${objectiveId}`)
    return
  }

  const objective = await queryOne<{
    id: string; title: string; description: string | null; owner_id: string
  }>(
    'SELECT id, title, description, owner_id FROM objectives WHERE id = $1',
    [objectiveId],
  )
  if (!objective) return

  const keyResults = await queryMany<{
    title: string; metric_type: string; target_value: number; unit: string | null
  }>(
    'SELECT title, metric_type, target_value, unit FROM key_results WHERE objective_id = $1',
    [objectiveId],
  )

  const cycle = await queryOne<{ end_date: string }>(
    `SELECT c.end_date FROM cycles c
     JOIN objectives o ON o.cycle_id = c.id WHERE o.id = $1`,
    [objectiveId],
  )

  const result = await scoreOkrWithClaude({
    objectiveId,
    title: objective.title,
    description: objective.description,
    keyResults: keyResults.map((kr) => ({
      title: kr.title,
      metricType: kr.metric_type,
      targetValue: kr.target_value,
      unit: kr.unit,
    })),
    cycleEndDate: cycle?.end_date ?? 'unknown',
    actorId: objective.owner_id,
  })

  await query(
    `INSERT INTO okr_smart_scores
       (objective_id, model_version, specific_score, measurable_score,
        achievable_score, relevant_score, time_bound_score, overall_score, feedback)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (objective_id, DATE(scored_at)) DO UPDATE SET
       specific_score = EXCLUDED.specific_score,
       measurable_score = EXCLUDED.measurable_score,
       achievable_score = EXCLUDED.achievable_score,
       relevant_score = EXCLUDED.relevant_score,
       time_bound_score = EXCLUDED.time_bound_score,
       overall_score = EXCLUDED.overall_score,
       feedback = EXCLUDED.feedback`,
    [
      objectiveId, 'claude-opus-4-6',
      result.specific, result.measurable, result.achievable,
      result.relevant, result.timeBound, result.overall,
      JSON.stringify(result.feedback),
    ],
  )

  console.log(`[SmartScore] Scored ${objectiveId}: overall ${result.overall}/10`)
}
