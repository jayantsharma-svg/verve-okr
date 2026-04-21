/**
 * Admin routes for Google Sheets sync.
 *
 * POST /admin/sheets/sync    — export OKR data to Sheets
 * POST /admin/sheets/import  — import Updates tab back into DB
 * GET  /admin/sheets/status  — last 20 sync log entries + config status
 */
import { Router } from 'express'
import type { Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { AppError } from '../middleware/error.js'
import { query, queryMany, queryOne } from '../db/client.js'
import { exportToSheets } from '../workers/sheetsExport.js'
import { importFromSheets } from '../workers/sheetsImport.js'

const router = Router()

// All routes require authentication; export/import additionally require admin role
router.use(requireAuth)

function requireAdmin(req: Request) {
  if (req.user!.role !== 'admin') {
    throw new AppError('FORBIDDEN', 'Admin role required', 403)
  }
}

// ─── GET /admin/sheets/status ─────────────────────────────────────────────────

router.get('/status', async (_req: Request, res: Response, next) => {
  try {
    const configured = Boolean(
      process.env['GOOGLE_SERVICE_ACCOUNT_KEY_BASE64'] &&
      process.env['GOOGLE_SHEETS_EXPORT_ID'],
    )

    const logs = await queryMany(
      `SELECT l.id, l.direction, l.status, l.rows_affected, l.error_message,
              l.started_at, l.completed_at,
              u.name AS triggered_by_name, u.email AS triggered_by_email
       FROM sheets_sync_log l
       LEFT JOIN users u ON u.id = l.triggered_by
       ORDER BY l.started_at DESC
       LIMIT 20`,
    )

    const lastExport = await queryOne(
      `SELECT started_at, completed_at, rows_affected, status
       FROM sheets_sync_log
       WHERE direction = 'export' AND status = 'success'
       ORDER BY started_at DESC LIMIT 1`,
    )

    const lastImport = await queryOne(
      `SELECT started_at, completed_at, rows_affected, status
       FROM sheets_sync_log
       WHERE direction = 'import' AND status = 'success'
       ORDER BY started_at DESC LIMIT 1`,
    )

    res.json({
      data: {
        configured,
        spreadsheetId: process.env['GOOGLE_SHEETS_EXPORT_ID'] ?? null,
        spreadsheetUrl: process.env['GOOGLE_SHEETS_EXPORT_ID']
          ? `https://docs.google.com/spreadsheets/d/${process.env['GOOGLE_SHEETS_EXPORT_ID']}`
          : null,
        lastExport,
        lastImport,
        logs,
      },
    })
  } catch (err) {
    next(err)
  }
})

// ─── POST /admin/sheets/sync (export) ────────────────────────────────────────

router.post('/sync', async (req: Request, res: Response, next) => {
  try {
    requireAdmin(req)

    // Insert a "running" log entry
    const log = await queryOne<{ id: string }>(
      `INSERT INTO sheets_sync_log (direction, status, triggered_by)
       VALUES ('export', 'running', $1)
       RETURNING id`,
      [req.user!.sub],
    )
    const logId = log!.id

    // Run export asynchronously so the HTTP response returns immediately
    exportToSheets({})
      .then(async ({ rowsExported }) => {
        await query(
          `UPDATE sheets_sync_log
           SET status = 'success', rows_affected = $1, completed_at = NOW()
           WHERE id = $2`,
          [rowsExported, logId],
        )
        console.log(`[SheetsSync] Export completed: ${rowsExported} rows`)
      })
      .catch(async (err: Error) => {
        await query(
          `UPDATE sheets_sync_log
           SET status = 'failed', error_message = $1, completed_at = NOW()
           WHERE id = $2`,
          [err.message.slice(0, 500), logId],
        )
        console.error('[SheetsSync] Export failed:', err.message)
      })

    res.json({ data: { logId, message: 'Export started. Check /admin/sheets/status for progress.' } })
  } catch (err) {
    next(err)
  }
})

// ─── POST /admin/sheets/import ────────────────────────────────────────────────

router.post('/import', async (req: Request, res: Response, next) => {
  try {
    requireAdmin(req)

    const log = await queryOne<{ id: string }>(
      `INSERT INTO sheets_sync_log (direction, status, triggered_by)
       VALUES ('import', 'running', $1)
       RETURNING id`,
      [req.user!.sub],
    )
    const logId = log!.id

    importFromSheets({ triggeredBy: req.user!.sub })
      .then(async (result) => {
        const totalRows = result.objectivesUpdated + result.keyResultsUpdated
        const errorMsg = result.errors.length ? result.errors.join('; ').slice(0, 500) : null
        await query(
          `UPDATE sheets_sync_log
           SET status = $1, rows_affected = $2, error_message = $3, completed_at = NOW()
           WHERE id = $4`,
          [result.errors.length && !totalRows ? 'failed' : 'success', totalRows, errorMsg, logId],
        )
        console.log(`[SheetsSync] Import completed: ${totalRows} rows updated`)
      })
      .catch(async (err: Error) => {
        await query(
          `UPDATE sheets_sync_log
           SET status = 'failed', error_message = $1, completed_at = NOW()
           WHERE id = $2`,
          [err.message.slice(0, 500), logId],
        )
        console.error('[SheetsSync] Import failed:', err.message)
      })

    res.json({ data: { logId, message: 'Import started. Check /admin/sheets/status for progress.' } })
  } catch (err) {
    next(err)
  }
})

export default router
