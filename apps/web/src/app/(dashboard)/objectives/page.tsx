'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn, confidenceColor, confidenceLabel, progressPct, formatDate } from '@/lib/utils'
import {
  Search, Plus, Filter, ChevronRight, ChevronDown,
  Building2, Users, UserCircle, Target, Zap,
  TrendingUp,
} from 'lucide-react'
import type { Cycle } from '@okr-tool/core'

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = 'list' | 'tree'
type Level = 'company' | 'department' | 'team' | 'individual'

const LEVEL_ICONS: Record<Level, React.ReactNode> = {
  company:    <Building2 size={14} />,
  department: <Users size={14} />,
  team:       <UserCircle size={14} />,
  individual: <Target size={14} />,
}

const LEVEL_COLORS: Record<Level, string> = {
  company:    'text-violet-600 bg-violet-50',
  department: 'text-blue-600 bg-blue-50',
  team:       'text-teal-600 bg-teal-50',
  individual: 'text-gray-600 bg-gray-100',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ObjectivesPage() {
  const [view, setView] = useState<ViewMode>('list')
  const [search, setSearch] = useState('')
  const [filterLevel, setFilterLevel] = useState('')
  const [filterStatus, setFilterStatus] = useState('active')
  const [filterCycleId, setFilterCycleId] = useState('')

  const { data: cycles } = useQuery({ queryKey: ['cycles'], queryFn: () => api.cycles.list() })
  const activeCycle = cycles?.find(c => c.status === 'active')

  // Default to active cycle
  const effectiveCycleId = filterCycleId || activeCycle?.id || ''

  const params: Record<string, string> = {}
  if (effectiveCycleId) params.cycleId = effectiveCycleId
  if (filterLevel)      params.level  = filterLevel
  if (filterStatus)     params.status = filterStatus
  if (search)           params.search = search

  const { data: objectives, isLoading } = useQuery({
    queryKey: ['objectives', 'explorer', params],
    queryFn: () => api.objectives.list(Object.keys(params).length ? params : undefined),
    staleTime: 30_000,
  })

  const cycle = cycles?.find(c => c.id === effectiveCycleId)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">OKRs</h1>
          {cycle && (
            <p className="text-sm text-gray-500 mt-0.5">{cycle.name}</p>
          )}
        </div>
        <a
          href="/objectives/new"
          className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> New OKR
        </a>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search objectives…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 transition-colors"
          />
        </div>

        {/* Cycle selector */}
        <select
          value={filterCycleId || effectiveCycleId}
          onChange={e => setFilterCycleId(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none bg-white focus:border-blue-400 transition-colors"
        >
          {cycles?.map((c: Cycle) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Level */}
        <select
          value={filterLevel}
          onChange={e => setFilterLevel(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none bg-white focus:border-blue-400 transition-colors"
        >
          <option value="">All levels</option>
          <option value="company">Company</option>
          <option value="department">Department</option>
          <option value="team">Team</option>
          <option value="individual">Individual</option>
        </select>

        {/* Status */}
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none bg-white focus:border-blue-400 transition-colors"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="pending_approval">Pending Approval</option>
          <option value="draft">Draft</option>
          <option value="closed">Closed</option>
        </select>

        {/* View toggle */}
        <div className="ml-auto flex items-center bg-gray-100 rounded-lg p-1 gap-1">
          <button
            onClick={() => setView('list')}
            className={cn('text-xs px-3 py-1.5 rounded-md font-medium transition-colors',
              view === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            List
          </button>
          <button
            onClick={() => setView('tree')}
            className={cn('text-xs px-3 py-1.5 rounded-md font-medium transition-colors',
              view === 'tree' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            Tree
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !objectives?.length ? (
        <EmptyState hasFilters={!!(search || filterLevel)} />
      ) : view === 'list' ? (
        <ListView objectives={objectives as any[]} />
      ) : (
        <TreeView objectives={objectives as any[]} />
      )}
    </div>
  )
}

// ─── List View ────────────────────────────────────────────────────────────────

function ListView({ objectives }: { objectives: any[] }) {
  return (
    <div className="space-y-2">
      {objectives.map(obj => (
        <ObjRow key={obj.id} obj={obj} />
      ))}
      <p className="text-xs text-gray-400 pt-2 text-center">
        {objectives.length} objective{objectives.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

function ObjRow({ obj }: { obj: any }) {
  const level = obj.level as Level
  const pct = Math.round(obj.avgProgressPct ?? 0)
  const confidence: 'on_track' | 'at_risk' | 'off_track' =
    obj.worstConfidenceRank === 2 ? 'off_track'
    : obj.worstConfidenceRank === 1 ? 'at_risk'
    : 'on_track'
  const krCount = parseInt(obj.krCount ?? '0')

  return (
    <a
      href={`/objectives/${obj.id}`}
      className="block bg-white rounded-xl border border-gray-100 px-5 py-4 hover:border-blue-200 hover:shadow-sm transition-all group"
    >
      {/* Top row: level badge + title + status + chevron */}
      <div className="flex items-start gap-3">
        <span className={cn('shrink-0 p-1.5 rounded-md mt-0.5', LEVEL_COLORS[level])}>
          {LEVEL_ICONS[level]}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-medium text-gray-900 group-hover:text-blue-700 transition-colors leading-snug">
              {obj.title}
            </h3>
            {obj.status === 'pending_approval' && (
              <span className="shrink-0 text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full border border-amber-100">
                Pending
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {obj.ownerName}
            {obj.department && ` · ${obj.department}`}
            {obj.team && ` · ${obj.team}`}
            {' · '}{krCount} KR{krCount !== 1 ? 's' : ''}
          </p>
        </div>
        <ChevronRight size={15} className="shrink-0 text-gray-300 group-hover:text-blue-400 transition-colors mt-1" />
      </div>

      {/* Bottom row: progress + confidence + smart score */}
      <div className="flex items-center gap-3 mt-3 pl-8">
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', {
              'bg-green-400': confidence === 'on_track',
              'bg-amber-400': confidence === 'at_risk',
              'bg-red-400':   confidence === 'off_track',
            })}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 w-8 text-right shrink-0">{pct}%</span>
        <span className={cn('shrink-0 text-xs font-medium px-2.5 py-0.5 rounded-full', confidenceColor(confidence))}>
          {confidenceLabel(confidence)}
        </span>
        {obj.smartOverallScore != null && (
          <div className="shrink-0 flex items-center gap-1 text-xs text-gray-400">
            <Zap size={11} className="text-amber-400" />
            <span className="font-medium text-gray-600">{obj.smartOverallScore}</span>
          </div>
        )}
      </div>
    </a>
  )
}

// ─── Tree View ────────────────────────────────────────────────────────────────

function TreeView({ objectives }: { objectives: any[] }) {
  // Group by level, build hierarchy
  const byId = Object.fromEntries(objectives.map(o => [o.id, o]))
  const roots = objectives.filter(o => !o.parentObjectiveId || !byId[o.parentObjectiveId])
  const childrenOf = (id: string) => objectives.filter(o => o.parentObjectiveId === id)

  return (
    <div className="space-y-1">
      {roots.map(obj => (
        <TreeNode key={obj.id} obj={obj} childrenOf={childrenOf} depth={0} />
      ))}
    </div>
  )
}

function TreeNode({
  obj, childrenOf, depth,
}: {
  obj: any
  childrenOf: (id: string) => any[]
  depth: number
}) {
  const children = childrenOf(obj.id)
  const [expanded, setExpanded] = useState(depth < 2)
  const level = obj.level as Level
  const pct = Math.round(obj.avgProgressPct ?? 0)
  const confidence: 'on_track' | 'at_risk' | 'off_track' =
    obj.worstConfidenceRank === 2 ? 'off_track'
    : obj.worstConfidenceRank === 1 ? 'at_risk'
    : 'on_track'

  return (
    <div>
      <div
        className="flex items-center gap-2 group"
        style={{ paddingLeft: `${depth * 28}px` }}
      >
        {/* Expand/collapse toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          className={cn(
            'shrink-0 w-5 h-5 flex items-center justify-center rounded transition-colors',
            children.length ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100' : 'text-transparent',
          )}
        >
          {children.length > 0 && (expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />)}
        </button>

        {/* Row */}
        <a
          href={`/objectives/${obj.id}`}
          className="flex-1 flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3 hover:border-blue-200 hover:shadow-sm transition-all"
        >
          <span className={cn('shrink-0 p-1.5 rounded-md', LEVEL_COLORS[level])}>
            {LEVEL_ICONS[level]}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{obj.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">{obj.ownerName}</p>
          </div>

          {/* Mini progress */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full', {
                  'bg-green-400': confidence === 'on_track',
                  'bg-amber-400': confidence === 'at_risk',
                  'bg-red-400':   confidence === 'off_track',
                })}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
          </div>

          {children.length > 0 && (
            <span className="shrink-0 text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
              {children.length}
            </span>
          )}
        </a>
      </div>

      {/* Children */}
      {expanded && children.map(child => (
        <TreeNode key={child.id} obj={child} childrenOf={childrenOf} depth={depth + 1} />
      ))}
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
      <TrendingUp className="mx-auto text-gray-200 mb-3" size={44} />
      <h3 className="font-medium text-gray-700">
        {hasFilters ? 'No matching objectives' : 'No objectives yet'}
      </h3>
      <p className="text-sm text-gray-400 mt-1">
        {hasFilters ? 'Try adjusting your filters.' : 'Create your first OKR to get started.'}
      </p>
      {!hasFilters && (
        <a
          href="/objectives/new"
          className="mt-4 inline-flex items-center gap-2 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={15} /> Create OKR
        </a>
      )}
    </div>
  )
}
