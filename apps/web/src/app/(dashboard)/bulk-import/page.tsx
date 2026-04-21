'use client'

import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  Upload, Download, CheckCircle2, XCircle, AlertTriangle,
  Loader2, FileSpreadsheet, ArrowRight, RotateCcw, ChevronDown, ChevronRight,
} from 'lucide-react'

type JobType = 'create' | 'update'
type JobStatus = 'idle' | 'uploading' | 'preview' | 'committing' | 'committed'

interface RowResult {
  rowNumber: number
  status: 'success' | 'warning' | 'error'
  data: Record<string, any>
  errors: string[]
  warnings: string[]
  createdId?: string
}

interface UploadResult {
  id: string
  jobType: string
  totalRows: number
  successRows: number
  errorRows: number
  rowResults: RowResult[]
  status: string
}

export default function BulkImportPage() {
  const [jobType, setJobType] = useState<JobType>('create')
  const [status, setStatus] = useState<JobStatus>('idle')
  const [result, setResult] = useState<UploadResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.bulk.uploadFile(file, jobType) as Promise<UploadResult>,
    onSuccess: (data) => {
      setResult(data as any)
      setStatus('preview')
    },
    onError: () => setStatus('idle'),
  })

  const commitMutation = useMutation({
    mutationFn: () => api.bulk.commit(result!.id) as Promise<any>,
    onSuccess: () => setStatus('committed'),
    onError: () => {},
  })

  const handleFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext ?? '')) return
    setStatus('uploading')
    uploadMutation.mutate(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const reset = () => {
    setStatus('idle')
    setResult(null)
    uploadMutation.reset()
    commitMutation.reset()
    if (fileRef.current) fileRef.current.value = ''
  }

  const successRows = result?.rowResults.filter(r => r.status !== 'error') ?? []
  const errorRows   = result?.rowResults.filter(r => r.status === 'error') ?? []
  const warnRows    = result?.rowResults.filter(r => r.status === 'warning') ?? []

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Bulk Import</h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload a spreadsheet to create or update OKRs in bulk.
          </p>
        </div>
        {status !== 'idle' && status !== 'uploading' && (
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium"
          >
            <RotateCcw size={14} /> Start over
          </button>
        )}
      </div>

      {/* Job type selector + template download */}
      {status === 'idle' && (
        <>
          <div className="flex gap-3 mb-6">
            {(['create', 'update'] as const).map(t => (
              <button
                key={t}
                onClick={() => setJobType(t)}
                className={cn(
                  'flex-1 py-3 rounded-xl border-2 text-sm font-medium capitalize transition-all',
                  jobType === t
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300',
                )}
              >
                {t === 'create' ? '+ Create OKRs' : '✏️ Update KR values'}
              </button>
            ))}
          </div>

          {/* Template download */}
          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 mb-5">
            <div>
              <p className="text-sm font-medium text-gray-800">Download template</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {jobType === 'create'
                  ? 'Fill in title, level, cycle_id and other fields.'
                  : 'Fill in key_result_id and new_value for each KR.'}
              </p>
            </div>
            <a
              href={api.bulk.templateUrl(jobType)}
              download
              className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-200 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <Download size={15} /> Download .xlsx
            </a>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all',
              dragOver
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
            )}
          >
            <FileSpreadsheet className="mx-auto text-gray-300 mb-3" size={40} />
            <p className="text-sm font-medium text-gray-700">Drop your file here</p>
            <p className="text-xs text-gray-400 mt-1">or click to browse · .xlsx, .xls, .csv · max 10 MB</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
        </>
      )}

      {/* Uploading */}
      {status === 'uploading' && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-3">
          <Loader2 className="animate-spin text-blue-500" size={32} />
          <p className="text-sm font-medium">Validating your file…</p>
        </div>
      )}

      {/* Preview */}
      {status === 'preview' && result && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <SummaryCard
              label="Ready to import"
              value={successRows.length}
              color="green"
              icon={<CheckCircle2 size={16} />}
            />
            <SummaryCard
              label="Warnings"
              value={warnRows.length}
              color="amber"
              icon={<AlertTriangle size={16} />}
            />
            <SummaryCard
              label="Errors (skipped)"
              value={errorRows.length}
              color="red"
              icon={<XCircle size={16} />}
            />
          </div>

          {/* Error rows */}
          {errorRows.length > 0 && (
            <CollapsibleSection
              title={`${errorRows.length} error${errorRows.length !== 1 ? 's' : ''} — these rows will be skipped`}
              color="red"
              defaultOpen
            >
              <div className="space-y-2">
                {errorRows.map(row => (
                  <RowCard key={row.rowNumber} row={row} />
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Warning rows */}
          {warnRows.length > 0 && (
            <CollapsibleSection
              title={`${warnRows.length} warning${warnRows.length !== 1 ? 's' : ''} — will be imported with caution`}
              color="amber"
              defaultOpen={false}
            >
              <div className="space-y-2">
                {warnRows.map(row => (
                  <RowCard key={row.rowNumber} row={row} />
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Success rows preview (collapsed) */}
          {successRows.length > 0 && (
            <CollapsibleSection
              title={`${successRows.length} row${successRows.length !== 1 ? 's' : ''} ready to import`}
              color="green"
              defaultOpen={false}
            >
              <div className="space-y-2">
                {successRows.slice(0, 20).map(row => (
                  <RowCard key={row.rowNumber} row={row} />
                ))}
                {successRows.length > 20 && (
                  <p className="text-xs text-gray-400 text-center py-2">
                    + {successRows.length - 20} more rows
                  </p>
                )}
              </div>
            </CollapsibleSection>
          )}

          {/* Commit / cancel */}
          {commitMutation.error && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <XCircle size={14} /> {(commitMutation.error as Error).message}
            </p>
          )}
          <div className="flex gap-3 pt-2">
            <button
              onClick={reset}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { setStatus('committing'); commitMutation.mutate() }}
              disabled={successRows.length === 0 || commitMutation.isPending}
              className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {commitMutation.isPending ? (
                <><Loader2 size={15} className="animate-spin" /> Importing…</>
              ) : (
                <><ArrowRight size={15} /> Import {successRows.length} row{successRows.length !== 1 ? 's' : ''}</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Committed */}
      {status === 'committed' && (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="text-green-600" size={32} />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Import complete!</h2>
          <p className="text-sm text-gray-500 mt-1">
            {successRows.length} row{successRows.length !== 1 ? 's' : ''} were imported successfully.
            {errorRows.length > 0 && ` ${errorRows.length} row${errorRows.length !== 1 ? 's' : ''} skipped due to errors.`}
          </p>
          <div className="flex justify-center gap-3 mt-6">
            <button onClick={reset} className="text-sm text-gray-500 hover:text-gray-700 font-medium border border-gray-200 px-4 py-2 rounded-lg">
              Import another file
            </button>
            <a href="/objectives" className="text-sm bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              View OKRs
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({ label, value, color, icon }: {
  label: string; value: number; color: 'green' | 'amber' | 'red'; icon: React.ReactNode
}) {
  const colors = {
    green: 'bg-green-50 text-green-600 border-green-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    red:   'bg-red-50 text-red-600 border-red-100',
  }
  return (
    <div className={cn('rounded-xl border p-4', colors[color])}>
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-2xl font-bold">{value}</span></div>
      <p className="text-xs font-medium opacity-80">{label}</p>
    </div>
  )
}

function CollapsibleSection({ title, color, defaultOpen, children }: {
  title: string
  color: 'green' | 'amber' | 'red'
  defaultOpen: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const iconColor = { green: 'text-green-600', amber: 'text-amber-600', red: 'text-red-600' }[color]

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className={cn('text-sm font-medium', iconColor)}>{title}</span>
        {open ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronRight size={15} className="text-gray-400" />}
      </button>
      {open && <div className="px-4 pb-4 border-t border-gray-50">{children}</div>}
    </div>
  )
}

function RowCard({ row }: { row: RowResult }) {
  const borderColor = {
    success: 'border-l-green-400',
    warning: 'border-l-amber-400',
    error:   'border-l-red-400',
  }[row.status]

  return (
    <div className={cn('border-l-4 pl-3 py-2 mt-2', borderColor)}>
      <p className="text-xs text-gray-500 mb-0.5">Row {row.rowNumber}</p>
      {row.data.title && (
        <p className="text-sm font-medium text-gray-800 truncate">{String(row.data.title)}</p>
      )}
      {row.data.key_result_id && (
        <p className="text-xs text-gray-500 font-mono truncate">KR: {String(row.data.key_result_id)}</p>
      )}
      {row.errors.map((e, i) => (
        <p key={i} className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
          <XCircle size={11} /> {e}
        </p>
      ))}
      {row.warnings.map((w, i) => (
        <p key={i} className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
          <AlertTriangle size={11} /> {w}
        </p>
      ))}
    </div>
  )
}
