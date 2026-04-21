/**
 * Shared Claude AI API client.
 * Handles prompt execution, structured output parsing, retries, and cost logging.
 */
import Anthropic from '@anthropic-ai/sdk'
import { query } from '../db/client.js'

const anthropic = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] })

const MODEL = 'claude-opus-4-6'

interface CallOptions {
  purpose: 'smart_score' | 'email_extract'
  actorId?: string
  entityType?: string
  entityId?: string
  systemPrompt: string
  userPrompt: string
  maxTokens?: number
}

interface CallResult {
  text: string
  tokensIn: number
  tokensOut: number
}

export async function callClaude(opts: CallOptions): Promise<CallResult> {
  const startedAt = Date.now()
  let success = true
  let errorMessage: string | null = null
  let usage = { input_tokens: 0, output_tokens: 0 }

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 1024,
      system: opts.systemPrompt,
      messages: [{ role: 'user', content: opts.userPrompt }],
    })

    usage = message.usage
    const text = message.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')

    return { text, tokensIn: usage.input_tokens, tokensOut: usage.output_tokens }
  } catch (err) {
    success = false
    errorMessage = err instanceof Error ? err.message : String(err)
    throw err
  } finally {
    // Log every call for cost tracking — best effort, never throws
    const durationMs = Date.now() - startedAt
    const costCents = estimateCostCents(usage.input_tokens, usage.output_tokens)
    query(
      `INSERT INTO ai_api_calls
         (model, purpose, actor_id, entity_type, entity_id,
          tokens_in, tokens_out, cost_usd_cents, success, error_message)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        MODEL, opts.purpose, opts.actorId ?? null,
        opts.entityType ?? null, opts.entityId ?? null,
        usage.input_tokens, usage.output_tokens, costCents, success, errorMessage,
      ],
    ).catch((e: unknown) => console.error('AI call log failed:', e))

    if (process.env['NODE_ENV'] !== 'production') {
      console.log(`[Claude] ${opts.purpose} ${durationMs}ms ${usage.input_tokens}in/${usage.output_tokens}out $${(costCents / 100).toFixed(4)}`)
    }
  }
}

// Approximate cost for claude-opus-4-6 (update when pricing changes)
function estimateCostCents(tokensIn: number, tokensOut: number): number {
  const inputCostPer1M  = 1500  // $15 per 1M input tokens → 1500 cents
  const outputCostPer1M = 7500  // $75 per 1M output tokens → 7500 cents
  return Math.round(
    (tokensIn / 1_000_000) * inputCostPer1M +
    (tokensOut / 1_000_000) * outputCostPer1M,
  )
}

// ─── SMART+ scoring ───────────────────────────────────────────────────────────

const SMART_SYSTEM_PROMPT = `You are an OKR quality assessor. Evaluate the given OKR against the SMART+ framework:
- Specific: Is the objective clear and well-defined?
- Measurable: Can progress be objectively measured via the key results?
- Achievable: Is it realistic given normal organisational constraints?
- Relevant: Does it connect to broader business goals?
- Time-bound: Is there a clear time horizon?

Score each dimension 0-10. Output ONLY valid JSON in this exact shape:
{
  "specific": <0-10>,
  "measurable": <0-10>,
  "achievable": <0-10>,
  "relevant": <0-10>,
  "timeBound": <0-10>,
  "overall": <0-10>,
  "feedback": {
    "specific": "<one sentence>",
    "measurable": "<one sentence>",
    "achievable": "<one sentence>",
    "relevant": "<one sentence>",
    "timeBound": "<one sentence>",
    "summary": "<two sentences overall>"
  }
}`

export interface SmartScoreResult {
  specific: number
  measurable: number
  achievable: number
  relevant: number
  timeBound: number
  overall: number
  feedback: {
    specific: string
    measurable: string
    achievable: string
    relevant: string
    timeBound: string
    summary: string
  }
}

export async function scoreOkrWithClaude(opts: {
  objectiveId: string
  title: string
  description: string | null
  keyResults: Array<{ title: string; metricType: string; targetValue: number; unit: string | null }>
  cycleEndDate: string
  actorId?: string
}): Promise<SmartScoreResult> {
  const krText = opts.keyResults
    .map((kr, i) => `${i + 1}. "${kr.title}" (${kr.metricType}, target: ${kr.targetValue}${kr.unit ? ' ' + kr.unit : ''})`)
    .join('\n')

  const userPrompt = `Objective: "${opts.title}"
Description: ${opts.description ?? '(none)'}
Time horizon ends: ${opts.cycleEndDate}
Key Results:
${krText || '(none yet)'}`

  const { text } = await callClaude({
    purpose: 'smart_score',
    actorId: opts.actorId,
    entityType: 'objective',
    entityId: opts.objectiveId,
    systemPrompt: SMART_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 512,
  })

  return JSON.parse(text) as SmartScoreResult
}

// ─── Email extraction ─────────────────────────────────────────────────────────

const EMAIL_EXTRACT_SYSTEM_PROMPT = `You are an OKR progress extraction assistant.
Given an email body and a list of the user's active OKRs, identify any information
that represents progress on a key result (e.g., a metric value, a milestone achieved,
a percentage completed, a deal closed, a task finished).

Output ONLY a JSON array of extracted updates. Each item:
{
  "keyResultId": "<id or null if unclear>",
  "objectiveId": "<id or null if unclear>",
  "newValue": <number or null>,
  "confidence": "on_track" | "at_risk" | "off_track" | null,
  "note": "<brief note summarising what happened>",
  "reasoning": "<why you linked this to this KR>",
  "sourceSnippet": "<exact quoted text from the email, max 200 chars>"
}
Return an empty array [] if no relevant updates found.`

export async function extractOkrUpdatesFromEmail(opts: {
  userId: string
  emailBody: string
  activeKeyResults: Array<{ id: string; title: string; objectiveId: string; objectiveTitle: string; currentValue: number; targetValue: number; unit: string | null }>
}): Promise<Array<{
  keyResultId: string | null
  objectiveId: string | null
  newValue: number | null
  confidence: string | null
  note: string
  reasoning: string
  sourceSnippet: string
}>> {
  const krList = opts.activeKeyResults
    .map((kr) => `- KR id=${kr.id}: "${kr.title}" (objective: "${kr.objectiveTitle}", current=${kr.currentValue}, target=${kr.targetValue}${kr.unit ? ' ' + kr.unit : ''})`)
    .join('\n')

  const userPrompt = `Email body:
---
${opts.emailBody.slice(0, 3000)}
---
User's active Key Results:
${krList || '(none)'}`

  const { text } = await callClaude({
    purpose: 'email_extract',
    actorId: opts.userId,
    entityType: 'user',
    entityId: opts.userId,
    systemPrompt: EMAIL_EXTRACT_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 1024,
  })

  return JSON.parse(text) as any[]
}
