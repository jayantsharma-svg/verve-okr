/**
 * Exports OKR data to Google Sheets.
 *
 * Writes two tabs:
 *   "OKR Data"  — full read-only export of every OKR row (sourced from v_okr_export)
 *   "Updates"   — editable template managers fill in with progress / status changes;
 *                 read back by sheetsImport.ts
 *
 * On first run the spreadsheet is auto-created in the service account's own Drive
 * and shared (writer access) with every email in GOOGLE_SHEETS_ADMIN_EMAILS.
 */
import { google, sheets_v4, drive_v3 } from 'googleapis'
import { queryMany, queryOne, query } from '../db/client.js'

const CONFIG_KEY = 'sheets_spreadsheet_id'

// ─── Auth ─────────────────────────────────────────────────────────────────────

function buildAuth() {
  const keyBase64 = process.env['GOOGLE_SERVICE_ACCOUNT_KEY_BASE64']
  if (!keyBase64) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 not set')
  const keyJson = JSON.parse(Buffer.from(keyBase64, 'base64').toString('utf8'))
  return new google.auth.GoogleAuth({
    credentials: keyJson,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',   // manage files this SA created
    ],
  })
}

async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  return google.sheets({ version: 'v4', auth: buildAuth() })
}

async function getDriveClient(): Promise<drive_v3.Drive> {
  return google.drive({ version: 'v3', auth: buildAuth() })
}

// ─── Drive sharing ────────────────────────────────────────────────────────────

/**
 * Share the spreadsheet (writer access) with every email in
 * GOOGLE_SHEETS_ADMIN_EMAILS (comma-separated). Called once on first creation.
 * Failures are logged as warnings — they don't abort the export.
 */
async function shareWithAdmins(drive: drive_v3.Drive, spreadsheetId: string): Promise<void> {
  const emailsEnv = process.env['GOOGLE_SHEETS_ADMIN_EMAILS'] ?? ''
  const emails = emailsEnv.split(',').map(e => e.trim()).filter(Boolean)

  if (emails.length === 0) {
    console.warn('[SheetsExport] GOOGLE_SHEETS_ADMIN_EMAILS not set — sheet will not be visible to anyone')
    return
  }

  for (const email of emails) {
    try {
      await drive.permissions.create({
        fileId: spreadsheetId,
        sendNotificationEmail: false,
        requestBody: { type: 'user', role: 'writer', emailAddress: email },
      })
      console.log(`[SheetsExport] Shared spreadsheet with ${email}`)
    } catch (err: any) {
      console.warn(`[SheetsExport] Could not share with ${email}: ${err.message}`)
    }
  }
}

// ─── Spreadsheet ID resolution ────────────────────────────────────────────────

/**
 * Returns the spreadsheet ID.
 * Priority: env var → DB config → auto-create (stored back to DB + shared with admins).
 */
async function getOrCreateSpreadsheetId(
  sheets: sheets_v4.Sheets,
  drive: drive_v3.Drive,
): Promise<string> {
  // 1. Explicit env override (useful for testing / migration to a pre-existing sheet)
  if (process.env['GOOGLE_SHEETS_EXPORT_ID']) {
    return process.env['GOOGLE_SHEETS_EXPORT_ID']
  }

  // 2. Previously auto-created ID stored in DB
  const row = await queryOne<{ value: string }>(
    'SELECT value FROM system_config WHERE key = $1',
    [CONFIG_KEY],
  )
  if (row) return row.value

  // 3. First run — create a new spreadsheet, persist its ID, and share with admins
  const res = await sheets.spreadsheets.create({
    requestBody: { properties: { title: 'Verve OKR Sync' } },
  })
  const id = res.data.spreadsheetId!

  await query(
    `INSERT INTO system_config (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [CONFIG_KEY, id],
  )
  console.log(`[SheetsExport] Created new spreadsheet: ${id}`)

  // Share with configured admin emails so they can edit the Updates tab
  await shareWithAdmins(drive, id)

  return id
}

// ─── Sheet tab helpers ────────────────────────────────────────────────────────

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
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  })
  return res.data.replies![0].addSheet!.properties!.sheetId!
}

/** Header colour — steel blue */
const HEADER_BG = { red: 0.263, green: 0.396, blue: 0.643 }

/** Build format-header + freeze + auto-resize requests for a tab. */
function headerRequests(sheetId: number, columnCount: number): sheets_v4.Schema$Request[] {
  return [
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
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: 'gridProperties.frozenRowCount',
      },
    },
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
  const sheets = await getSheetsClient()
  const drive  = await getDriveClient()
  const spreadsheetId = await getOrCreateSpreadsheetId(sheets, drive)

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

  const objectivesSeen = new Set<string>()
  const updatesRows: (string | number | null)[][] = rows.map((r: any) => {
    const isFirstForObjective = !objectivesSeen.has(r.objective_id)
    objectivesSeen.add(r.objective_id)
    return [
      r.objective_id,
      isFirstForObjective ? r.objective_title  : '',
      isFirstForObjective ? r.objective_status : '',
      r.key_result_id    ?? '',
      r.key_result_title ?? '',
      r.current_value    ?? '',
      r.confidence       ?? '',
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
