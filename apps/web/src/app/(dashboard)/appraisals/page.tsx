'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  ClipboardList, Users, BarChart3, CheckCircle2, Clock,
  Star, Loader2, Download,
  MessageSquare, Plus, Send, Info,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const CYCLE_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  self_appraisal: 'Self-Appraisal Open',
  feedback_collection: 'Feedback Collection',
  manager_review: 'Manager Review',
  closed: 'Closed',
}

const CYCLE_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  self_appraisal: 'bg-blue-100 text-blue-700',
  feedback_collection: 'bg-violet-100 text-violet-700',
  manager_review: 'bg-amber-100 text-amber-700',
  closed: 'bg-green-100 text-green-700',
}

const RATING_LABELS: Record<string, string> = {
  exceeds: 'Exceeds Expectations',
  meets: 'Meets Expectations',
  partially_meets: 'Partially Meets',
  does_not_meet: 'Does Not Meet',
}

const RATING_COLORS: Record<string, string> = {
  exceeds: 'bg-green-50 text-green-700 border-green-200',
  meets: 'bg-blue-50 text-blue-700 border-blue-200',
  partially_meets: 'bg-amber-50 text-amber-700 border-amber-200',
  does_not_meet: 'bg-red-50 text-red-700 border-red-200',
}

type TabId = 'my' | 'team' | 'reports'

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AppraisalsPage() {
  const [tab, setTab] = useState<TabId>('my')

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.auth.me(),
  })

  const { data: cycles } = useQuery({
    queryKey: ['appraisal-cycles'],
    queryFn: () => api.appraisals.cycles.list(),
  })

  const { data: myRecord, isLoading: myLoading } = useQuery({
    queryKey: ['appraisal-my'],
    queryFn: () => api.appraisals.myRecord(),
  })

  const user = me as any
  const isManager = user?.role === 'admin' || user?.role === 'dept_lead' || user?.role === 'team_lead'
  const isAdmin = user?.role === 'admin'
  const cycleStatus = (myRecord as any)?.cycleStatus

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'my', label: 'My Appraisal', icon: <ClipboardList size={15} /> },
    ...(isManager ? [{ id: 'team' as TabId, label: 'My Team', icon: <Users size={15} /> }] : []),
    ...(isAdmin ? [{ id: 'reports' as TabId, label: 'HRBP Reports', icon: <BarChart3 size={15} /> }] : []),
  ]

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Appraisals</h1>
          <p className="text-sm text-gray-500 mt-1">Performance review and appraisal management.</p>
        </div>
        {cycleStatus && (
          <span className={cn('text-xs font-semibold px-3 py-1.5 rounded-full', CYCLE_STATUS_COLORS[cycleStatus])}>
            {CYCLE_STATUS_LABELS[cycleStatus] ?? cycleStatus}
          </span>
        )}
      </div>

      {/* Admin: cycle controls */}
      {isAdmin && cycles && (
        <CycleAdminBar cycles={cycles as any[]} />
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100 mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'my' && (
        myLoading
          ? <LoadingSpinner />
          : <MyAppraisalTab record={myRecord as any} cycleStatus={cycleStatus} />
      )}
      {tab === 'team' && <TeamTab />}
      {tab === 'reports' && <ReportsTab />}
    </div>
  )
}

// ─── Admin Cycle Bar ──────────────────────────────────────────────────────────

