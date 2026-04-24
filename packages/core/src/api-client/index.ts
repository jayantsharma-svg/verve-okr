import type {
  ApiSuccess,
  Objective,
  KeyResult,
  Checkin,
  Cycle,
  User,
  Collaborator,
  ReviewItem,
  AppraisalRecord,
  AppraisalCycle,
  BulkImportJob,
  EmailScrapeExtraction,
  EmailScrapingConsent,
  NotificationPreference,
  AuthSession,
  SmartScore,
  SheetsStatus,
} from '../types/index.js'

// ─── Client config ────────────────────────────────────────────────────────────

interface ClientConfig {
  baseUrl: string
  getToken: () => string | null
  onUnauthorized?: () => void
}

// ─── Base fetch wrapper ───────────────────────────────────────────────────────

async function apiFetch<T>(
  config: ClientConfig,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = config.getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${config.baseUrl}${path}`, { ...options, headers })

  if (res.status === 401) {
    config.onUnauthorized?.()
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: 'Request failed', code: 'UNKNOWN', details: undefined } })) as { error: { message?: string; code?: string; details?: Record<string, string[]> } }
    throw Object.assign(new Error(body.error?.message ?? 'Request failed'), {
      status: res.status,
      code: body.error?.code,
      details: body.error?.details,
    })
  }

  return res.json() as Promise<T>
}

// ─── API Client factory ───────────────────────────────────────────────────────

export function createApiClient(config: ClientConfig) {
  const get = <T>(path: string) =>
    apiFetch<ApiSuccess<T>>(config, path).then((r) => r.data)

  const post = <T>(path: string, body?: unknown) =>
    apiFetch<ApiSuccess<T>>(config, path, {
      method: 'POST',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }).then((r) => r.data)

  const patch = <T>(path: string, body: unknown) =>
    apiFetch<ApiSuccess<T>>(config, path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }).then((r) => r.data)

  const del = <T>(path: string) =>
    apiFetch<ApiSuccess<T>>(config, path, { method: 'DELETE' }).then((r) => r.data)

  return {
    // Auth
    auth: {
      loginWithGoogle: (code: string) =>
        post<AuthSession>('/auth/google', { code }),
      loginWithGoogleToken: (idToken: string) =>
        post<AuthSession>('/auth/google/token', { idToken }),
      loginWithPassword: (email: string, password: string) =>
        post<AuthSession>('/auth/login', { email, password }),
      register: (data: { email: string; password: string; name: string }) =>
        post<AuthSession>('/auth/register', data),
      refresh: () => post<AuthSession>('/auth/refresh'),
      me: () => get<User>('/auth/me'),
      forgotPassword: (email: string) =>
        post<void>('/auth/forgot-password', { email }),
      resetPassword: (token: string, newPassword: string) =>
        post<void>('/auth/reset-password', { token, newPassword }),
    },

    // Cycles
    cycles: {
      list: () => get<Cycle[]>('/cycles'),
      get: (id: string) => get<Cycle>(`/cycles/${id}`),
      create: (data: unknown) => post<Cycle>('/cycles', data),
      updateStatus: (id: string, status: string) =>
        patch<Cycle>(`/cycles/${id}`, { status }),
    },

    // Objectives
    objectives: {
      list: (params?: Record<string, string>) => {
        const qs = params ? '?' + new URLSearchParams(params).toString() : ''
        return get<Objective[]>(`/objectives${qs}`)
      },
      get: (id: string) => get<Objective>(`/objectives/${id}`),
      getTree: (id: string) => get<Objective>(`/objectives/${id}/tree`),
      create: (data: unknown) => post<Objective>('/objectives', data),
      update: (id: string, data: unknown) => patch<Objective>(`/objectives/${id}`, data),
      delete: (id: string) => del<void>(`/objectives/${id}`),
      approve: (id: string, data: unknown) =>
        post<Objective>(`/objectives/${id}/approval`, data),
      getSmartScore: (id: string) => get<SmartScore>(`/objectives/${id}/smart-score`),
      requestSmartScore: (id: string) =>
        post<SmartScore>(`/objectives/${id}/smart-score`),
    },

    // Key Results
    keyResults: {
      list: (objectiveId: string) =>
        get<KeyResult[]>(`/objectives/${objectiveId}/key-results`),
      create: (objectiveId: string, data: unknown) =>
        post<KeyResult>(`/objectives/${objectiveId}/key-results`, data),
      update: (id: string, data: unknown) =>
        patch<KeyResult>(`/key-results/${id}`, data),
      checkin: (id: string, data: unknown) =>
        post<Checkin>(`/key-results/${id}/checkins`, data),
      checkins: (id: string) => get<Checkin[]>(`/key-results/${id}/checkins`),
    },

    // Collaborators
    collaborators: {
      list: (objectiveId: string) =>
        get<Collaborator[]>(`/objectives/${objectiveId}/collaborators`),
      invite: (objectiveId: string, collaboratorUserId: string) =>
        post<Collaborator>(`/objectives/${objectiveId}/collaborators`, {
          collaboratorUserId,
        }),
      remove: (objectiveId: string, userId: string) =>
        del<void>(`/objectives/${objectiveId}/collaborators/${userId}`),
      myRequests: () => get<Collaborator[]>('/me/collaborator-requests'),
      respond: (id: string, decision: 'accept' | 'decline') =>
        post<Collaborator>(`/me/collaborator-requests/${id}/respond`, { decision }),
    },

    // Reviews
    reviews: {
      list: (params?: Record<string, string>) => {
        const qs = params ? '?' + new URLSearchParams(params).toString() : ''
        return get<ReviewItem[]>(`/reviews${qs}`)
      },
      submit: (id: string, note?: string) =>
        post<ReviewItem>(`/reviews/${id}/submit`, { note }),
      decide: (id: string, action: string, note?: string) =>
        post<ReviewItem>(`/reviews/${id}/decide`, { action, note }),
    },

    // Appraisals
    appraisals: {
      cycles: {
        list: () => get<AppraisalCycle[]>('/appraisal-cycles'),
        create: (data: unknown) => post<AppraisalCycle>('/appraisal-cycles', data),
        advance: (id: string) =>
          post<AppraisalCycle>(`/appraisal-cycles/${id}/advance`),
      },
      myRecord: () => get<AppraisalRecord>('/appraisals/me'),
      submitSelf: (data: unknown) => post<AppraisalRecord>('/appraisals/self', data),
      teamRecords: () => get<AppraisalRecord[]>('/appraisals/team'),
      finalize: (recordId: string, data: unknown) =>
        post<AppraisalRecord>(`/appraisals/${recordId}/finalize`, data),
      requestFeedback: (recordId: string, providerIds: string[]) =>
        post<void>(`/appraisals/${recordId}/feedback-requests`, {
          feedbackProviderIds: providerIds,
        }),
      submitFeedback: (requestId: string, text: string) =>
        post<void>(`/appraisal-feedback/${requestId}/submit`, { feedbackText: text }),
      reports: (params?: Record<string, string>) => {
        const qs = params ? '?' + new URLSearchParams(params).toString() : ''
        return get<AppraisalRecord[]>(`/hrbp/appraisal-reports${qs}`)
      },
      downloadReport: (params?: Record<string, string>) => {
        const qs = params ? '?' + new URLSearchParams(params).toString() : ''
        return `${config.baseUrl}/hrbp/appraisal-reports/download${qs}`
      },
    },

    // Email Intelligence
    emailIntelligence: {
      getConsent: () => get<EmailScrapingConsent>('/email-intelligence/consent'),
      updateConsent: (data: unknown) =>
        post<EmailScrapingConsent>('/email-intelligence/consent', data),
      triggerScrape: () => post<{ jobId: string }>('/email-intelligence/scrape'),
      pendingExtractions: () =>
        get<EmailScrapeExtraction[]>('/email-intelligence/extractions'),
      decide: (id: string, decision: 'accept' | 'reject') =>
        post<EmailScrapeExtraction>(`/email-intelligence/extractions/${id}/decide`, {
          decision,
        }),
    },

    // Bulk
    bulk: {
      uploadFile: async (file: File, jobType: 'create' | 'update') => {
        const token = config.getToken()
        const form = new FormData()
        form.append('file', file)
        form.append('jobType', jobType)
        const res = await fetch(`${config.baseUrl}/bulk/upload`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        })
        if (!res.ok) throw new Error('Upload failed')
        return res.json() as Promise<ApiSuccess<BulkImportJob>>
      },
      getJob: (id: string) => get<BulkImportJob>(`/bulk/jobs/${id}`),
      commit: (jobId: string) => post<BulkImportJob>('/bulk/commit', { jobId }),
      templateUrl: (type: 'create' | 'update') =>
        `${config.baseUrl}/bulk/templates/download?type=${type}`,
    },

    // Notification preferences
    notifications: {
      getPrefs: () => get<NotificationPreference>('/me/notification-prefs'),
      updatePrefs: (data: unknown) =>
        patch<NotificationPreference>('/me/notification-prefs', data),
    },

    // Meeting Digest
    meetingDigest: {
      getSettings: () => get<{
        enabled: boolean
        leadTimeMinutes: number
        calendarId: string | null
      }>('/meeting-digest/settings'),
      updateSettings: (data: {
        enabled: boolean
        leadTimeMinutes: number
        calendarId?: string | null
      }) => patch<{ enabled: boolean; leadTimeMinutes: number; calendarId: string | null }>(
        '/meeting-digest/settings', data,
      ),
      test: () => post<{ message: string }>('/meeting-digest/test'),
    },

    // Export / Download
    exports: {
      downloadUrl: (params: Record<string, string>) =>
        `${config.baseUrl}/export/okrs?` + new URLSearchParams(params).toString(),
      exportLink: (scope: string, cycleId?: string) =>
        post<{ url: string }>('/me/export-link', { scope, cycleId }),
    },

    // Admin
    admin: {
      users: {
        list: (params?: Record<string, string>) => {
          const qs = params ? '?' + new URLSearchParams(params).toString() : ''
          return get<User[]>(`/admin/users${qs}`)
        },
        updateRole: (userId: string, role: string) =>
          patch<User>(`/admin/users/${userId}/role`, { role }),
      },
      syncOrg: () => post<void>('/admin/sync-org'),
      sheets: {
        status: () => get<SheetsStatus>('/admin/sheets/status'),
        sync:   () => post<{ logId: string; message: string }>('/admin/sheets/sync'),
        import: () => post<{ logId: string; message: string }>('/admin/sheets/import'),
      },
    },

    // Org
    org: {
      departments: () => get<string[]>('/org/departments'),
      teams: () => get<string[]>('/org/teams'),
      users: (params?: Record<string, string>) => {
        const qs = params ? '?' + new URLSearchParams(params).toString() : ''
        return get<User[]>(`/org/users${qs}`)
      },
    },
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
