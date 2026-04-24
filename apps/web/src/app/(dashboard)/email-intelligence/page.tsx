'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Mail, Zap, CheckCircle2, XCircle, Loader2, RefreshCw, Settings } from 'lucide-react'

type ConsentLevel = 'none' | 'capture_all' | 'capture_confirm'
type Schedule = 'manual' | 'end_of_day' | 'end_of_week' | 'end_of_period'

interface ConsentRow {
  userId: string
  consentLevel: ConsentLevel
  schedule: Schedule
  enabledAt: string | null
  updatedAt: string
}

interface ProposedUpdate {
  objectiveId?: string
  keyResultId?: string
  newValue?: number
  confidence?: number
  note?: string
  reasoning?: string
  sourceSnippet?: string
}

interface Extraction {
  id: string
  jobId: string
  gmailMessageId: string
  extractedText: string
  proposedUpdate: ProposedUpdate
  userDecision: 'pending' | 'accepted' | 'rejected'
  decidedAt: string | null
  createdAt: string
  triggeredBy: string
  jobStatus: string
  runAt: string
  completedAt: string | null
}

const CONSENT_LEVELS: { value: ConsentLevel; label: string; description: string }[] = [
  { value: 'none', label: 'None', description: 'Disabled — no email scanning' },
  { value: 'capture_all', label: 'Capture All', description: 'Auto-apply extracted updates without confirmation' },
  { value: 'capture_confirm', label: 'Capture & Confirm', description: 'Extract and show for review before applying' },
]

const SCHEDULES: { value: Schedule; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'end_of_day', label: 'End of day' },
  { value: 'end_of_week', label: 'End of week' },
  { value: 'end_of_period', label: 'End of period' },
]

