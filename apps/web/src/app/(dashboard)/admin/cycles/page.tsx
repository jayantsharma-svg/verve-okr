'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ChevronRight, Calendar, AlertCircle, CheckCircle2, X } from 'lucide-react'
import { api } from '@/lib/api'
import { cn, formatDate } from '@/lib/utils'
import type { Cycle, CycleStatus, CycleType } from '@okr-tool/core'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_TRANSITIONS: Record<CycleStatus, CycleStatus | null> = {
  planning: 'active',
  active:   'review',
  review:   'closed',
  closed:   null,
}

const STATUS_NEXT_LABEL: Record<CycleStatus, string> = {
  planning: 'Activate',
  active:   'Move to Review',
  review:   'Close',
  closed:   '',
}

function CycleStatusBadge({ status }: { status: CycleStatus }) {
  const styles: Record<CycleStatus, string> = {
    planning: 'text-gray-600 bg-gray-100 border-gray-200',
    active:   'text-green-700 bg-green-50 border-green-200',
    review:   'text-amber-700 bg-amber-50 border-amber-200',
    closed:   'text-gray-500 bg-gray-50 border-gray-200',
  }
  const labels: Record<CycleStatus, string> = {
    planning: 'Planning',
    active:   'Active',
    review:   'Review',
    closed:   'Closed',
  }
  return (
    <span className={cn(
      'inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border',
      styles[status],
    )}>
      {labels[status]}
    </span>
  )
}

// ─── Create Form ──────────────────────────────────────────────────────────────

interface CreateFormState {
  name: string
  type: CycleType
  startDate: string
  endDate: string
}

const EMPTY_FORM: CreateFormState = { name: '', type: 'annual', startDate: '', endDate: '' }

function CreateCycleForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<CreateFormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: () =>
      api.cycles.create({
        name:      form.name,
        type:      form.type,
        startDate: form.startDate,
        endDate:   form.endDate,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cycles'] })
      onSuccess()
    },
    onError: (err: any) => {
      setError(err?.message ?? 'Failed to create cycle')
    },
  })

  const field = (label: string, children: React.ReactNode) => (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )

  const inputClass =
    'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 transition-colors bg-white'

  return (
    <div className="bg-white border border-blue-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">New Cycle</h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {field('Name',
          <input
            type="text"
            placeholder="e.g. Q3 2026"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className={inputClass}
          />,
        )}

        {field('Type',
          <select
            value={form.type}
            onChange={e => setForm(f => ({ ...f, type: e.target.value as CycleType }))}
            className={inputClass}
          >
            <option value="annual">Annual</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom</option>
          </select>,
        )}

        {field('Start Date',
          <input
            type="date"
            value={form.startDate}
            onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
            className={inputClass}
          />,
        )}

        {field('End Date',
          <input
            type="date"
            value={form.endDate}
            onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
            className={inputClass}
          />,
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertCircle size={13} /> {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !form.name || !form.startDate || !form.endDate}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
            !mutation.isPending && form.name && form.startDate && form.endDate
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed',
          )}
        >
          {mutation.isPending ? (
            <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <Plus size={14} />
          )}
          {mutation.isPending ? 'Creating…' : 'Create Cycle'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CyclesPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [statusErrors, setStatusErrors] = useState<Record<string, string>>({})

  const { data: cycles, isLoading, isError } = useQuery({
    queryKey: ['cycles'],
    queryFn: () => api.cycles.list(),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.cycles.updateStatus(id, status),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['cycles'] })
      setStatusErrors(prev => { const next = { ...prev }; delete next[vars.id]; return next })
    },
    onError: (err: any, vars) => {
      setStatusErrors(prev => ({
        ...prev,
        [vars.id]: err?.message ?? 'Failed to update status',
      }))
    },
  })

  const handleFormSuccess = () => {
    setShowForm(false)
    setSuccessMsg('Cycle created successfully.')
    setTimeout(() => setSuccessMsg(null), 5000)
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cycle Management</h1>
          <p className="mt-1 text-sm text-gray-500">Manage OKR planning cycles</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={15} /> Create Cycle
          </button>
        )}
      </div>

      {/* Success toast */}
      {successMsg && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
          <CheckCircle2 size={15} /> {successMsg}
        </div>
      )}

      {/* Inline create form */}
      {showForm && (
        <CreateCycleForm
          onSuccess={handleFormSuccess}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Cycles list */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">All Cycles</h2>
        </div>

        {isLoading ? (
          <div className="space-y-px divide-y divide-gray-50">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-50 animate-pulse mx-4 my-3 rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-sm text-red-500 flex items-center justify-center gap-2">
            <AlertCircle size={15} /> Failed to load cycles.
          </div>
        ) : !cycles?.length ? (
          <div className="p-12 text-center">
            <Calendar size={36} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-600">No cycles yet</p>
            <p className="text-xs text-gray-400 mt-1">Create your first OKR cycle to get started.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Name', 'Type', 'Start', 'End', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(cycles as Cycle[]).map(cycle => {
                const nextStatus = STATUS_TRANSITIONS[cycle.status]
                const nextLabel = STATUS_NEXT_LABEL[cycle.status]
                const isPending = statusMutation.isPending && statusMutation.variables?.id === cycle.id
                const errMsg = statusErrors[cycle.id]

                return (
                  <tr key={cycle.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{cycle.name}</td>
                    <td className="px-4 py-3 text-gray-500 capitalize">{cycle.type}</td>
                    <td className="px-4 py-3 text-gray-500 tabular-nums whitespace-nowrap">
                      {formatDate(cycle.startDate)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 tabular-nums whitespace-nowrap">
                      {formatDate(cycle.endDate)}
                    </td>
                    <td className="px-4 py-3">
                      <CycleStatusBadge status={cycle.status} />
                      {errMsg && (
                        <p className="text-xs text-red-500 mt-1">{errMsg}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {nextStatus && (
                        <button
                          onClick={() => statusMutation.mutate({ id: cycle.id, status: nextStatus })}
                          disabled={isPending}
                          className={cn(
                            'inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors',
                            isPending
                              ? 'text-gray-400 border-gray-200 cursor-not-allowed'
                              : 'text-blue-700 border-blue-200 bg-blue-50 hover:bg-blue-100',
                          )}
                        >
                          {isPending ? (
                            <span className="inline-block w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                          ) : (
                            <ChevronRight size={12} />
                          )}
                          {nextLabel}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