function CycleAdminBar({ cycles }: { cycles: any[] }) {
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', periodStart: '', periodEnd: '' })

  const activeCycle = cycles.find(c => !['draft', 'closed'].includes(c.status))

  const createMut = useMutation({
    mutationFn: () => api.appraisals.cycles.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appraisal-cycles'] })
      qc.invalidateQueries({ queryKey: ['appraisal-my'] })
      setCreating(false)
      setForm({ name: '', periodStart: '', periodEnd: '' })
    },
  })

  const advanceMut = useMutation({
    mutationFn: (id: string) => api.appraisals.cycles.advance(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appraisal-cycles'] })
      qc.invalidateQueries({ queryKey: ['appraisal-my'] })
      qc.invalidateQueries({ queryKey: ['appraisal-team'] })
    },
  })

  const STATUS_FLOW: Record<string, string> = {
    draft: 'self_appraisal',
    self_appraisal: 'feedback_collection',
    feedback_collection: 'manager_review',
    manager_review: 'closed',
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-700">Cycle Management</p>
        <button
          onClick={() => setCreating(c => !c)}
          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          <Plus size={13} /> New cycle
        </button>
      </div>

      {creating && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3 space-y-3">
          <input
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
            placeholder="Cycle name (e.g. H1 2026 Appraisal)"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <div className="flex gap-3">
            <input
              type="date"
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
              value={form.periodStart}
              onChange={e => setForm(f => ({ ...f, periodStart: e.target.value }))}
            />
            <input
              type="date"
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
              value={form.periodEnd}
              onChange={e => setForm(f => ({ ...f, periodEnd: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => createMut.mutate()}
              disabled={!form.name || !form.periodStart || !form.periodEnd || createMut.isPending}
              className="text-xs font-medium bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {createMut.isPending ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => setCreating(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
        </div>
      )}

      {cycles.length === 0 && !creating && (
        <p className="text-sm text-gray-400">No cycles yet. Create one to get started.</p>
      )}

      <div className="space-y-2">
        {cycles.slice(0, 5).map(cycle => (
          <div key={cycle.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-gray-800">{cycle.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {cycle.periodStart ? new Date(cycle.periodStart).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''}
                {' – '}
                {cycle.periodEnd ? new Date(cycle.periodEnd).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', CYCLE_STATUS_COLORS[cycle.status])}>
                {CYCLE_STATUS_LABELS[cycle.status] ?? cycle.status}
              </span>
              {STATUS_FLOW[cycle.status] && (
                <button
                  onClick={() => advanceMut.mutate(cycle.id)}
                  disabled={advanceMut.isPending}
                  className="text-xs font-medium text-gray-500 hover:text-blue-600 border border-gray-200 px-2 py-0.5 rounded-md"
                >
                  Advance →
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── My Appraisal Tab ─────────────────────────────────────────────────────────

function MyAppraisalTab({ record, cycleStatus }: { record: any; cycleStatus: string }) {
  if (!cycleStatus || cycleStatus === 'draft') {
    return (
      <EmptyState
        icon={<Clock size={32} className="text-gray-300" />}
        title="No active appraisal cycle"
        desc="An admin will open the appraisal cycle when it's time."
      />
    )
  }

  return (
    <div className="space-y-5">
      {/* Status card */}
      <AppraisalStatusCard record={record} cycleStatus={cycleStatus} />

      {/* Self-appraisal */}
      {(cycleStatus === 'self_appraisal' || record?.selfSubmittedAt) && (
        <SelfAppraisalSection record={record} cycleStatus={cycleStatus} />
      )}

      {/* Feedback requests */}
      {(cycleStatus === 'feedback_collection' || cycleStatus === 'manager_review' || cycleStatus === 'closed') && (
        <FeedbackSection record={record} cycleStatus={cycleStatus} />
      )}

      {/* Manager rating — show after finalized */}
      {record?.managerRating && (
        <ManagerRatingCard record={record} />
      )}
    </div>
  )
}

function AppraisalStatusCard({ record, cycleStatus }: { record: any; cycleStatus: string }) {
  const steps = [
    { key: 'self_appraisal', label: 'Self-Appraisal', done: !!record?.selfSubmittedAt },
    { key: 'feedback_collection', label: 'Peer Feedback', done: false },
    { key: 'manager_review', label: 'Manager Review', done: !!record?.managerFinalizedAt },
    { key: 'closed', label: 'Complete', done: cycleStatus === 'closed' },
  ]

  const ORDER = ['self_appraisal', 'feedback_collection', 'manager_review', 'closed']
  const currentIdx = ORDER.indexOf(cycleStatus)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold text-gray-700">Appraisal Progress</h2>
        {record?.overallOkrAchievementPct != null && (
          <div className="text-right">
            <p className="text-xs text-gray-400">OKR Achievement</p>
            <p className="text-lg font-bold text-gray-900">{Math.round(record.overallOkrAchievementPct)}%</p>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        {steps.map((step, i) => {
          const stepIdx = ORDER.indexOf(step.key)
          const isCurrent = stepIdx === currentIdx
          const isPast = stepIdx < currentIdx || step.done

          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 shrink-0',
                  isPast ? 'bg-blue-600 border-blue-600 text-white'
                  : isCurrent ? 'bg-white border-blue-600 text-blue-600'
                  : 'bg-white border-gray-200 text-gray-400',
                )}>
                  {isPast ? <CheckCircle2 size={14} /> : i + 1}
                </div>
                <p className={cn('text-xs mt-1.5 text-center', isCurrent ? 'font-semibold text-blue-700' : isPast ? 'text-gray-500' : 'text-gray-300')}>
                  {step.label}
                </p>
              </div>
              {i < steps.length - 1 && (
                <div className={cn('h-0.5 flex-1 mb-4', isPast ? 'bg-blue-600' : 'bg-gray-100')} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SelfAppraisalSection({ record, cycleStatus }: { record: any; cycleStatus: string }) {
  const qc = useQueryClient()
  const [text, setText] = useState(record?.selfAppraisalText ?? '')
  const [submitted, setSubmitted] = useState(!!record?.selfSubmittedAt)
  const isOpen = cycleStatus === 'self_appraisal' && !submitted

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api.auth.me() })

  // Load objectives for OKR comments
  const { data: objectives } = useQuery({
    queryKey: ['objectives', 'mine', (me as any)?.id],
    queryFn: () => api.objectives.list({ ownerId: (me as any).id }),
    enabled: isOpen && !!(me as any)?.id,
  })

  const [okrComments, setOkrComments] = useState<Record<string, string>>(
    () => Object.fromEntries((record?.okrComments ?? []).map((c: any) => [c.objectiveId, c.employeeComment ?? '']))
  )

  const submitMut = useMutation({
    mutationFn: () => api.appraisals.submitSelf({
      selfAppraisalText: text,
      okrComments: Object.entries(okrComments).map(([objectiveId, employeeComment]) => ({ objectiveId, employeeComment })),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appraisal-my'] })
      setSubmitted(true)
    },
  })

  if (submitted || record?.selfSubmittedAt) {
    return (
      <Section title="Self-Appraisal" icon={<CheckCircle2 size={15} className="text-green-600" />}>
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 size={14} className="text-green-500" />
          <span className="text-sm text-green-700 font-medium">Submitted</span>
          {record?.selfSubmittedAt && (
            <span className="text-xs text-gray-400">
              {new Date(record.selfSubmittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
        </div>
        {record?.selfAppraisalText && (
          <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">
            {record.selfAppraisalText}
          </p>
        )}
      </Section>
    )
  }

  return (
    <Section title="Self-Appraisal" icon={<ClipboardList size={15} />}>
      {cycleStatus !== 'self_appraisal' ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Info size={14} /> Self-appraisal window is not open.
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-3">
            Reflect on your performance during this period. Be specific about achievements, challenges, and growth areas.
          </p>
          <textarea
            className="w-full h-36 text-sm border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-blue-400 resize-none"
            placeholder="Write your self-appraisal here…"
            value={text}
            onChange={e => setText(e.target.value)}
          />

          {/* OKR-by-OKR comments */}
          {objectives && (objectives as any[]).length > 0 && (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">Comments per Objective</p>
              {(objectives as any[]).filter((o: any) => o.status === 'active').map((obj: any) => (
                <div key={obj.id}>
                  <p className="text-xs font-medium text-gray-600 mb-1">{obj.title}</p>
                  <textarea
                    className="w-full h-16 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 resize-none"
                    placeholder="How did this objective go?"
                    value={okrComments[obj.id] ?? ''}
                    onChange={e => setOkrComments(p => ({ ...p, [obj.id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          )}

          {submitMut.error && (
            <p className="text-sm text-red-500 mt-2">{(submitMut.error as Error).message}</p>
          )}
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => submitMut.mutate()}
              disabled={!text.trim() || submitMut.isPending}
              className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitMut.isPending ? <><Loader2 size={14} className="animate-spin" /> Submitting…</> : <><Send size={14} /> Submit self-appraisal</>}
            </button>
          </div>
        </>
      )}
    </Section>
  )
}

function FeedbackSection({ record, cycleStatus }: { record: any; cycleStatus: string }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const { data: orgUsers } = useQuery({
    queryKey: ['org-users', search],
    queryFn: () => api.org.users(search ? { search } : undefined),
    enabled: cycleStatus === 'feedback_collection',
  })

  const requestMut = useMutation({
    mutationFn: () => api.appraisals.requestFeedback(record.id, selectedIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appraisal-my'] })
      setSelectedIds([])
    },
  })

  const feedbackRequests: any[] = record?.feedbackRequests ?? []

  return (
    <Section title="360° Feedback" icon={<MessageSquare size={15} />}>
      {feedbackRequests.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Requests Sent</p>
          {feedbackRequests.map((fr: any) => (
            <div key={fr.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-800">{fr.providerName}</p>
              </div>
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full font-medium',
                fr.status === 'submitted' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500',
              )}>
                {fr.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {cycleStatus === 'feedback_collection' && (
        <>
          <p className="text-sm text-gray-500 mb-3">Request feedback from peers or collaborators.</p>
          <input
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 mb-2"
            placeholder="Search colleagues…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {orgUsers && (
            <div className="max-h-40 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
              {(orgUsers as any[])
                .filter((u: any) => !feedbackRequests.some((r: any) => r.feedbackProviderId === u.id))
                .slice(0, 8)
                .map((u: any) => (
                  <label key={u.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded text-blue-600"
                      checked={selectedIds.includes(u.id)}
                      onChange={e => setSelectedIds(p => e.target.checked ? [...p, u.id] : p.filter(x => x !== u.id))}
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{u.name}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                  </label>
                ))}
            </div>
          )}
          {selectedIds.length > 0 && (
            <button
              onClick={() => requestMut.mutate()}
              disabled={requestMut.isPending}
              className="mt-3 flex items-center gap-2 text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {requestMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Request from {selectedIds.length} person{selectedIds.length !== 1 ? 's' : ''}
            </button>
          )}
        </>
      )}
    </Section>
  )
}

function ManagerRatingCard({ record }: { record: any }) {
  return (
    <Section title="Manager Rating" icon={<Star size={15} />}>
      <div className="flex items-start gap-4">
        <span className={cn('text-sm font-semibold px-3 py-1.5 rounded-lg border', RATING_COLORS[record.managerRating])}>
          {RATING_LABELS[record.managerRating] ?? record.managerRating}
        </span>
      </div>
      {record.managerComments && (
        <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 mt-3 whitespace-pre-wrap">
          {record.managerComments}
        </p>
      )}
      {record.managerFinalizedAt && (
        <p className="text-xs text-gray-400 mt-2">
          Finalized {new Date(record.managerFinalizedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      )}
    </Section>
  )
}

// ─── Team Tab ─────────────────────────────────────────────────────────────────

function TeamTab() {
  const { data: records, isLoading } = useQuery({
    queryKey: ['appraisal-team'],
    queryFn: () => api.appraisals.teamRecords(),
  })

  if (isLoading) return <LoadingSpinner />

  const list = (records as any[]) ?? []

  if (!list.length) {
    return (
      <EmptyState
        icon={<Users size={32} className="text-gray-300" />}
        title="No team records"
        desc="No appraisal records found for your direct reports in the active cycle."
      />
    )
  }

  return (
    <div className="space-y-3">
      {list.map((r: any) => (
        <TeamMemberCard key={r.id} record={r} cycleStatus={r.cycleStatus} />
      ))}
    </div>
  )
}

function TeamMemberCard({ record, cycleStatus }: { record: any; cycleStatus: string }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    rating: record.managerRating ?? '',
    managerComments: record.managerComments ?? '',
  })

  const finalizeMut = useMutation({
    mutationFn: () => api.appraisals.finalize(record.id, {
      rating: form.rating,
      managerComments: form.managerComments,
      okrComments: [],
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appraisal-team'] })
      setOpen(false)
    },
  })

  const isFinalized = !!record.managerFinalizedAt
  const canFinalize = cycleStatus === 'manager_review' && !isFinalized

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold shrink-0">
          {record.employeeName?.charAt(0) ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{record.employeeName}</p>
          <p className="text-xs text-gray-400">{record.employeeEmail}</p>
          {record.department && (
            <p className="text-xs text-gray-400">{record.department}{record.team ? ` · ${record.team}` : ''}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Self-appraisal status */}
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-1">Self-Appraisal</p>
            {record.selfSubmittedAt
              ? <CheckCircle2 size={16} className="text-green-500 mx-auto" />
              : <Clock size={16} className="text-gray-300 mx-auto" />}
          </div>
          {/* Manager rating */}
          {isFinalized && record.managerRating ? (
            <span className={cn('text-xs px-2 py-1 rounded-lg border font-medium', RATING_COLORS[record.managerRating])}>
              {RATING_LABELS[record.managerRating] ?? record.managerRating}
            </span>
          ) : canFinalize ? (
            <button
              onClick={() => setOpen(o => !o)}
              className="flex items-center gap-1.5 text-xs font-medium bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
            >
              <Star size={12} /> Finalize
            </button>
          ) : null}
        </div>
      </div>

      {/* Finalize panel */}
      {open && canFinalize && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-3">
          <p className="text-sm font-medium text-gray-700">Finalize appraisal for {record.employeeName}</p>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Rating</label>
            <select
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 bg-white"
              value={form.rating}
              onChange={e => setForm(f => ({ ...f, rating: e.target.value }))}
            >
              <option value="">Select rating…</option>
              <option value="exceeds">Exceeds Expectations</option>
              <option value="meets">Meets Expectations</option>
              <option value="partially_meets">Partially Meets</option>
              <option value="does_not_meet">Does Not Meet</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Manager Comments</label>
            <textarea
              className="w-full h-24 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 resize-none"
              placeholder="Provide constructive feedback…"
              value={form.managerComments}
              onChange={e => setForm(f => ({ ...f, managerComments: e.target.value }))}
            />
          </div>
          {finalizeMut.error && (
            <p className="text-sm text-red-500">{(finalizeMut.error as Error).message}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => finalizeMut.mutate()}
              disabled={!form.rating || finalizeMut.isPending}
              className="flex items-center gap-2 text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {finalizeMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              Submit
            </button>
            <button onClick={() => setOpen(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
        </div>
      )}

      {/* Self-appraisal preview (expandable) */}
      {record.selfAppraisalText && (
        <details className="border-t border-gray-50">
          <summary className="px-5 py-2.5 text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
            View self-appraisal
          </summary>
          <div className="px-5 pb-4">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{record.selfAppraisalText}</p>
          </div>
        </details>
      )}
    </div>
  )
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────

function ReportsTab() {
  const [department, setDepartment] = useState('')
  const [cycleId, setCycleId] = useState('')

  const { data: departments } = useQuery({
    queryKey: ['org-departments'],
    queryFn: () => api.org.departments(),
  })

  const { data: cycles } = useQuery({
    queryKey: ['appraisal-cycles'],
    queryFn: () => api.appraisals.cycles.list(),
  })

  const params: Record<string, string> = {}
  if (department) params.department = department
  if (cycleId) params.cycleId = cycleId

  const { data: records, isLoading } = useQuery({
    queryKey: ['appraisal-reports', department, cycleId],
    queryFn: () => api.appraisals.reports(params),
  })

  const downloadUrl = api.appraisals.downloadReport(params)

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <select
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 bg-white"
          value={cycleId}
          onChange={e => setCycleId(e.target.value)}
        >
          <option value="">All cycles</option>
          {(cycles as any[] ?? []).map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 bg-white"
          value={department}
          onChange={e => setDepartment(e.target.value)}
        >
          <option value="">All departments</option>
          {(departments as string[] ?? []).map((d: string) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <a
          href={downloadUrl}
          className="ml-auto flex items-center gap-2 text-sm font-medium text-blue-600 border border-blue-200 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
        >
          <Download size={14} /> Export .xlsx
        </a>
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Employee', 'Department', 'Team', 'Manager', 'Self-Appraisal', 'Rating', 'OKR Achievement'].map(col => (
                  <th key={col} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {((records as any[]) ?? []).map((r: any) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">{r.employeeName}</p>
                    <p className="text-xs text-gray-400">{r.employeeEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.department ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.team ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.managerName ?? '—'}</td>
                  <td className="px-4 py-3">
                    {r.selfSubmittedAt
                      ? <CheckCircle2 size={15} className="text-green-500" />
                      : <Clock size={15} className="text-gray-300" />}
                  </td>
                  <td className="px-4 py-3">
                    {r.managerRating ? (
                      <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', RATING_COLORS[r.managerRating])}>
                        {RATING_LABELS[r.managerRating]}
                      </span>
                    ) : <span className="text-xs text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {r.overallOkrAchievementPct != null ? `${Math.round(r.overallOkrAchievementPct)}%` : '—'}
                  </td>
                </tr>
              ))}
              {!records?.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-50">
        <span className="text-gray-400">{icon}</span>
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-3">{icon}</div>
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      <p className="text-xs text-gray-400 mt-1 max-w-xs">{desc}</p>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-20">
      <Loader2 className="animate-spin text-blue-500" size={28} />
    </div>
  )
}
