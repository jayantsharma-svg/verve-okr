'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  RefreshCw, Download, Upload, ExternalLink,
  CheckCircle2, XCircle, Clock, AlertCircle, Settings,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn, formatDate } from '@/lib/utils'
import type { SheetsSyncLogEntry } from '@okr-tool/core'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'success') return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
      <CheckCircle2 size={11} /> Success
    </span>
  )
  if (status === 'failed') return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
      <XCircle size={11} /> Failed
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
      <Clock size={11} className="animate-spin" /> Running
    </span>
  )
}

function DirectionBadge({ direction }: { direction: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border',
      direction === 'export'
        ? 'text-blue-700 bg-blue-50 border-blue-200'
        : 'text-purple-700 bg-purple-50 border-purple-200',
    )}>
      {direction === 'export' ? <Upload size={11} /> : <Download size={11} />}
      {direction === 'export' ? 'Export' : 'Import'}
    </span>
  )
}

function duration(started: string, completed: string | null) {
  if (!completed) return '—'
  const ms = new Date(completed).getTime() - new Date(started).getTime()
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SheetsPage() {
  const qc = useQueryClient()
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [importMsg, setImportMsg] = useState<string | null>(null)

  const { data: status, isLoading, isError } = useQuery({
    queryKey: ['sheets-status'],
    queryFn: () => api.admin.sheets.status(),
    refetchInterval: 5000,   // poll every 5s to catch running → done transitions
  })

  const syncMutation = useMutation({
    mutationFn: () => api.admin.sheets.sync(),
    onSuccess: (res) => {
      setSyncMsg(res.message)
      qc.invalidateQueries({ queryKey: ['sheets-status'] })
      setTimeout(() => setSyncMsg(null), 6000)
    },
  })

  const importMutation = useMutation({
    mutationFn: () => api.admin.sheets.import(),
    onSuccess: (res) => {
      setImportMsg(res.message)
      qc.invalidateQueries({ queryKey: ['sheets-status'] })
      setTimeout(() => setImportMsg(null), 6000)
    },
  })

  const busy = syncMutation.isPending || importMutation.isPending

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Google Sheets Sync</h1>
        <p className="mt-1 text-sm text-gray-500">
          Export OKR data to Google Sheets for reporting, and import manager updates back into the system.
        </p>
      </div>

      {/* Config warning */}
      {!isLoading && !status?.configured && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertCircle size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">Google Sheets not configured</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Set <code className="bg-amber-100 px-1 rounded text-xs">GOOGLE_SERVICE_ACCOUNT_KEY_BASE64</code> and{' '}
              <code className="bg-amber-100 px-1 rounded text-xs">GOOGLE_SHEETS_EXPORT_ID</code> in your API environment to enable sync.
            </p>
          </div>
        </div>
      )}

      {/* Actions + last-sync cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Export card */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
              <Upload size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Export to Sheets</p>
              <p className="text-xs text-gray-500">Pushes all OKR data into the spreadsheet</p>
            </div>
          </div>

          {status?.lastExport && (
            <div className="text-xs text-gray-500 space-y-0.5">
              <p>Last run: <span className="text-gray-700 font-medium">{formatDate(status.lastExport.startedAt)}</span></p>
              <p>Rows exported: <span className="text-gray-700 font-medium">{status.lastExport.rowsAffected ?? '—'}</span></p>
            </div>
          )}

          {syncMsg && (
            <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              {syncMsg}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => syncMutation.mutate()}
              disabled={busy || !status?.configured}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                status?.configured && !busy
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed',
              )}
            >
              <RefreshCw size={14} className={syncMutation.isPending ? 'animate-spin' : ''} />
              {syncMutation.isPending ? 'Exporting…' : 'Sync Now'}
            </button>

            {status?.spreadsheetUrl && (
              <a
                href={status.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ExternalLink size={13} /> Open Sheet
              </a>
            )}
          </div>
        </div>

        {/* Import card */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center">
              <Download size={18} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Import from Sheets</p>
              <p className="text-xs text-gray-500">Reads the <em>Updates</em> tab and applies changes</p>
            </div>
          </div>

          <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 space-y-1">
            <p className="font-medium text-gray-700">Editable columns in the Updates tab:</p>
            <p>• <span className="font-medium">Objective Status</span> — change OKR stage</p>
            <p>• <span className="font-medium">Current Value</span> — update KR progress</p>
            <p>• <span className="font-medium">Confidence</span> — on_track / at_risk / off_track</p>
            <p>• <span className="font-medium">Notes</span> — recorded as a check-in note</p>
          </div>

          {status?.lastImport && (
            <div className="text-xs text-gray-500 space-y-0.5">
              <p>Last run: <span className="text-gray-700 font-medium">{formatDate(status.lastImport.startedAt)}</span></p>
              <p>Rows updated: <span className="text-gray-700 font-medium">{status.lastImport.rowsAffected ?? '—'}</span></p>
            </div>
          )}

          {importMsg && (
            <p className="text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
              {importMsg}
            </p>
          )}

          <button
            onClick={() => importMutation.mutate()}
            disabled={busy || !status?.configured}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              status?.configured && !busy
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed',
            )}
          >
            <Download size={14} className={importMutation.isPending ? 'animate-spin' : ''} />
            {importMutation.isPending ? 'Importing…' : 'Import Updates'}
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Settings size={15} className="text-gray-400" /> How it works
        </h2>
        <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside">
          <li>Click <strong>Sync Now</strong> to export all OKRs into the Google Sheet — two tabs are written:
            <em> OKR Data</em> (full read-only view) and <em>Updates</em> (editable template, highlighted in yellow).</li>
          <li>Share the Sheet with your team. Managers fill in <strong>Current Value</strong>, <strong>Confidence</strong>,
            <strong>Objective Status</strong>, and optional <strong>Notes</strong> in the Updates tab.</li>
          <li>Click <strong>Import Updates</strong> to read the sheet and apply every changed value back to the database.
            Check-in records are automatically created for KR value changes.</li>
        </ol>
      </div>

      {/* Sync history */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Sync History</h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : isError ? (
          <div className="p-8 text-center text-sm text-red-500">Failed to load history.</div>
        ) : !status?.logs?.length ? (
          <div className="p-8 text-center text-sm text-gray-400">No syncs yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Type', 'Status', 'Rows', 'Duration', 'Triggered by', 'Started at', 'Error'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {status.logs.map((log: SheetsSyncLogEntry) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3"><DirectionBadge direction={log.direction} /></td>
                  <td className="px-4 py-3"><StatusBadge status={log.status} /></td>
                  <td className="px-4 py-3 text-gray-700">{log.rowsAffected ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 tabular-nums">{duration(log.startedAt, log.completedAt)}</td>
                  <td className="px-4 py-3 text-gray-600">{log.triggeredByName ?? 'Scheduler'}</td>
                  <td className="px-4 py-3 text-gray-500 tabular-nums whitespace-nowrap">{formatDate(log.startedAt)}</td>
                  <td className="px-4 py-3 text-red-600 text-xs max-w-xs truncate" title={log.errorMessage ?? ''}>
                    {log.errorMessage ?? ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
