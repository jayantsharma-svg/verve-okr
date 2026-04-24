'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  TrendingUp, CheckCircle2, AlertTriangle, XCircle,
  Loader2, ChevronDown, ChevronUp, BarChart2,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Level = 'company' | 'department' | 'team' | 'individual'
type Confidence = 'on_track' | 'at_risk' | 'off_track'
type MetricType = 'percentage' | 'currency' | 'binary' | 'number'

interface KeyResult {
  id: string
  title: string
  currentValue: number
  targetValue: number
  startValue?: number
  unit?: string
  metricType: MetricType
  confidence: Confidence
}

interface Objective {
  id: string
  title: string
  level: Level
  keyResults: KeyResult[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LEVEL_BADGE: Record<Level, string> = {
  company:    'bg-violet-100 text-violet-700',
  department: 'bg-blue-100 text-blue-700',
  team:       'bg-teal-100 text-teal-700',
  individual: 'bg-gray-100 text-gray-600',
}

const LEVEL_LABEL: Record<Level, string> = {
  company:    'Company',
  department: 'Department',
  team:       'Team',
  individual: 'Individual',
}

const CONFIDENCE_BADGE: Record<Confidence, string> = {
  on_track: 'bg-green-50 text-green-700',
  at_risk:  'bg-amber-50 text-amber-700',
  off_track: 'bg-red-50 text-red-700',
}

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  on_track:  'On Track',
  at_risk:   'At Risk',
  off_track: 'Off Track',
}

const CONFIDENCE_ICON: Record<Confidence, React.ReactNode> = {
  on_track:  <CheckCircle2 size={12} />,
  at_risk:   <AlertTriangle size={12} />,
  off_track: <XCircle size={12} />,
}

const CONFIDENCE_BORDER: Record<Confidence, string> = {
  on_track:  'border-l-green-400',
  at_risk:   'border-l-amber-400',
  off_track: 'border-l-red-400',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function progressPct(kr: KeyResult): number {
  const range = kr.targetValue - (kr.startValue ?? 0)
  if (range === 0) return 0
  const pct = ((kr.currentValue - (kr.startValue ?? 0)) / range) * 100
  return Math.min(100, Math.max(0, Math.round(pct)))
}

function formatValue(kr: KeyResult): string {
  const { metricType, currentValue, targetValue, unit } = kr
  if (metricType === 'percentage') return `${currentValue}%`
  if (metricType === 'currency') return `$${currentValue}`
  if (metricType === 'binary') return currentValue >= targetValue ? 'Done' : 'Not Done'
  // number (default)
  const u = unit ? ` ${unit}` : ''
  return `${currentValue} / ${targetValue}${u}`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CheckinPage() {
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.auth.me(),
  })

  const userId = me?.id

  const { data: objectives, isLoading } = useQuery({
    queryKey: ['objectives', 'mine', userId],
    queryFn: () => api.objectives.list({ ownerId: userId! }),
    enabled: !!userId,
  })

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Check-in</h1>
        <p className="text-sm text-gray-500 mt-0.5">Update your key result progress.</p>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : !objectives?.length ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {(objectives as Objective[]).map(obj => (
            <ObjectiveCard key={obj.id} objective={obj} userId={userId!} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Objective Card ───────────────────────────────────────────────────────────

function ObjectiveCard({ objective, userId }: { objective: Objective; userId: string }) {
  const level = objective.level as Level

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      {/* Card header */}
      <div className="flex items-center gap-3 mb-4">
        <span
          className={cn(
            'text-xs font-medium px-2.5 py-1 rounded-full',
            LEVEL_BADGE[level] ?? 'bg-gray-100 text-gray-600',
          )}
        >
          {LEVEL_LABEL[level] ?? level}
        </span>
        <h2 className="text-sm font-semibold text-gray-900 flex-1 min-w-0 leading-snug">
          {objective.title}
        </h2>
      </div>

      {/* KR list */}
      {objective.keyResults?.length ? (
        <div className="space-y-2">
          {objective.keyResults.map(kr => (
            <KRRow key={kr.id} kr={kr} userId={userId} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 pl-1">No key results yet.</p>
      )}
    </div>
  )
}

// ─── KR Row ───────────────────────────────────────────────────────────────────

function KRRow({ kr, userId }: { kr: KeyResult; userId: string }) {
  const [open, setOpen] = useState(false)
  const confidence = (kr.confidence ?? 'on_track') as Confidence
  const pct = progressPct(kr)

  return (
    <div
      className={cn(
        'border-l-4 pl-3 rounded-r-lg bg-gray-50 transition-colors',
        CONFIDENCE_BORDER[confidence] ?? 'border-l-gray-200',
      )}
    >
      {/* KR summary row */}
      <div className="flex items-center gap-3 py-2.5">
        {/* Title */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 leading-snug truncate">{kr.title}</p>

          {/* Progress bar */}
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 w-8 text-right shrink-0">{pct}%</span>
          </div>
        </div>

        {/* Current value */}
        <span className="shrink-0 text-xs text-gray-600 font-medium whitespace-nowrap">
          {formatValue(kr)}
        </span>

        {/* Confidence badge */}
        <span
          className={cn(
            'shrink-0 flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
            CONFIDENCE_BADGE[confidence],
          )}
        >
          {CONFIDENCE_ICON[confidence]}
          {CONFIDENCE_LABEL[confidence]}
        </span>

        {/* Update button */}
        <button
          onClick={() => setOpen(v => !v)}
          className={cn(
            'shrink-0 flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors',
            open
              ? 'bg-gray-100 border-gray-200 text-gray-600'
              : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700',
          )}
        >
          {open ? (
            <>
              <ChevronUp size={12} /> Cancel
            </>
          ) : (
            <>
              <TrendingUp size={12} /> Update
            </>
          )}
        </button>
      </div>

      {/* Inline check-in form */}
      {open && (
        <CheckinForm
          kr={kr}
          userId={userId}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

// ─── Check-in Form ────────────────────────────────────────────────────────────

interface CheckinFormProps {
  kr: KeyResult
  userId: string
  onClose: () => void
}

function CheckinForm({ kr, userId, onClose }: CheckinFormProps) {
  const queryClient = useQueryClient()

  const [newValue, setNewValue] = useState<string>(String(kr.currentValue))
  const [confidence, setConfidence] = useState<Confidence>(
    (kr.confidence ?? 'on_track') as Confidence,
  )
  const [note, setNote] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      api.keyResults.checkin(kr.id, {
        newValue: Number(newValue),
        confidence,
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives', 'mine', userId] })
      onClose()
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="pb-3 pr-2 pt-1 flex flex-col gap-3"
    >
      <div className="flex flex-wrap gap-3">
        {/* New value */}
        <div className="flex flex-col gap-1 min-w-[120px]">
          <label className="text-xs font-medium text-gray-600">New value</label>
          <input
            type="number"
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
            required
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 transition-colors bg-white"
          />
        </div>

        {/* Confidence */}
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label className="text-xs font-medium text-gray-600">Confidence</label>
          <select
            value={confidence}
            onChange={e => setConfidence(e.target.value as Confidence)}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 transition-colors bg-white"
          >
            <option value="on_track">On Track</option>
            <option value="at_risk">At Risk</option>
            <option value="off_track">Off Track</option>
          </select>
        </div>
      </div>

      {/* Note */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">Note <span className="text-gray-400 font-normal">(optional)</span></label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          placeholder="What's driving this update?"
          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 transition-colors bg-white resize-none"
        />
      </div>

      {/* Error */}
      {mutation.isError && (
        <p className="text-xs text-red-600">
          Something went wrong. Please try again.
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-medium px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {mutation.isPending && <Loader2 size={12} className="animate-spin" />}
          Save check-in
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={mutation.isPending}
          className="text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
      <BarChart2 className="mx-auto text-gray-200 mb-3" size={44} />
      <h3 className="font-medium text-gray-700">No active objectives</h3>
      <p className="text-sm text-gray-400 mt-1">
        You have no active objectives to check in on.
      </p>
    </div>
  )
}
