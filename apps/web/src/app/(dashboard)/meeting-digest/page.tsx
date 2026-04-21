'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Calendar, Bell, Zap, CheckCircle2, Loader2, Info,
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function getToken(): string {
  return typeof window !== 'undefined' ? (localStorage.getItem('okr_access_token') ?? '') : ''
}

interface DigestSettings {
  user_id: string
  enabled: boolean
  lead_time_minutes: number
  calendar_id: string | null
  updated_at: string
}

const LEAD_TIME_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hr',   value: 60 },
  { label: '2 hr',   value: 120 },
  { label: '4 hr',   value: 240 },
]

export default function MeetingDigestPage() {
  const queryClient = useQueryClient()

  // ── Remote settings ──────────────────────────────────────────────────────────
  const { data: settings, isLoading } = useQuery<DigestSettings | null>({
    queryKey: ['meeting-digest-settings'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/meeting-digest/settings`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      const json = await res.json()
      return json.data ?? null
    },
  })

  // ── Local form state (seeded from remote, with defaults) ─────────────────────
  const [enabled, setEnabled]         = useState(false)
  const [leadTime, setLeadTime]       = useState(60)
  const [calendarId, setCalendarId]   = useState('')
  const [saveFlash, setSaveFlash]     = useState(false)
  const [testStatus, setTestStatus]   = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [testMsg, setTestMsg]         = useState('')

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled)
      setLeadTime(settings.lead_time_minutes)
      setCalendarId(settings.calendar_id ?? '')
    }
  }, [settings])

  // ── Save mutation ────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/meeting-digest/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          enabled,
          leadTimeMinutes: leadTime,
          calendarId: calendarId.trim() || null,
        }),
      })
      if (!res.ok) throw new Error('Failed to save settings')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-digest-settings'] })
      setSaveFlash(true)
      setTimeout(() => setSaveFlash(false), 3000)
    },
  })

  // ── Test run ─────────────────────────────────────────────────────────────────
  async function handleTestRun() {
    setTestStatus('loading')
    setTestMsg('')
    try {
      const res = await fetch(`${API_URL}/meeting-digest/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Unknown error')
      setTestStatus('ok')
      setTestMsg(json.data?.message ?? 'Digest triggered successfully.')
    } catch (err: any) {
      setTestStatus('error')
      setTestMsg(err.message ?? 'Something went wrong.')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-gray-400" size={28} />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Calendar className="text-blue-600" size={24} />
          <h1 className="text-2xl font-bold text-gray-900">Meeting Digest</h1>
        </div>
        <p className="text-gray-500 text-sm">
          Get an OKR briefing before your calendar meetings.
        </p>
      </div>

      {/* How it works */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Info className="text-blue-500" size={18} />
          <h2 className="font-semibold text-gray-800">How it works</h2>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
          {[
            'Enable digest below.',
            'Connect Google Calendar in your account settings.',
            `Receive a Slack or email digest ${leadTime < 60 ? `${leadTime} minutes` : `${leadTime / 60} hour${leadTime / 60 > 1 ? 's' : ''}`} before each meeting showing attendees' OKR status.`,
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-sm text-blue-800">{step}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Digest Settings */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="text-gray-600" size={18} />
          <h2 className="font-semibold text-gray-800">Digest Settings</h2>
        </div>

        {/* Enable toggle */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="font-medium text-gray-900">Enable Meeting Digest</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Automatically send OKR summaries before your meetings.
            </p>
          </div>
          <button
            onClick={() => setEnabled((v) => !v)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              enabled ? 'bg-blue-600' : 'bg-gray-200'
            }`}
            aria-pressed={enabled}
            aria-label="Toggle meeting digest"
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Conditional settings */}
        {enabled && (
          <div className="space-y-5 border-t border-gray-100 pt-4">
            {/* Lead time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Send digest before meeting by
              </label>
              <div className="flex flex-wrap gap-2">
                {LEAD_TIME_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setLeadTime(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      leadTime === opt.value
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Calendar ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="calendar-id">
                Calendar ID <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                id="calendar-id"
                type="text"
                value={calendarId}
                onChange={(e) => setCalendarId(e.target.value)}
                placeholder="primary (default)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1">
                Leave blank to use your primary Google Calendar.
              </p>
            </div>
          </div>
        )}

        {/* Save button */}
        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {saveMutation.isPending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : null}
            Save Settings
          </button>
          {saveFlash && (
            <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
              <CheckCircle2 size={15} />
              Saved!
            </span>
          )}
          {saveMutation.isError && (
            <span className="text-sm text-red-500">Failed to save. Please try again.</span>
          )}
        </div>
      </div>

      {/* Test card — only when enabled */}
      {enabled && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="text-yellow-500" size={18} />
            <h2 className="font-semibold text-gray-800">Test Your Digest</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Trigger a digest run now to preview what will be sent before your next meeting.
          </p>
          <button
            onClick={handleTestRun}
            disabled={testStatus === 'loading'}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white text-sm font-medium rounded-lg hover:bg-yellow-600 disabled:opacity-60 transition-colors"
          >
            {testStatus === 'loading' ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Zap size={15} />
            )}
            Run Test Digest
          </button>
          {testStatus === 'ok' && (
            <div className="mt-3 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
              <CheckCircle2 size={15} />
              {testMsg}
            </div>
          )}
          {testStatus === 'error' && (
            <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {testMsg}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
