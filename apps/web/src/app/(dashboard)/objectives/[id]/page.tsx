'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  confidenceColor, confidenceLabel, progressPct,
  formatDate, smartScoreColor, cn,
} from '@/lib/utils'
import { useState } from 'react'
import {
  ChevronRight, Users, Zap, Link2, Clock,
  TrendingUp, TrendingDown, Minus, ArrowUpRight,
} from 'lucide-react'
import type { KeyResult } from '@okr-tool/core'

export default function ObjectiveDetailPage({ params }: { params: { id: string } }) {
  const qc = useQueryClient()
  const [checkinKr, setCheckinKr] = useState<KeyResult | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'checkins' | 'alignment'>('overview')

  const { data: objective, isLoading } = useQuery({
    queryKey: ['objective', params.id],
    queryFn: () => api.objectives.get(params.id),
  })

  if (isLoading) return <PageSkeleton />
  if (!objective) return <div className="p-8 text-gray-500">Objective not found.</div>

  const krs = objective.keyResults ?? []
  const score = objective.smartScore
  const collaborators = objective.collaborators ?? []

  // Overall progress = average across all KRs
  const overallProgress = krs.length
    ? Math.round(krs.reduce((s, kr) => s + progressPct(kr.currentValue, kr.startValue, kr.targetValue), 0) / krs.length)
    : 0

  const worstConfidence: 'on_track' | 'at_risk' | 'off_track' = krs.reduce((w, kr) => {
    if (kr.confidence === 'off_track') return 'off_track'
    if (kr.confidence === 'at_risk' && w === 'on_track') return 'at_risk'
    return w
  }, 'on_track' as 'on_track' | 'at_risk' | 'off_track')

  return (
    <div className="p-8 max-w-4xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <a href="/objectives" className="hover:text-gray-600 transition-colors">OKRs</a>
        <ChevronRight size={14} />
        <span className="text-gray-700 truncate max-w-sm">{objective.title}</span>
      </nav>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            {/* Level + status badges */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                {objective.level} Objective
              </span>
              <span className={cn(
                'text-xs px-2.5 py-0.5 rounded-full font-medium',
                objective.status === 'active' ? 'bg-green-50 text-green-700'
                : objective.status === 'pending_approval' ? 'bg-amber-50 text-amber-700'
                : 'bg-gray-100 text-gray-500',
              )}>
                {(objective.status as string).replace(/_/g, ' ')}
              </span>
              {objective.visibility === 'private' && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-600 font-medium">Private</span>
              )}
            </div>

            <h1 className="text-2xl font-semibold text-gray-900 leading-tight mb-2">
              {objective.title}
            </h1>
            {objective.description && (
              <p className="text-sm text-gray-500 leading-relaxed">{objective.description}</p>
            )}
          </div>

          {/* SMART+ score ring */}
          {score && (
            <div className="shrink-0 flex flex-col items-center bg-gray-50 rounded-2xl p-4 min-w-[90px] border border-gray-100">
              <span className="text-xs text-gray-400 font-medium mb-1">SMART+</span>
              <span className={cn('text-3xl font-bold', smartScoreColor(score.overallScore))}>
                {score.overallScore}
              </span>
              <span className="text-xs text-gray-400">/10</span>
            </div>
          )}
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-4 text-sm text-gray-500 border-t border-gray-50 pt-4">
          <span>Owner: <span className="text-gray-800 font-medium">{(objective as any).ownerName}</span></span>
          {objective.department && <span>Dept: <span className="text-gray-700">{objective.department}</span></span>}
          {objective.team && <span>Team: <span className="text-gray-700">{objective.team}</span></span>}
          {(objective as any).parentTitle && (
            <span className="flex items-center gap-1">
              <Link2 size={13} />
              <span className="text-gray-700">{(objective as any).parentTitle}</span>
            </span>
          )}
          <span>Created: <span className="text-gray-700">{formatDate(objective.createdAt)}</span></span>
        </div>

        {/* Overall progress bar */}
        <div className="mt-5">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs font-medium text-gray-500">Overall Progress</span>
            <div className="flex items-center gap-2">
              <span className={cn('text-xs font-medium px-2.5 py-0.5 rounded-full', confidenceColor(worstConfidence))}>
                {confidenceLabel(worstConfidence)}
              </span>
              <span className="text-sm font-semibold text-gray-800">{overallProgress}%</span>
            </div>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', {
                'bg-green-400': worstConfidence === 'on_track',
                'bg-amber-400': worstConfidence === 'at_risk',
                'bg-red-400':   worstConfidence === 'off_track',
              })}
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit">
        {(['overview', 'checkins', 'alignment'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors',
              activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Overview tab ──────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Key Results */}
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
              Key Results ({krs.length})
            </h2>
            <div className="space-y-3">
              {krs.map((kr) => (
                <KeyResultCard key={kr.id} kr={kr} onCheckin={() => setCheckinKr(kr)} />
              ))}
              {krs.length === 0 && (
                <div className="text-sm text-gray-400 bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center">
                  No key results yet.
                </div>
              )}
            </div>
          </section>

          {/* Collaborators */}
          {collaborators.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Users size={13} /> Collaborators
              </h2>
              <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap gap-2">
                {collaborators.map((c) => (
                  <span key={c.id} className={cn(
                    'inline-flex items-center gap-1.5 text-sm rounded-full px-3 py-1 border',
                    c.status === 'accepted' ? 'bg-green-50 border-green-200 text-green-800'
                    : c.status === 'pending' ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-gray-50 border-gray-200 text-gray-500',
                  )}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                    {(c as any).name}
                    <span className="text-xs opacity-60 capitalize">· {c.status}</span>
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* SMART+ breakdown */}
          {score && (
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Zap size={13} /> SMART+ Analysis
              </h2>
              <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
                {(
                  [
                    ['Specific',    'specificScore'],
                    ['Measurable',  'measurableScore'],
                    ['Achievable',  'achievableScore'],
                    ['Relevant',    'relevantScore'],
                    ['Time-bound',  'timeBoundScore'],
                  ] as const
                ).map(([label, key]) => {
                  const val = (score as any)[key] as number
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">{label}</span>
                        <span className={cn('font-semibold', smartScoreColor(val))}>{val}/10</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', {
                            'bg-green-400': val >= 8,
                            'bg-amber-400': val >= 5 && val < 8,
                            'bg-red-400':   val < 5,
                          })}
                          style={{ width: `${val * 10}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {score.feedback[key.replace('Score', '') as keyof typeof score.feedback]}
                      </p>
                    </div>
                  )
                })}
                <div className="pt-3 border-t border-gray-100 text-sm text-gray-600 italic leading-relaxed">
                  {score.feedback.summary}
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── Check-ins tab ─────────────────────────────────────────────────── */}
      {activeTab === 'checkins' && (
        <CheckinsTab krs={krs} onCheckin={setCheckinKr} />
      )}

      {/* ── Alignment tab ─────────────────────────────────────────────────── */}
      {activeTab === 'alignment' && (
        <AlignmentTab objectiveId={params.id} objective={objective as any} />
      )}

      {/* Check-in modal */}
      {checkinKr && (
        <CheckinModal
          kr={checkinKr}
          onClose={() => setCheckinKr(null)}
          onSuccess={() => {
            setCheckinKr(null)
            qc.invalidateQueries({ queryKey: ['objective', params.id] })
            qc.invalidateQueries({ queryKey: ['checkins', params.id] })
          }}
        />
      )}
    </div>
  )
}

// ─── Key Result Card ──────────────────────────────────────────────────────────

function KeyResultCard({ kr, onCheckin }: { kr: KeyResult; onCheckin: () => void }) {
  const pct = progressPct(kr.currentValue, kr.startValue, kr.targetValue)
  const delta = kr.currentValue - kr.startValue
  const TrendIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 hover:border-gray-200 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-800">{kr.title}</p>
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
            <span className="capitalize">{kr.metricType.replace('_', ' ')}</span>
            <span>·</span>
            <span className="font-medium text-gray-600">
              {kr.currentValue.toLocaleString()}
              {kr.unit ? ` ${kr.unit}` : ''}
            </span>
            <span className="text-gray-300">/</span>
            <span>{kr.targetValue.toLocaleString()}{kr.unit ? ` ${kr.unit}` : ''}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', confidenceColor(kr.confidence))}>
            {confidenceLabel(kr.confidence)}
          </span>
          <button
            onClick={onCheckin}
            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Check in
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-gray-400 mb-1.5">
          <div className="flex items-center gap-1">
            <TrendIcon size={11} className={delta > 0 ? 'text-green-500' : delta < 0 ? 'text-red-400' : 'text-gray-400'} />
            <span>{pct}% complete</span>
          </div>
          {kr.lastCheckinAt && (
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {formatDate(kr.lastCheckinAt)}
            </span>
          )}
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', {
              'bg-green-400': kr.confidence === 'on_track',
              'bg-amber-400': kr.confidence === 'at_risk',
              'bg-red-400':   kr.confidence === 'off_track',
            })}
            style={{ width: `${pct}%` }}
          />
        </div>
        {/* Start / Target markers */}
        <div className="flex justify-between text-xs text-gray-300 mt-1">
          <span>{kr.startValue.toLocaleString()}</span>
          <span>{kr.targetValue.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Check-ins Tab ────────────────────────────────────────────────────────────

function CheckinsTab({
  krs, onCheckin,
}: {
  krs: KeyResult[]
  onCheckin: (kr: KeyResult) => void
}) {
  const [selectedKrId, setSelectedKrId] = useState<string>(krs[0]?.id ?? '')
  const selectedKr = krs.find((kr) => kr.id === selectedKrId)
  const checkins: any[] = (selectedKr as any)?.checkins ?? []

  if (krs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-xl border border-dashed border-gray-200">
        No key results to show check-ins for.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* KR selector */}
      <div className="flex gap-2 flex-wrap">
        {krs.map((kr) => (
          <button
            key={kr.id}
            onClick={() => setSelectedKrId(kr.id)}
            className={cn(
              'text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors truncate max-w-[200px]',
              selectedKrId === kr.id
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
            )}
          >
            {kr.title}
          </button>
        ))}
      </div>

      {/* Quick check-in button for selected KR */}
      {selectedKr && (
        <div className="flex justify-between items-center bg-blue-50 rounded-xl px-4 py-3 border border-blue-100">
          <div className="text-sm text-blue-700">
            Current: <span className="font-semibold">{selectedKr.currentValue.toLocaleString()}{selectedKr.unit ? ` ${selectedKr.unit}` : ''}</span>
            <span className="mx-1.5 text-blue-300">→</span>
            Target: <span className="font-semibold">{selectedKr.targetValue.toLocaleString()}{selectedKr.unit ? ` ${selectedKr.unit}` : ''}</span>
          </div>
          <button
            onClick={() => onCheckin(selectedKr)}
            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium flex items-center gap-1"
          >
            <ArrowUpRight size={13} /> Add check-in
          </button>
        </div>
      )}

      {/* Timeline */}
      {!checkins.length ? (
        <div className="text-center py-10 text-sm text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
          No check-ins yet for this key result.
        </div>
      ) : (
        <div className="relative pl-6 space-y-0">
          {/* Timeline line */}
          <div className="absolute left-2 top-3 bottom-3 w-px bg-gray-200" />
          {checkins.map((ci: any, i: number) => {
            const delta = ci.newValue - ci.previousValue
            const isUp = delta > 0
            return (
              <div key={ci.id} className="relative pb-4">
                {/* Dot */}
                <div className={cn(
                  'absolute -left-4 top-3 w-3 h-3 rounded-full border-2 border-white',
                  ci.confidence === 'on_track' ? 'bg-green-400'
                  : ci.confidence === 'at_risk' ? 'bg-amber-400'
                  : 'bg-red-400',
                )} />
                <div className="bg-white rounded-xl border border-gray-100 p-4 ml-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      {/* Value change */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-800">
                          {ci.previousValue.toLocaleString()} → {ci.newValue.toLocaleString()}
                          {selectedKr?.unit ? ` ${selectedKr.unit}` : ''}
                        </span>
                        <span className={cn(
                          'text-xs font-medium flex items-center gap-0.5',
                          isUp ? 'text-green-600' : 'text-red-500',
                        )}>
                          {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                          {isUp ? '+' : ''}{delta.toLocaleString()}
                        </span>
                      </div>
                      {ci.note && <p className="text-sm text-gray-600 leading-relaxed">{ci.note}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', confidenceColor(ci.confidence))}>
                        {confidenceLabel(ci.confidence)}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">{formatDate(ci.createdAt)}</p>
                    </div>
                  </div>
                  {ci.authorName && (
                    <p className="text-xs text-gray-400 mt-2">by {ci.authorName}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Alignment Tab ────────────────────────────────────────────────────────────

function AlignmentTab({ objectiveId, objective }: { objectiveId: string; objective: any }) {
  const { data: tree, isLoading } = useQuery({
    queryKey: ['tree', objectiveId],
    queryFn: () => api.objectives.getTree(objectiveId),
  })

  const LEVEL_ORDER = ['company', 'department', 'team', 'individual']

  const grouped = (Array.isArray(tree) ? tree as any[] : []).reduce((acc: Record<string, any[]>, node: any) => {
    ;(acc[node.level] ??= []).push(node)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {/* Parent objective */}
      {objective.parentObjectiveId && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Supports</h2>
          <a
            href={`/objectives/${objective.parentObjectiveId}`}
            className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-4 hover:border-blue-200 transition-colors group"
          >
            <Link2 size={16} className="text-gray-300 group-hover:text-blue-400 shrink-0" />
            <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600">
              {(objective as any).parentTitle ?? 'Parent Objective'}
            </span>
            <ArrowUpRight size={14} className="ml-auto text-gray-300 group-hover:text-blue-400" />
          </a>
        </div>
      )}

      {/* Tree view */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Alignment Tree</h2>
          <div className="space-y-1">
            {LEVEL_ORDER.filter(l => grouped[l]?.length).map((level) => (
              <div key={level}>
                <p className="text-xs text-gray-400 uppercase tracking-wide px-1 mb-1 mt-3 first:mt-0">{level}</p>
                {grouped[level].map((node: any) => (
                  <a
                    key={node.id}
                    href={`/objectives/${node.id}`}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl border text-sm transition-colors mb-1',
                      node.id === objectiveId
                        ? 'bg-blue-50 border-blue-200 font-semibold text-blue-800'
                        : 'bg-white border-gray-100 text-gray-700 hover:border-gray-200',
                    )}
                  >
                    <span className={cn(
                      'w-2 h-2 rounded-full shrink-0',
                      node.status === 'active' ? 'bg-green-400' : 'bg-gray-300',
                    )} />
                    <span className="flex-1 truncate">{node.title}</span>
                    <span className="text-xs text-gray-400 shrink-0">{node.ownerName}</span>
                    {node.id !== objectiveId && <ArrowUpRight size={13} className="text-gray-300 shrink-0" />}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Check-in Modal ───────────────────────────────────────────────────────────

function CheckinModal({ kr, onClose, onSuccess }: { kr: KeyResult; onClose: () => void; onSuccess: () => void }) {
  const [newValue, setNewValue] = useState(kr.currentValue)
  const [confidence, setConfidence] = useState(kr.confidence)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const pctPreview = progressPct(newValue, kr.startValue, kr.targetValue)

  const mutation = useMutation({
    mutationFn: () => api.keyResults.checkin(kr.id, { newValue, confidence, note: note || undefined }),
    onSuccess,
    onError: (err: any) => setError(err.message),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Check-in</h2>
          <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{kr.title}</p>
        </div>

        <div className="px-6 py-5 space-y-5">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>
          )}

          {/* Value input */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">
              New value {kr.unit ? <span className="text-gray-400 font-normal">({kr.unit})</span> : ''}
            </label>
            <input
              type="number"
              value={newValue}
              onChange={(e) => setNewValue(parseFloat(e.target.value) || 0)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {/* Live progress preview */}
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Progress preview</span>
                <span className="font-medium text-gray-600">{pctPreview}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-400 rounded-full transition-all duration-200"
                  style={{ width: `${pctPreview}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-300 mt-0.5">
                <span>{kr.startValue.toLocaleString()}</span>
                <span>Target: {kr.targetValue.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Confidence */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Confidence</label>
            <div className="grid grid-cols-3 gap-2">
              {(['on_track', 'at_risk', 'off_track'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setConfidence(c)}
                  className={cn(
                    'py-2.5 text-xs font-semibold rounded-xl border transition-all',
                    confidence === c
                      ? confidenceColor(c) + ' border-transparent ring-2 ring-offset-1 ' + (c === 'on_track' ? 'ring-green-300' : c === 'at_risk' ? 'ring-amber-300' : 'ring-red-300')
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white',
                  )}
                >
                  {confidenceLabel(c)}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">
              Note <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What happened since the last update?"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-1 py-3 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
          >
            {mutation.isPending ? 'Saving…' : 'Submit Check-in'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="p-8 max-w-4xl animate-pulse space-y-4">
      <div className="h-4 bg-gray-100 rounded w-1/4" />
      <div className="h-48 bg-gray-100 rounded-2xl" />
      <div className="h-8 bg-gray-100 rounded-xl w-64" />
      <div className="h-32 bg-gray-100 rounded-xl" />
      <div className="h-32 bg-gray-100 rounded-xl" />
    </div>
  )
}
