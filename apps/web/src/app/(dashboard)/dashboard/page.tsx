'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { confidenceColor, confidenceLabel, progressPct, formatDate } from '@/lib/utils'
import type { Objective } from '@okr-tool/core'
import { AlertTriangle, CheckCircle2, TrendingUp, Clock, Target, Clock3 } from 'lucide-react'

type ConfidenceFilter = 'all' | 'on_track' | 'at_risk' | 'off_track'

export default function DashboardPage() {
  const router = useRouter()
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>('all')

  const { data: cycles, isLoading: cyclesLoading } = useQuery({
    queryKey: ['cycles'],
    queryFn: () => api.cycles.list(),
  })

  const activeCycle = cycles?.find((c) => c.status === 'active')

  const { data: objectives, isLoading: objectivesLoading } = useQuery({
    queryKey: ['objectives', 'dashboard', activeCycle?.id],
    queryFn: () =>
      api.objectives.list(
        activeCycle ? { cycleId: activeCycle.id, status: 'active' } : undefined,
      ),
    enabled: !!activeCycle,
  })

  const { data: pendingObjectives } = useQuery({
    queryKey: ['objectives', 'pending', activeCycle?.id],
    queryFn: () =>
      api.objectives.list(
        activeCycle ? { cycleId: activeCycle.id, status: 'pending_approval' } : undefined,
      ),
    enabled: !!activeCycle,
  })

  const isLoading = cyclesLoading || (!!activeCycle && objectivesLoading)

  const stats = {
    total:    objectives?.length ?? 0,
    onTrack:  objectives?.filter((o) => (o as any).worstConfidenceRank === 0).length ?? 0,
    atRisk:   objectives?.filter((o) => (o as any).worstConfidenceRank === 1).length ?? 0,
    offTrack: objectives?.filter((o) => (o as any).worstConfidenceRank === 2).length ?? 0,
  }

  const filteredObjectives = confidenceFilter === 'all'
    ? objectives
    : objectives?.filter((o) => {
        const rank = (o as any).worstConfidenceRank
        if (confidenceFilter === 'on_track')  return rank === 0
        if (confidenceFilter === 'at_risk')   return rank === 1
        if (confidenceFilter === 'off_track') return rank === 2
        return true
      })

  const handleCardClick = (filter: ConfidenceFilter) => {
    setConfidenceFilter(prev => prev === filter ? 'all' : filter)
  }

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-ink-900 tracking-tight">Dashboard</h1>
        {activeCycle ? (
          <p className="text-sm text-ink-500 mt-1 font-medium">
            {activeCycle.name} · {formatDate((activeCycle as any).startDate)} – {formatDate((activeCycle as any).endDate)}
          </p>
        ) : isLoading ? (
          <div className="h-4 w-48 bg-ink-100 rounded animate-pulse mt-1" />
        ) : null}
      </div>

      {/* Pending approval banner */}
      {(pendingObjectives?.length ?? 0) > 0 && (
        <div
          className="mb-6 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 cursor-pointer hover:bg-amber-100 transition-colors"
          onClick={() => router.push('/objectives?status=pending_approval')}
        >
          <div className="flex items-center gap-2.5">
            <Clock3 size={16} className="text-amber-600 shrink-0" />
            <p className="text-sm font-semibold text-amber-800">
              {pendingObjectives!.length} OKR{pendingObjectives!.length !== 1 ? 's' : ''} pending approval
            </p>
          </div>
          <span className="text-xs font-semibold text-amber-600 hover:underline">Review →</span>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {isLoading ? (
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-ink-100 p-5 shadow-cap-sm">
              <div className="w-8 h-8 bg-ink-100 rounded-lg animate-pulse mb-3" />
              <div className="h-7 w-12 bg-ink-100 rounded animate-pulse mb-1" />
              <div className="h-3 w-20 bg-ink-100 rounded animate-pulse" />
            </div>
          ))
        ) : (
          <>
            <StatCard label="Total OKRs"  value={stats.total}    icon={<TrendingUp size={16} />}    color="blue"  active={confidenceFilter === 'all'}     onClick={() => handleCardClick('all')} />
            <StatCard label="On Track"    value={stats.onTrack}  icon={<CheckCircle2 size={16} />}  color="green" active={confidenceFilter === 'on_track'}  onClick={() => handleCardClick('on_track')} />
            <StatCard label="At Risk"     value={stats.atRisk}   icon={<Clock size={16} />}          color="amber" active={confidenceFilter === 'at_risk'}   onClick={() => handleCardClick('at_risk')} />
            <StatCard label="Off Track"   value={stats.offTrack} icon={<AlertTriangle size={16} />}  color="red"   active={confidenceFilter === 'off_track'} onClick={() => handleCardClick('off_track')} />
          </>
        )}
      </div>

      {/* OKR list */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-ink-900 tracking-tight">
            My OKRs
            {confidenceFilter !== 'all' && (
              <span className="ml-2 text-xs font-semibold text-ink-400 normal-case tracking-normal">
                · filtered by {confidenceFilter.replace('_', ' ')}
                <button onClick={() => setConfidenceFilter('all')} className="ml-1 text-verve hover:underline">clear</button>
              </span>
            )}
          </h2>
        </div>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-ink-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredObjectives?.length === 0 ? (
          objectives?.length === 0 ? <EmptyState /> : (
            <div className="text-center py-10 text-sm text-ink-400">
              No OKRs match this filter.{' '}
              <button onClick={() => setConfidenceFilter('all')} className="text-verve hover:underline font-medium">Show all</button>
            </div>
          )
        ) : (
          <div className="space-y-3">
            {filteredObjectives?.map((obj) => (
              <ObjectiveCard key={obj.id} objective={obj} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function StatCard({
  label, value, icon, color, active, onClick,
}: {
  label: string; value: number; icon: React.ReactNode
  color: 'blue' | 'green' | 'amber' | 'red'
  active: boolean; onClick: () => void
}) {
  const colorMap = {
    blue:  { icon: 'bg-verve-l text-verve',           ring: 'ring-verve' },
    green: { icon: 'bg-cap-green-l text-cap-green',   ring: 'ring-cap-green' },
    amber: { icon: 'bg-cap-amber-l text-cap-amber',   ring: 'ring-cap-amber' },
    red:   { icon: 'bg-cap-red-l text-cap-red',       ring: 'ring-cap-red' },
  }
  const c = colorMap[color]
  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-xl border p-5 transition-all shadow-cap-sm hover:shadow-cap-md
        ${active ? `border-transparent ring-2 ${c.ring}` : 'border-ink-100 hover:border-ink-200'}`}
    >
      <div className={`inline-flex p-2 rounded-lg mb-3 ${c.icon}`}>{icon}</div>
      <div className="text-2xl font-extrabold text-ink-900 tracking-tight">{value}</div>
      <div className="text-xs font-semibold text-ink-500 mt-0.5 uppercase tracking-wide">{label}</div>
    </button>
  )
}

function ObjectiveCard({ objective }: { objective: Objective }) {
  const o = objective as any
  const avgProgress = Math.min(100, Math.max(0, Math.round(o.avgProgressPct ?? 0)))
  const krCount = parseInt(o.krCount ?? '0')
  const worstConfidence: 'on_track' | 'at_risk' | 'off_track' =
    o.worstConfidenceRank === 2 ? 'off_track'
    : o.worstConfidenceRank === 1 ? 'at_risk'
    : 'on_track'

  const progressColor =
    avgProgress >= 70 ? 'bg-cap-green'
    : avgProgress >= 40 ? 'bg-cap-amber'
    : 'bg-cap-red'

  return (
    <a
      href={`/objectives/${objective.id}`}
      className="block bg-white rounded-xl border border-ink-100 p-5 hover:border-verve hover:shadow-cap-md transition-all group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-ink-900 truncate group-hover:text-verve transition-colors">
            {objective.title}
          </h3>
          <p className="text-xs text-ink-400 mt-0.5 capitalize font-medium">
            {objective.level} · {krCount} key result{krCount !== 1 ? 's' : ''}
          </p>
        </div>
        <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${confidenceColor(worstConfidence)}`}>
          {confidenceLabel(worstConfidence)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-ink-500 mb-1.5 font-medium">
          <span>Progress</span>
          <span className="font-bold">{avgProgress}%</span>
        </div>
        <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${progressColor} rounded-full transition-all duration-500`}
            style={{ width: `${avgProgress}%` }}
          />
        </div>
      </div>

      {/* SMART score badge */}
      {o.smartOverallScore != null && (
        <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink-400 font-medium">
          <span>SMART+</span>
          <span className={`font-bold ${o.smartOverallScore >= 8 ? 'text-cap-green' : o.smartOverallScore >= 5 ? 'text-cap-amber' : 'text-cap-red'}`}>
            {o.smartOverallScore}/10
          </span>
        </div>
      )}
    </a>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-16 bg-white rounded-xl border border-ink-100">
      <Target className="mx-auto text-ink-300 mb-3" size={40} />
      <h3 className="font-bold text-ink-700">No OKRs yet</h3>
      <p className="text-sm text-ink-400 mt-1">Create your first objective to get started.</p>
      <a
        href="/objectives/new"
        className="mt-4 inline-block bg-verve text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-verve-d transition-colors shadow-cap-sm"
      >
        Create OKR
      </a>
    </div>
  )
}
