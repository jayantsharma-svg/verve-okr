/**
 * Reads the "Updates" tab written by sheetsExport.ts and applies changes back
 * to the database.
 *
 * Editable columns (by position in the sheet):
 *   A  Objective ID       — match key
 *   B  Objective Title    — ignored
 *   C  Objective Status   — update objectives.status if changed
 *   D  KR ID              — match key
 *   E  Key Result         — ignored
 *   F  Current Value      — update key_results.current_value + create check-in
 *   G  Confidence         — update key_results.confidence
 *   H  Notes              — stored as check-in note
 */
import { google } from 'googleapis'
import { withTransaction, queryOne } from '../db/client.js'
import type { PoolClient } from 'pg'

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function getSheetsClient() {
  const keyBase64 = process.env['GOOGLE_SERVICE_ACCOUNT_KEY_BASE64']
  if (!keyBase64) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 not set')

  // Impersonate a Workspace admin via domain-wide delegation so the service
  // account acts as an internal user — bypasses org sharing restrictions.
  const impersonateAs = (process.env['GOOGLE_SHEETS_ADMIN_EMAILS'] ?? '')
    .split(',')[0]?.trim() || process.env['GOOGLE_ADMIN_EMAIL']

  if (!impersonateAs) throw new Error(
    'Set GOOGLE_SHEETS_ADMIN_EMAILS (or GOOGLE_ADMIN_EMAIL) to a Workspace user ' +
    'who has Editor access to the target sheet'
  )

  const keyJson = JSON.parse(Buffer.from(keyBase64, 'base64').toString('utf8'))
  const auth = new google.auth.GoogleAuth({
    credentials: keyJson,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    clientOptions: { subject: impersonateAs },
  })
  return google.sheets({ version: 'v4', auth })
}

const CONFIG_KEY = 'sheets_spreadsheet_id'

async function getSpreadsheetId(): Promise<string> {
  if (process.env['GOOGLE_SHEETS_EXPORT_ID']) return process.env['GOOGLE_SHEETS_EXPORT_ID']
  const row = await queryOne<{ value: string }>(
    'SELECT value FROM system_config WHERE key = $1',
    [CONFIG_KEY],
  )
  if (!row) throw new Error('No spreadsheet configured — run an export first.')
  return row.value
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImportResult {
  objectivesUpdated: number
  keyResultsUpdated: number
  checkInsCreated: number
  skipped: number
  errors: string[]
}

// ─── Import ───────────────────────────────────────────────────────────────────

export async function importFromSheets(opts: { triggeredBy?: string }): Promise<ImportResult> {
  const spreadsheetId = await getSpreadsheetId()
  const sheets = await getSheetsClient()

  // Read the entire Updates tab
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Updates!A:H',
  })

  const rawRows = response.data.values ?? []
  if (rawRows.length < 2) {
    return { objectivesUpdated: 0, keyResultsUpdated: 0, checkInsCreated: 0, skipped: 0, errors: [] }
  }

  // Skip header row
  const dataRows = rawRows.slice(1)

  const result: ImportResult = {
    objectivesUpdated: 0,
    keyResultsUpdated: 0,
    checkInsCreated: 0,
    skipped: 0,
    errors: [],
  }

  const triggeredBy = opts.triggeredBy ?? null

  await withTransaction(async (client: PoolClient) => {
    for (const row of dataRows) {
      const [objectiveId, , objectiveStatus, krId, , currentValueRaw, confidence, notes] = row as string[]

      if (!objectiveId?.trim()) {
        result.skipped++
        continue
      }

      // ── Objective status update ────────────────────────────────────────────
      if (objectiveStatus?.trim()) {
        const validStatuses = ['draft', 'pending_approval', 'active', 'closed', 'deleted']
        const newStatus = objectiveStatus.trim().toLowerCase()

        if (!validStatuses.includes(newStatus)) {
          result.errors.push(`Invalid objective status "${objectiveStatus}" for objective ${objectiveId}`)
        } else {
          const current = await queryOne<{ status: string }>(
            'SELECT status FROM objectives WHERE id = $1',
            [objectiveId],
          )
          if (current && current.status !== newStatus) {
            await client.query(
              'UPDATE objectives SET status = $1, updated_at = NOW() WHERE id = $2',
              [newStatus, objectiveId],
            )
            result.objectivesUpdated++
          }
        }
      }

      // ── Key result update ──────────────────────────────────────────────────
      if (!krId?.trim()) {
        // No KR on this row (objective-only row)
        continue
      }

      const currentValue = currentValueRaw?.trim() !== '' ? parseFloat(currentValueRaw) : null
      const validConfidences = ['on_track', 'at_risk', 'off_track']
      const newConfidence = confidence?.trim().toLowerCase() || null

      if (newConfidence && !validConfidences.includes(newConfidence)) {
        result.errors.push(`Invalid confidence "${confidence}" for KR ${krId}`)
        continue
      }

      // Fetch current DB values
      const kr = await queryOne<{
        id: string
        current_value: number | null
        confidence: string | null
        objective_id: string
        owner_id: string
      }>(
        `SELECT kr.id, kr.current_value, kr.confidence, kr.objective_id,
                o.owner_id
         FROM key_results kr
         JOIN objectives o ON o.id = kr.objective_id
         WHERE kr.id = $1`,
        [krId],
      )

      if (!kr) {
        result.errors.push(`Key result ${krId} not found`)
        continue
      }

      const valueChanged = currentValue !== null && currentValue !== kr.current_value
      const confidenceChanged = newConfidence && newConfidence !== kr.confidence

      if (!valueChanged && !confidenceChanged) {
        result.skipped++
        continue
      }

      // Update key result
      const updates: string[] = []
      const params: unknown[] = []

      if (valueChanged) {
        params.push(currentValue)
        updates.push(`current_value = $${params.length}`)
        params.push(new Date().toISOString())
        updates.push(`last_checkin_at = $${params.length}`)
      }
      if (confidenceChanged) {
        params.push(newConfidence)
        updates.push(`confidence = $${params.length}`)
      }

      params.push(krId)
      await client.query(
        `UPDATE key_results SET ${updates.join(', ')} WHERE id = $${params.length}`,
        params,
      )
      result.keyResultsUpdated++

      // Create a check-in record when value changes
      if (valueChanged) {
        const note = notes?.trim() || `Updated via Google Sheets import`
        await client.query(
          `INSERT INTO checkins
             (key_result_id, author_id, previous_value, new_value, confidence, note)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            krId,
            triggeredBy ?? kr.owner_id,
            kr.current_value ?? 0,
            currentValue,
            newConfidence ?? kr.confidence,
            note,
          ],
        )
        result.checkInsCreated++
      }
    }
  })

  console.log(
    `[SheetsImport] objectives=${result.objectivesUpdated} krs=${result.keyResultsUpdated}` +
    ` checkins=${result.checkInsCreated} skipped=${result.skipped} errors=${result.errors.length}`,
  )
  return result
}
