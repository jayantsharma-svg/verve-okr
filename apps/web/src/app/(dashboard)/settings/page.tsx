'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Bell, Slack, Mail, CheckCircle2, Loader2, User, Shield } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotifPrefs {
  channel: 'slack' | 'gmail'
  checkinReminders: boolean
  reviewRequests: boolean
  atRiskAlerts: boolean
  appraisalUpdates: boolean
  collaboratorRequests: boolean
}

const NOTIF_ITEMS: { key: keyof Omit<NotifPrefs, 'channel'>; label: string; desc: string }[] = [
  { key: 'checkinReminders',     label: 'Check-in reminders',    desc: 'Weekly nudge to update your KR values' },
  { key: 'reviewRequests',       label: 'Review requests',        desc: 'When a review cycle is opened or you are assigned a reviewer' },
  { key: 'atRiskAlerts',         label: 'At-risk alerts',         desc: 'When any of your KRs moves to At Risk or Off Track' },
  { key: 'appraisalUpdates',     label: 'Appraisal updates',      desc: 'Progress in your appraisal cycle (self-appraisal, feedback, rating)' },
  { key: 'collaboratorRequests', label: 'Collaborator requests',  desc: 'When you are invited to collaborate on an OKR' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const qc = useQueryClient()
  const [saved, setSaved] = useState(false)

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.auth.me(),
  })

  const { data: rawPrefs } = useQuery({
    queryKey: ['notification-prefs'],
    queryFn: () => api.notifications.getPrefs(),
  })

  const [prefs, setPrefs] = useState<NotifPrefs>({
    channel: 'slack',
    checkinReminders: true,
    reviewRequests: true,
    atRiskAlerts: true,
    appraisalUpdates: true,
    collaboratorRequests: true,
  })

  // Sync from API
  useEffect(() => {
    if (rawPrefs) {
      setPrefs({
        channel: (rawPrefs as any).channel ?? 'slack',
        checkinReminders:     (rawPrefs as any).checkinReminders     ?? true,
        reviewRequests:       (rawPrefs as any).reviewRequests       ?? true,
        atRiskAlerts:         (rawPrefs as any).atRiskAlerts         ?? true,
        appraisalUpdates:     (rawPrefs as any).appraisalUpdates     ?? true,
        collaboratorRequests: (rawPrefs as any).collaboratorRequests ?? true,
      })
    }
  }, [rawPrefs])

  const saveMutation = useMutation({
    mutationFn: () => api.notifications.updatePrefs(prefs),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-prefs'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  const toggle = (key: keyof Omit<NotifPrefs, 'channel'>) => {
    setPrefs(p => ({ ...p, [key]: !p[key] }))
  }

  const user = me as any

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your profile and notification preferences.</p>
      </div>

      {/* Profile section */}
      <Section icon={<User size={16} />} title="Profile">
        <div className="flex items-center gap-4 py-2">
          <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-lg shrink-0">
            {user?.name?.charAt(0) ?? '?'}
          </div>
          <div>
            <p className="font-medium text-gray-900">{user?.name ?? '—'}</p>
            <p className="text-sm text-gray-500">{user?.email ?? '—'}</p>
            {user?.department && (
              <p className="text-xs text-gray-400 mt-0.5">{user.department}{user.team ? ` · ${user.team}` : ''}</p>
            )}
          </div>
          <div className="ml-auto">
            <span className={cn(
              'text-xs px-2.5 py-1 rounded-full font-medium capitalize',
              user?.role === 'admin' ? 'bg-violet-50 text-violet-700'
              : user?.role === 'dept_lead' ? 'bg-blue-50 text-blue-700'
              : user?.role === 'team_lead' ? 'bg-teal-50 text-teal-700'
              : 'bg-gray-100 text-gray-600'
            )}>
              {user?.role?.replace('_', ' ') ?? 'member'}
            </span>
          </div>
        </div>
      </Section>

      {/* Notification channel */}
      <Section icon={<Bell size={16} />} title="Notification channel">
        <p className="text-sm text-gray-500 mb-3">Choose where you receive notifications.</p>
        <div className="flex gap-3">
          {(['slack', 'gmail'] as const).map(ch => (
            <button
              key={ch}
              onClick={() => setPrefs(p => ({ ...p, channel: ch }))}
              className={cn(
                'flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl border-2 text-sm font-medium transition-all',
                prefs.channel === ch
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300',
              )}
            >
              {ch === 'slack'
                ? <><Slack size={16} /> Slack</>
                : <><Mail size={16} /> Gmail</>
              }
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {prefs.channel === 'slack'
            ? 'Notifications will be sent as Slack DMs using your workspace email.'
            : 'Notifications will be sent to your Google Workspace Gmail inbox.'}
        </p>
      </Section>

      {/* Notification types */}
      <Section icon={<Bell size={16} />} title="Notification types">
        <p className="text-sm text-gray-500 mb-4">Choose which events trigger a notification.</p>
        <div className="space-y-1">
          {NOTIF_ITEMS.map(item => (
            <div
              key={item.key}
              className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-gray-800">{item.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
              </div>
              <Toggle
                checked={prefs[item.key] as boolean}
                onChange={() => toggle(item.key)}
              />
            </div>
          ))}
        </div>
      </Section>

      {/* Security */}
      <Section icon={<Shield size={16} />} title="Security">
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-gray-800">Authentication method</p>
            <p className="text-xs text-gray-400 mt-0.5 capitalize">
              {user?.authType?.replace('_', ' ') ?? '—'}
            </p>
          </div>
          <span className="text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
            Managed by org
          </span>
        </div>
      </Section>

      {/* Save button */}
      <div className="flex items-center gap-3 mt-2">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {saveMutation.isPending
            ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
            : 'Save preferences'
          }
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
            <CheckCircle2 size={15} /> Saved!
          </span>
        )}
        {saveMutation.error && (
          <span className="text-sm text-red-500">{(saveMutation.error as Error).message}</span>
        )}
      </div>
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ icon, title, children }: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 shadow-sm">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-50">
        <span className="text-gray-400">{icon}</span>
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      </div>
      {children}
    </div>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={cn(
        'relative w-10 h-5.5 rounded-full transition-colors shrink-0',
        checked ? 'bg-blue-600' : 'bg-gray-200',
      )}
      style={{ height: '22px', width: '40px' }}
    >
      <span
        className={cn(
          'absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )}
        style={{ width: '18px', height: '18px' }}
      />
    </button>
  )
}
