'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, RefreshCw, CheckCircle2, AlertCircle, Users } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { User, UserRole } from '@okr-tool/core'

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'member',    label: 'Member' },
  { value: 'team_lead', label: 'Team Lead' },
  { value: 'dept_lead', label: 'Dept Lead' },
  { value: 'admin',     label: 'Admin' },
]

const ROLE_STYLES: Record<UserRole, string> = {
  admin:     'text-violet-700 bg-violet-50',
  hrbp:      'text-pink-700 bg-pink-50',
  dept_lead: 'text-blue-700 bg-blue-50',
  team_lead: 'text-teal-700 bg-teal-50',
  member:    'text-gray-600 bg-gray-100',
}

// ─── Row component ────────────────────────────────────────────────────────────

function UserRow({
  user,
  onRoleChange,
  isPending,
  error,
}: {
  user: User
  onRoleChange: (userId: string, role: UserRole) => void
  isPending: boolean
  error: string | null
}) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <p className="font-medium text-gray-900 text-sm">{user.name}</p>
        {error && (
          <p className="text-xs text-red-500 mt-0.5">{error}</p>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">{user.email}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{user.department ?? '—'}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{user.team ?? '—'}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full',
            ROLE_STYLES[user.role],
          )}>
            {user.role}
          </span>
          <select
            value={user.role}
            disabled={isPending}
            onChange={e => onRoleChange(user.id, e.target.value as UserRole)}
            className={cn(
              'text-xs border border-gray-200 rounded-md px-2 py-1 outline-none bg-white transition-colors',
              isPending
                ? 'text-gray-400 cursor-not-allowed'
                : 'focus:border-blue-400 hover:border-gray-300',
            )}
          >
            {ROLE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {isPending && (
            <span className="inline-block w-3.5 h-3.5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={cn(
          'inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full',
          user.isActive
            ? 'text-green-700 bg-green-50'
            : 'text-gray-500 bg-gray-100',
        )}>
          {user.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
    </tr>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [roleErrors, setRoleErrors] = useState<Record<string, string>>({})

  const { data: users, isLoading, isError } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.admin.users.list(),
  })

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.admin.users.updateRole(userId, role),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      setRoleErrors(prev => { const next = { ...prev }; delete next[vars.userId]; return next })
      showToast('success', 'Role updated successfully.')
    },
    onError: (err: any, vars) => {
      setRoleErrors(prev => ({
        ...prev,
        [vars.userId]: err?.message ?? 'Failed to update role',
      }))
    },
  })

  const syncMutation = useMutation({
    mutationFn: () => api.admin.syncOrg(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      showToast('success', 'Organisation sync triggered successfully.')
    },
    onError: (err: any) => {
      showToast('error', err?.message ?? 'Sync failed. Please try again.')
    },
  })

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message })
    setTimeout(() => setToast(null), 6000)
  }

  const filtered = (users as User[] | undefined)?.filter(u => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  }) ?? []

  const isRolePending = (userId: string) =>
    roleMutation.isPending && roleMutation.variables?.userId === userId

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage roles and sync users from your organisation directory
          </p>
        </div>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className={cn(
            'flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border transition-colors',
            syncMutation.isPending
              ? 'text-gray-400 border-gray-200 cursor-not-allowed'
              : 'text-gray-700 border-gray-200 bg-white hover:bg-gray-50',
          )}
        >
          <RefreshCw size={14} className={syncMutation.isPending ? 'animate-spin' : ''} />
          {syncMutation.isPending ? 'Syncing…' : 'Sync from Google'}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={cn(
          'flex items-center gap-2 px-4 py-3 rounded-xl border text-sm',
          toast.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700',
        )}>
          {toast.type === 'success'
            ? <CheckCircle2 size={15} />
            : <AlertCircle size={15} />}
          {toast.message}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Filter by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 transition-colors bg-white"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

        {isError ? (
          <div className="p-8 text-center text-sm text-red-500 flex items-center justify-center gap-2">
            <AlertCircle size={15} /> Failed to load users.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Name', 'Email', 'Department', 'Team', 'Role', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i}>
                    {[1, 2, 3, 4, 5, 6].map(j => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${50 + j * 8}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.map(user => (
                <UserRow
                  key={user.id}
                  user={user}
                  onRoleChange={(userId, role) => roleMutation.mutate({ userId, role })}
                  isPending={isRolePending(user.id)}
                  error={roleErrors[user.id] ?? null}
                />
              ))}
            </tbody>
          </table>
        )}

        {/* Empty state */}
        {!isLoading && !isError && filtered.length === 0 && (
          <div className="p-14 text-center">
            <Users size={36} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-600">
              {search ? 'No users match your search' : 'No users found'}
            </p>
            {search && (
              <p className="text-xs text-gray-400 mt-1">Try a different name or email.</p>
            )}
          </div>
        )}

        {/* Footer count */}
        {!isLoading && !isError && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-400">
              {filtered.length} user{filtered.length !== 1 ? 's' : ''}
              {search && ` matching "${search}"`}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