export default function EmailIntelligencePage() {
  const queryClient = useQueryClient()

  const { data: consentData, isLoading: consentLoading } = useQuery({
    queryKey: ['email-intelligence', 'consent'],
    queryFn: () => api.emailIntelligence.getConsent(),
  })

  const consent: ConsentRow | null = (consentData as any)?.data ?? null

  const [consentLevel, setConsentLevel] = useState<ConsentLevel>('none')
  const [schedule, setSchedule] = useState<Schedule>('manual')
  const [scanStatus, setScanStatus] = useState<'idle' | 'loading' | 'done'>('idle')

  // Sync local state with server data once loaded
  useEffect(() => {
    if (consent) {
      setConsentLevel(consent.consentLevel ?? 'none')
      setSchedule(consent.schedule ?? 'manual')
    }
  }, [consent])

  const saveConsentMutation = useMutation({
    mutationFn: () => api.emailIntelligence.updateConsent({ consentLevel, schedule }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-intelligence', 'consent'] })
    },
  })

  const handleRunScan = async () => {
    setScanStatus('loading')
    try {
      await api.emailIntelligence.triggerScrape()
      setScanStatus('done')
      setTimeout(() => setScanStatus('idle'), 3000)
    } catch {
      setScanStatus('idle')
    }
  }

  const { data: extractionsData, isLoading: extractionsLoading } = useQuery({
    queryKey: ['email-intelligence', 'extractions'],
    queryFn: () => api.emailIntelligence.pendingExtractions(),
    enabled: consentLevel === 'capture_confirm',
  })

  const extractions: Extraction[] = (extractionsData as any)?.data ?? []

  const decideMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'accept' | 'reject' }) =>
      api.emailIntelligence.decide(id, decision),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-intelligence', 'extractions'] })
    },
  })

  if (consentLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Mail className="w-7 h-7 text-blue-500" />
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Email Intelligence</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Automatically extract KR progress updates from Gmail
          </p>
        </div>
      </div>

      {/* Section 1: Settings Card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
          <Settings className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-800">Gmail Integration</h2>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Current consent status */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
              Current status
            </p>
            <p className="text-sm text-gray-700">
              {consent
                ? `${CONSENT_LEVELS.find(c => c.value === consent.consentLevel)?.label ?? consent.consentLevel}`
                : 'Not configured'}
            </p>
          </div>

          {/* Consent level toggle */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Consent level</p>
            <div className="space-y-2">
              {CONSENT_LEVELS.map(option => (
                <label
                  key={option.value}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    consentLevel === option.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
                  )}
                >
                  <input
                    type="radio"
                    name="consentLevel"
                    value={option.value}
                    checked={consentLevel === option.value}
                    onChange={() => setConsentLevel(option.value)}
                    className="mt-0.5 accent-blue-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{option.label}</p>
                    <p className="text-xs text-gray-500">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Schedule selector — only shown if consent level is not 'none' */}
          {consentLevel !== 'none' && (
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Scan schedule
              </label>
              <select
                value={schedule}
                onChange={e => setSchedule(e.target.value as Schedule)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SCHEDULES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => saveConsentMutation.mutate()}
              disabled={saveConsentMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saveConsentMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Save settings
            </button>

            <button
              onClick={handleRunScan}
              disabled={scanStatus === 'loading' || consentLevel === 'none'}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              {scanStatus === 'loading' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : scanStatus === 'done' ? (
                <Zap className="w-4 h-4 text-green-500" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {scanStatus === 'done' ? 'Scan started' : 'Run scan now'}
            </button>
          </div>

          {saveConsentMutation.isSuccess && (
            <p className="text-xs text-green-600">Settings saved successfully.</p>
          )}
        </div>
      </div>

      {/* Section 2: Pending Extractions — only shown in capture_confirm mode */}
      {consentLevel === 'capture_confirm' && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
            <Zap className="w-4 h-4 text-yellow-500" />
            <h2 className="font-semibold text-gray-800">Pending Updates</h2>
            {!extractionsLoading && (
              <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
                {extractions.length}
              </span>
            )}
          </div>

          <div className="divide-y divide-gray-100">
            {extractionsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : extractions.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-gray-400">
                No pending updates. Run a scan to extract KR progress from your emails.
              </div>
            ) : (
              extractions.map(extraction => {
                const update = extraction.proposedUpdate ?? {}
                const isDeciding = decideMutation.isPending && decideMutation.variables?.id === extraction.id
                return (
                  <div key={extraction.id} className="px-6 py-5 space-y-3">
                    {/* Source snippet */}
                    {update.sourceSnippet && (
                      <p className="text-xs italic text-gray-500 line-clamp-2">
                        &ldquo;{update.sourceSnippet}&rdquo;
                      </p>
                    )}

                    {/* Proposed update details */}
                    <div className="space-y-1">
                      {update.keyResultId && (
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">KR:</span>{' '}
                          <span className="font-mono text-xs text-gray-500">{update.keyResultId}</span>
                        </p>
                      )}
                      {update.objectiveId && !update.keyResultId && (
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Objective:</span>{' '}
                          <span className="font-mono text-xs text-gray-500">{update.objectiveId}</span>
                        </p>
                      )}
                      {update.newValue !== undefined && (
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">New value:</span>{' '}
                          <span className="text-blue-600 font-semibold">{update.newValue}</span>
                        </p>
                      )}
                      {update.confidence !== undefined && (
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Confidence:</span>{' '}
                          <span className={cn(
                            'font-medium',
                            update.confidence >= 0.8 ? 'text-green-600' :
                            update.confidence >= 0.5 ? 'text-yellow-600' : 'text-red-500',
                          )}>
                            {Math.round(update.confidence * 100)}%
                          </span>
                        </p>
                      )}
                      {update.reasoning && (
                        <p className="text-xs text-gray-500 mt-1">{update.reasoning}</p>
                      )}
                      {update.note && (
                        <p className="text-xs text-gray-500">{update.note}</p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => decideMutation.mutate({ id: extraction.id, decision: 'accept' })}
                        disabled={isDeciding}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {isDeciding ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        Apply
                      </button>
                      <button
                        onClick={() => decideMutation.mutate({ id: extraction.id, decision: 'reject' })}
                        disabled={isDeciding}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                      >
                        {isDeciding ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                        Dismiss
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
