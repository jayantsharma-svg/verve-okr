'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { confidenceColor, confidenceLabel, progressPct, formatDate } from '@/lib/utils'
import type { Objective } from '@okr-tool/core'
import { AlertTriangle, CheckCircle2, TrendingUp, Clock, Target } from 'lucide-react'

export default function DashboardPage() {
  const { data: cycles } = useQuery({
    queryKey: ['cycles'],
    queryFn: () => api.cycles.list(),
  })

  const activeCycle = cycles?.find((c) => c.status === 'active')

  const { data: objectives, isLoading } = useQuery({
    queryKey: ['objectives', 'dashboard', activeCycle?.id],
    queryFn: () =>
      api.objectives.list(
        activeCycle ? { cycleId: activeCycle.id, status: 'active' } : undefined,
      ),
    enabled: !!activeCycle,
  })

  const stats = {
    total: objectives?.length ?? 0,
    onTrack:  objectives?.filter((o) => (o as any).worstConfidenceRank === 0).length ?? 0,
    atRisk:   objectives?.filter((o) => (o as any).worstConfidenceRank === 1).length ?? 0,
    offTrack: objectives?.filter((o) => (o as any).worstConfidenceRank === 2).length ?? 0,
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        {activeCycle && (
          <p className="text-sm text-gray-500 mt-1">
            {activeCycle.name} · {formatDate((activeCycle as any).startDate)} – {formatDate((activeCycle as any).endDate)}
          </p>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Total OKRs" value={stats.total} icon={<TrendingUp size={18} />} color="blue" />
        <StatCard label="On Track" value={stats.onTrack} icon={<CheckCircle2 size={18} />} color="green" />
        <StatCard label="At Risk" value={stats.atRisk} icon={<Clock size={18} />} color="amber" />
        <StatCard label="Off Track" value={stats.offTrack} icon={<AlertTriangle size={18} />} color="red" />
      </div>

      {/* OKR list */}
      <section>
        <h2 className="text-lg font-medium text-gray-900 mb-4">My OKRs</h2>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : objectives?.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {objectives?.map((obj) => (
              <ObjectiveCard key={obj.id} objective={obj} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function StatCard({
  label, value, icon, color,
}: {
  label: string; value: number; icon: React.ReactNode; color: 'blue' | 'green' | 'amber' | 'red'
}) {
  const colors = {
    blue:  'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red:   'bg-red-50 text-red-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className={`inline-flex p-2 rounded-lg mb-3 ${colors[color]}`}>{icon}</div>
      <div className="text-2xl font-semibold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500 mt-0.5">{label}</div>
    </div>
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

  return (
    <a
      href={`/objectives/${objective.id}`}
      className="block bg-white rounded-xl border border-gray-100 p-5 hover:border-blue-200 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{objective.title}</h3>
          <p className="text-xs text-gray-400 mt-0.5 capitalize">
            {objective.level} · {krCount} key result{krCount !== 1 ? 's' : ''}
          </p>
        </div>
        <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${confidenceColor(worstConfidence)}`}>
          {confidenceLabel(worstConfidence)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span>Progress</span>
          <span>{avgProgress}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${avgProgress}%` }}
          />
        </div>
      </div>

      {/* SMART score badge */}
      {o.smartOverallScore != null && (
        <div className="mt-3 inline-flex items-center gap-1 text-xs text-gray-400">
          <span>SMART+</span>
          <span className={`font-medium ${o.smartOverallScore >= 8 ? 'text-green-600' : o.smartOverallScore >= 5 ? 'text-amber-600' : 'text-red-600'}`}>
            {o.smartOverallScore}/10
          </span>
        </div>
      )}
    </a>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
      <Target className="mx-auto text-gray-300 mb-3" size={40} />
      <h3 className="font-medium text-gray-700">No OKRs yet</h3>
      <p className="text-sm text-gray-400 mt-1">Create your first objective to get started.</p>
      <a
        href="/objectives/new"
        className="mt-4 inline-block bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
      >
        Create OKR
      </a>
    </div>
  )
}

