'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, XCircle, AlertCircle, ClipboardCheck } from 'lucide-react'
import { api } from '@/lib/api'
import { cn, formatDate } from '@/lib/utils'
import type { Objective, OkrLevel } from '@okr-tool/core'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LEVEL_STYLES: Record<OkrLevel, string> = {
  company:    'text-violet-700 bg-violet-50 border-violet-200',
  department: 'text-blue-700 bg-blue-50 border-blue-200',
  team:       'text-teal-700 bg-teal-50 border-teal-200',
  individual: 'text-gray-600 bg-gray-100 border-gray-200',
}

const LEVEL_LABELS: Record<OkrLevel, string> = {
  company:    'Company',
  department: 'Department',
  team:       'Team',
  individual: 'Individual',
}

function LevelBadge({ level }: { level: OkrLevel }) {
  return (
    <span className={cn(
      'inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border',
      LEVEL_STYLES[level],
    )}>
      {LEVEL_LABELS[level]}
    </span>
  )
}

// ─── Row skeleton ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5, 6].map(i => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + i * 7}%` }} />
        </td>
      ))}
    </tr>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PendingApprovalsPage() {
  const qc = useQueryClient()

  const { data: objectives, isLoading, isError } = useQuery({
    queryKey: ['objectives', 'pending'],
    queryFn: () => api.objectives.list({ status: 'pending_approval' }),
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approved' | 'rejected' }) =>
      api.objectives.approve(id, { action }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['objectives'] })
    },
  })

  const isPending = (id: string) =>
    approveMutation.isPending && approveMutation.variables?.id === id

  const hasError = (id: string) =>
    approveMutation.isError && approveMutation.variables?.id === id
      ? (approveMutation.error as any)?.message ?? 'Action failed'
      : null

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review and approve OKRs submitted for approval
        </p>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

        {isError ? (
          <div className="p-8 text-center text-sm text-red-500 flex items-center justify-center gap-2">
            <AlertCircle size={15} /> Failed to load pending approvals.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Title', 'Level', 'Owner', 'Department', 'Submitted', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : !objectives?.length ? null : (
                (objectives as Objective[]).map(obj => {
                  const loading = isPending(obj.id)
                  const errMsg = hasError(obj.id)

                  return (
                    <tr key={obj.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 max-w-xs truncate" title={obj.title}>
                          {obj.title}
                        </p>
                        {errMsg && (
                          <p className="text-xs text-red-500 mt-0.5">{errMsg}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <LevelBadge level={obj.level} />
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {obj.owner?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {obj.department ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 tabular-nums whitespace-nowrap">
                        {formatDate(obj.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => approveMutation.mutate({ id: obj.id, action: 'approved' })}
                            disabled={loading}
                            className={cn(
                              'inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors',
                              loading
                                ? 'text-gray-400 border-gray-200 cursor-not-allowed'
                                : 'text-green-700 border-green-200 bg-green-50 hover:bg-green-100',
                            )}
                          >
                            {loading ? (
                              <span className="inline-block w-3 h-3 border-2 border-green-300 border-t-green-600 rounded-full animate-spin" />
                            ) : (
                              <CheckCircle2 size={12} />
                            )}
                            Approve
                          </button>
                          <button
                            onClick={() => approveMutation.mutate({ id: obj.id, action: 'rejected' })}
                            disabled={loading}
                            className={cn(
                              'inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors',
                              loading
                                ? 'text-gray-400 border-gray-200 cursor-not-allowed'
                                : 'text-red-700 border-red-200 bg-red-50 hover:bg-red-100',
                            )}
                          >
                            {loading ? (
                              <span className="inline-block w-3 h-3 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                            ) : (
                              <XCircle size={12} />
                            )}
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        )}

        {/* Empty state — outside table so it renders properly */}
        {!isLoading && !isError && !objectives?.length && (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <ClipboardCheck size={26} className="text-green-500" />
            </div>
            <p className="text-base font-semibold text-gray-700">No pending approvals 🎉</p>
            <p className="text-sm text-gray-400 mt-1">All OKRs have been reviewed — you're all caught up.</p>
          </div>
        )}
      </div>
    </div>
  )
}
