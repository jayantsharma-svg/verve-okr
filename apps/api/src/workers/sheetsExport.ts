/**
 * Exports OKR data to Google Sheets.
 *
 * Writes two tabs:
 *   "OKR Data"  — full read-only export of every OKR row (sourced from v_okr_export)
 *   "Updates"   — editable template managers fill in with progress / status changes;
 *                 read back by sheetsImport.ts
 */
import { google, sheets_v4 } from 'googleapis'
import { queryMany } from '../db/client.js'

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  const keyBase64 = process.env['GOOGLE_SERVICE_ACCOUNT_KEY_BASE64']
  if (!keyBase64) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 not set')

  const keyJson = JSON.parse(Buffer.from(keyBase64, 'base64').toString('utf8'))
  const auth = new google.auth.GoogleAuth({
    credentials: keyJson,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return google.sheets({ version: 'v4', auth })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Ensure a sheet tab with the given title exists; returns its sheetId. */
async function ensureSheet(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  title: string,
): Promise<number> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId })
  const existing = meta.data.sheets?.find((s) => s.properties?.title === title)
  if (existing) return existing.properties!.sheetId!

  const res = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title } } }],
    },
  })
  return res.data.replies![0].addSheet!.properties!.sheetId!
}

/** Header colour — steel blue */
const HEADER_BG = { red: 0.263, green: 0.396, blue: 0.643 }

/** Build a format-header + freeze request for a sheet tab. */
function headerRequests(
  sheetId: number,
  columnCount: number,
): sheets_v4.Schema$Request[] {
  return [
    // Bold white text on blue background for row 0
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: columnCount },
        cell: {
          userEnteredFormat: {
            backgroundColor: HEADER_BG,
            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    },
    // Freeze first row
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: 'gridProperties.frozenRowCount',
      },
    },
    // Auto-resize all columns
    {
      autoResizeDimensions: {
        dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: columnCount },
      },
    },
  ]
}

// ─── Export ───────────────────────────────────────────────────────────────────

export interface ExportResult {
  rowsExported: number
  spreadsheetUrl: string
}

export async function exportToSheets(_opts: { exportId?: string }): Promise<ExportResult> {
  const spreadsheetId = process.env['GOOGLE_SHEETS_EXPORT_ID']
  if (!spreadsheetId) throw new Error('GOOGLE_SHEETS_EXPORT_ID not configured')

  const sheets = await getSheetsClient()

  // ── 1. Fetch all OKR rows ────────────────────────────────────────────────
  const rows = await queryMany(
    `SELECT * FROM v_okr_export ORDER BY cycle, department, team, owner_name, level`,
  )

  // ── 2. Write "OKR Data" tab ──────────────────────────────────────────────
  const dataSheetId = await ensureSheet(sheets, spreadsheetId, 'OKR Data')

  const dataHeaders = [
    'Objective ID', 'Cycle', 'Level', 'Objective', 'Description', 'Status',
    'Visibility', 'Owner Name', 'Owner Email', 'Department', 'Team',
    'Parent Objective', 'Key Result ID', 'Key Result', 'Metric Type',
    'Start Value', 'Target Value', 'Current Value', 'Unit', 'Confidence',
    'Progress %', 'Last Check-in', 'Created At', 'Updated At',
  ]

  const dataValues: (string | number | null)[][] = [
    dataHeaders,
    ...rows.map((r: any) => [
      r.objective_id,           r.cycle,                    r.level,
      r.objective_title,        r.objective_description ?? '', r.objective_status,
      r.visibility,             r.owner_name,               r.owner_email,
      r.department ?? '',       r.team ?? '',               r.parent_objective_title ?? '',
      r.key_result_id ?? '',    r.key_result_title ?? '',   r.metric_type ?? '',
      r.start_value ?? '',      r.target_value ?? '',       r.current_value ?? '',
      r.unit ?? '',             r.confidence ?? '',         r.progress_pct ?? '',
      r.last_checkin_at ?? '',  r.created_at,               r.updated_at,
    ]),
  ]

  await sheets.spreadsheets.values.clear({ spreadsheetId, range: 'OKR Data!A:Z' })
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'OKR Data!A1',
    valueInputOption: 'RAW',
    requestBody: { values: dataValues },
  })

  // ── 3. Write "Updates" tab (editable template) ───────────────────────────
  const updatesSheetId = await ensureSheet(sheets, spreadsheetId, 'Updates')

  // Build one row per key-result (or one per objective if no KRs)
  const updatesHeaders = [
    'Objective ID',     // A — reference key (do not edit)
    'Objective Title',  // B — read-only reference
    'Objective Status', // C — EDITABLE: draft|pending_approval|active|closed
    'KR ID',            // D — reference key (do not edit)
    'Key Result',       // E — read-only reference
    'Current Value',    // F — EDITABLE: numeric
    'Confidence',       // G — EDITABLE: on_track|at_risk|off_track
    'Notes',            // H — EDITABLE: free text, recorded as check-in note
  ]

  // Build one row per KR; if an objective has no KRs, still emit one row for status edits
  const objectivesSeen = new Set<string>()
  const updatesRows: (string | number | null)[][] = rows.map((r: any) => {
    const isFirstForObjective = !objectivesSeen.has(r.objective_id)
    objectivesSeen.add(r.objective_id)
    return [
      r.objective_id,
      isFirstForObjective ? r.objective_title : '',   // show title only once per objective
      isFirstForObjective ? r.objective_status : '',  // editable on first row
      r.key_result_id ?? '',
      r.key_result_title ?? '',
      r.current_value ?? '',
      r.confidence ?? '',
      '',  // Notes — always blank on export
    ]
  })

  await sheets.spreadsheets.values.clear({ spreadsheetId, range: 'Updates!A:H' })
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Updates!A1',
    valueInputOption: 'RAW',
    requestBody: { values: [updatesHeaders, ...updatesRows] },
  })

  // ── 4. Formatting for both tabs ──────────────────────────────────────────
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        ...headerRequests(dataSheetId, dataHeaders.length),
        ...headerRequests(updatesSheetId, updatesHeaders.length),
        // Highlight editable columns in Updates tab (C, F, G, H) with light yellow
        {
          repeatCell: {
            range: { sheetId: updatesSheetId, startRowIndex: 1, startColumnIndex: 2, endColumnIndex: 3 },
            cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 0.976, blue: 0.816 } } },
            fields: 'userEnteredFormat.backgroundColor',
          },
        },
        {
          repeatCell: {
            range: { sheetId: updatesSheetId, startRowIndex: 1, startColumnIndex: 5, endColumnIndex: 8 },
            cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 0.976, blue: 0.816 } } },
            fields: 'userEnteredFormat.backgroundColor',
          },
        },
      ],
    },
  })

  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
  console.log(`[SheetsExport] Exported ${rows.length} rows → ${spreadsheetUrl}`)
  return { rowsExported: rows.length, spreadsheetUrl }
}
