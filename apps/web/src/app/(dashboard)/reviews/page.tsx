'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  BarChart3,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  Plus,
  Send,
  ChevronDown,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type ReviewStatus = 'pending' | 'submitted' | 'approved' | 'revision_requested'

interface ReviewItem {
  id: string
  status: ReviewStatus
  note?: string | null
  submittedAt?: string | null
  reviewedAt?: string | null
  objectiveTitle?: string
  cycleName?: string
  reviewCycleName?: string
  reviewDate?: string | null
}

type TabId = 'my-reviews' | 'manage'

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<ReviewStatus, string> = {
  pending: 'bg-gray-100 text-gray-600',
  submitted: 'bg-blue-50 text-blue-700',
  approved: 'bg-green-50 text-green-700',
  revision_requested: 'bg-amber-50 text-amber-700',
}

const STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: 'Pending',
  submitted: 'Submitted',
  approved: 'Approved',
  revision_requested: 'Revision Requested',
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  return (
    <span className={cn('text-xs font-medium px-2.5 py-0.5 rounded-full', STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </span>
  )
}

// ─── Review Card ──────────────────────────────────────────────────────────────

function ReviewCard({ item }: { item: ReviewItem }) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [note, setNote] = useState('')

  const submitMut = useMutation({
    mutationFn: () => api.reviews.submit(item.id, note || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews'] })
      setExpanded(false)
      setNote('')
    },
  })

  const formattedDate = item.reviewDate
    ? new Date(item.reviewDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4">
        {/* Top: title + status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 leading-snug">
              {item.objectiveTitle ?? 'Untitled Objective'}
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              {item.reviewCycleName ?? item.cycleName ?? 'Review Cycle'}
              {formattedDate && ` · ${formattedDate}`}
            </p>
          </div>
          <StatusBadge status={item.status} />
        </div>

        {/* Status-specific content */}
        {item.status === 'submitted' && (
          <div className="mt-3 flex items-start gap-2 text-sm text-gray-600">
            <CheckCircle2 size={15} className="text-blue-500 shrink-0 mt-0.5" />
            <span>
              {item.note
                ? <span className="italic text-gray-500">&ldquo;{item.note}&rdquo;</span>
                : 'Review submitted.'}
            </span>
          </div>
        )}

        {item.status === 'approved' && (
          <div className="mt-3 flex items-center gap-2 text-sm text-green-700">
            <CheckCircle2 size={15} className="text-green-500 shrink-0" />
            <span className="font-medium">Approved</span>
            {item.note && (
              <span className="ml-1 text-gray-500 italic font-normal">&ldquo;{item.note}&rdquo;</span>
            )}
          </div>
        )}

        {item.status === 'revision_requested' && (
          <div className="mt-3 flex items-start gap-2 text-sm text-amber-700">
            <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-medium">Revision Requested</span>
              {item.note && (
                <p className="text-gray-500 italic mt-0.5">&ldquo;{item.note}&rdquo;</p>
              )}
            </div>
          </div>
        )}

        {/* Pending: submit button */}
        {item.status === 'pending' && !expanded && (
          <div className="mt-3">
            <button
              onClick={() => setExpanded(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              <Send size={13} /> Submit Review
            </button>
          </div>
        )}
      </div>

      {/* Inline submit form */}
      {item.status === 'pending' && expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
          <label className="block text-xs font-medium text-gray-600 mb-2">
            Note <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder="Add a note for this review…"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 transition-colors resize-none bg-white"
          />
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => submitMut.mutate()}
              disabled={submitMut.isPending}
              className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {submitMut.isPending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Send size={13} />
              )}
              Submit
            </button>
            <button
              onClick={() => { setExpanded(false); setNote('') }}
              disabled={submitMut.isPending}
              className="text-xs text-gray-500 hover:text-gray-700 px-3 py-2 transition-colors"
            >
              Cancel
            </button>
            {submitMut.isError && (
              <p className="text-xs text-red-500 ml-1">Failed to submit. Try again.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── My Reviews Tab ───────────────────────────────────────────────────────────

function MyReviewsTab() {
  const [statusFilter, setStatusFilter] = useState<string>('')

  const params: Record<string, string> = {}
  if (statusFilter) params.status = statusFilter

  const { data: reviews, isLoading } = useQuery({
    queryKey: ['reviews', params],
    queryFn: () => api.reviews.list(Object.keys(params).length ? params : undefined),
    staleTime: 30_000,
  })

  const filtered = reviews ?? []

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="appearance-none text-sm border border-gray-200 rounded-lg pl-3 pr-8 py-2 outline-none bg-white focus:border-blue-400 transition-colors text-gray-700"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        {filtered.length > 0 && (
          <span className="text-xs text-gray-400">{filtered.length} item{filtered.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <Clock className="mx-auto text-gray-200 mb-3" size={44} />
          <h3 className="font-medium text-gray-700">No review items</h3>
          <p className="text-sm text-gray-400 mt-1">
            {statusFilter ? 'Try a different status filter.' : 'You have no reviews assigned to you yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <ReviewCard key={item.id} item={item as ReviewItem} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Create Review Cycle Form ─────────────────────────────────────────────────

function CreateCyclePanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { data: cycles } = useQuery({ queryKey: ['cycles'], queryFn: () => api.cycles.list() })

  const [cycleId, setCycleId] = useState('')
  const [name, setName] = useState('')
  const [reviewDate, setReviewDate] = useState('')
  const [scope, setScope] = useState<'company' | 'department' | 'team'>('company')
  const [department, setDepartment] = useState('')
  const [team, setTeam] = useState('')

  const createCycleMut = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const token = localStorage.getItem('okr_access_token')
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/review-cycles`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        },
      )
      if (!res.ok) throw new Error('Failed to create review cycle')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews'] })
      onClose()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: Record<string, unknown> = { cycleId, name, reviewDate, scope }
    if (scope === 'department') payload.department = department
    if (scope === 'team') payload.team = team
    createCycleMut.mutate(payload)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Create Review Cycle</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* OKR Cycle selector */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">OKR Cycle</label>
          <select
            required
            value={cycleId}
            onChange={e => setCycleId(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none bg-white focus:border-blue-400 transition-colors"
          >
            <option value="">Select a cycle…</option>
            {cycles?.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Review Cycle Name</label>
          <input
            required
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Q2 2026 Mid-Cycle Review"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 transition-colors"
          />
        </div>

        {/* Review date */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Review Date</label>
          <input
            required
            type="date"
            value={reviewDate}
            onChange={e => setReviewDate(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 transition-colors"
          />
        </div>

        {/* Scope */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">Scope</label>
          <div className="flex items-center gap-4">
            {(['company', 'department', 'team'] as const).map(s => (
              <label key={s} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  value={s}
                  checked={scope === s}
                  onChange={() => setScope(s)}
                  className="accent-blue-600"
                />
                <span className="text-sm text-gray-700 capitalize">{s}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Department (conditional) */}
        {scope === 'department' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Department</label>
            <input
              required
              type="text"
              value={department}
              onChange={e => setDepartment(e.target.value)}
              placeholder="e.g. Engineering"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 transition-colors"
            />
          </div>
        )}

        {/* Team (conditional) */}
        {scope === 'team' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Team</label>
            <input
              required
              type="text"
              value={team}
              onChange={e => setTeam(e.target.value)}
              placeholder="e.g. Platform"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 transition-colors"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={createCycleMut.isPending}
            className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {createCycleMut.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            Create Cycle
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={createCycleMut.isPending}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2.5 transition-colors"
          >
            Cancel
          </button>
          {createCycleMut.isError && (
            <p className="text-xs text-red-500">Failed to create. Please try again.</p>
          )}
        </div>
      </form>
    </div>
  )
}

// ─── Manage Tab ───────────────────────────────────────────────────────────────

function ManageTab() {
  const qc = useQueryClient()
  const [showCreateForm, setShowCreateForm] = useState(false)

  const { data: allReviews, isLoading } = useQuery({
    queryKey: ['reviews', 'all'],
    queryFn: () => api.reviews.list(),
    staleTime: 30_000,
  })

  const decideMut = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: string; note?: string }) =>
      api.reviews.decide(id, action, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reviews'] }),
  })

  return (
    <div>
      {/* Create button / form */}
      {!showCreateForm ? (
        <div className="mb-6">
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={15} /> Create Review Cycle
          </button>
        </div>
      ) : (
        <CreateCyclePanel onClose={() => setShowCreateForm(false)} />
      )}

      {/* All review items table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">All Review Items</h3>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !allReviews?.length ? (
          <div className="text-center py-12">
            <BarChart3 className="mx-auto text-gray-200 mb-2" size={36} />
            <p className="text-sm text-gray-400">No review items yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {allReviews.map(item => {
              const ri = item as ReviewItem
              return (
                <div key={ri.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {ri.objectiveTitle ?? 'Untitled Objective'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {ri.reviewCycleName ?? ri.cycleName ?? '—'}
                    </p>
                  </div>

                  <StatusBadge status={ri.status} />

                  {/* Admin actions for submitted items */}
                  {ri.status === 'submitted' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => decideMut.mutate({ id: ri.id, action: 'approve' })}
                        disabled={decideMut.isPending && decideMut.variables?.id === ri.id}
                        className="text-xs font-medium px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-60 transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => decideMut.mutate({ id: ri.id, action: 'request_revision' })}
                        disabled={decideMut.isPending && decideMut.variables?.id === ri.id}
                        className="text-xs font-medium px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 disabled:opacity-60 transition-colors"
                      >
                        Request Revision
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReviewsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('my-reviews')

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.auth.me(),
  })
  const isAdmin = (me as any)?.role === 'admin'

  const tabs: { id: TabId; label: string }[] = [
    { id: 'my-reviews', label: 'My Reviews' },
    ...(isAdmin ? [{ id: 'manage' as TabId, label: 'Manage' }] : []),
  ]

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-2xl font-semibold text-gray-900">Reviews</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track and submit OKR reviews.</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-gray-200 mb-6 gap-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'my-reviews' && <MyReviewsTab />}
      {activeTab === 'manage' && isAdmin && <ManageTab />}
    </div>
  )
}
