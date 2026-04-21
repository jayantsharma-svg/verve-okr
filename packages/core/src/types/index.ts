// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'dept_lead' | 'team_lead' | 'member'

export type OkrLevel = 'company' | 'department' | 'team' | 'individual'

export type OkrStatus = 'draft' | 'pending_approval' | 'active' | 'closed' | 'deleted'

export type Visibility = 'public' | 'private'

export type MetricType = 'percentage' | 'number' | 'currency' | 'binary'

export type Confidence = 'on_track' | 'at_risk' | 'off_track'

export type CycleType = 'annual' | 'monthly' | 'custom'

export type CycleStatus = 'planning' | 'active' | 'review' | 'closed'

export type ReviewStatus = 'pending' | 'submitted' | 'approved' | 'revision_requested'

export type AppraisalCycleStatus =
  | 'draft'
  | 'self_appraisal'
  | 'feedback_collection'
  | 'manager_review'
  | 'finalized'

export type AppraisalRating =
  | 'exceeds'
  | 'meets'
  | 'partially_meets'
  | 'does_not_meet'

export type CollaboratorStatus = 'pending' | 'accepted' | 'declined'

export type NotificationChannel = 'slack' | 'gmail'

export type BulkJobType = 'create' | 'update'

export type BulkJobStatus = 'pending' | 'validating' | 'preview' | 'committed' | 'failed'

export type ScrapingConsentLevel = 'none' | 'capture_all' | 'capture_confirm'

export type ScrapingSchedule = 'manual' | 'end_of_day' | 'end_of_week' | 'end_of_period'

export type ScrapingJobStatus = 'pending' | 'running' | 'completed' | 'failed'

export type ExtractionDecision = 'pending' | 'accepted' | 'rejected'

export type AuthType = 'google_sso' | 'email_password'

// ─── Core Entities ────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  name: string
  department: string | null
  team: string | null
  managerId: string | null
  role: UserRole
  authType: AuthType
  isActive: boolean
  slackUserId: string | null
  createdAt: string
  updatedAt: string
}

export interface Cycle {
  id: string
  name: string
  type: CycleType
  startDate: string
  endDate: string
  status: CycleStatus
  departmentOverride: string | null
  teamOverride: string | null
  createdBy: string
  createdAt: string
}

export interface Objective {
  id: string
  title: string
  description: string | null
  level: OkrLevel
  ownerId: string
  department: string | null
  team: string | null
  parentObjectiveId: string | null
  cycleId: string
  status: OkrStatus
  visibility: Visibility
  rejectionReason: string | null
  createdBy: string
  approvedBy: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
  // populated relations
  owner?: Pick<User, 'id' | 'name' | 'email'>
  keyResults?: KeyResult[]
  smartScore?: SmartScore
  collaborators?: Collaborator[]
}

export interface KeyResult {
  id: string
  objectiveId: string
  title: string
  description: string | null
  ownerId: string
  metricType: MetricType
  startValue: number
  targetValue: number
  currentValue: number
  unit: string | null
  confidence: Confidence
  status: OkrStatus
  createdAt: string
  updatedAt: string
  lastCheckinAt: string | null
  // populated relations
  owner?: Pick<User, 'id' | 'name' | 'email'>
  checkins?: Checkin[]
}

export interface Checkin {
  id: string
  keyResultId: string
  authorId: string
  previousValue: number
  newValue: number
  confidence: Confidence
  note: string | null
  createdAt: string
  author?: Pick<User, 'id' | 'name' | 'email'>
}

export interface Alignment {
  id: string
  childObjectiveId: string
  parentObjectiveId: string
  createdAt: string
  createdBy: string
}

export interface Collaborator {
  id: string
  objectiveId: string
  invitedBy: string
  collaboratorUserId: string
  status: CollaboratorStatus
  invitedAt: string
  respondedAt: string | null
  user?: Pick<User, 'id' | 'name' | 'email'>
}

export interface ReviewCycle {
  id: string
  cycleId: string
  name: string
  reviewDate: string
  scope: 'company' | 'department' | 'team'
  department: string | null
  team: string | null
}

export interface ReviewItem {
  id: string
  reviewCycleId: string
  objectiveId: string
  reviewerId: string
  status: ReviewStatus
  note: string | null
  submittedAt: string | null
  reviewedAt: string | null
}

// ─── SMART+ Scoring ───────────────────────────────────────────────────────────

export interface SmartScore {
  id: string
  objectiveId: string
  scoredAt: string
  modelVersion: string
  specificScore: number
  measurableScore: number
  achievableScore: number
  relevantScore: number
  timeBoundScore: number
  overallScore: number
  feedback: SmartFeedback
}

export interface SmartFeedback {
  specific: string
  measurable: string
  achievable: string
  relevant: string
  timeBound: string
  summary: string
}

// ─── Appraisal ────────────────────────────────────────────────────────────────

export interface AppraisalCycle {
  id: string
  name: string
  periodStart: string
  periodEnd: string
  status: AppraisalCycleStatus
  createdBy: string
  createdAt: string
}

export interface AppraisalRecord {
  id: string
  cycleId: string
  employeeId: string
  managerId: string
  selfAppraisalText: string | null
  selfSubmittedAt: string | null
  managerRating: AppraisalRating | null
  managerComments: string | null
  managerFinalizedAt: string | null
  overallOkrAchievementPct: number | null
  employee?: Pick<User, 'id' | 'name' | 'email' | 'department' | 'team'>
}

export interface AppraisalOkrComment {
  id: string
  appraisalRecordId: string
  objectiveId: string
  employeeComment: string | null
  managerComment: string | null
}

export interface AppraisalFeedbackRequest {
  id: string
  appraisalRecordId: string
  requestedBy: string
  feedbackProviderId: string
  status: 'pending' | 'submitted' | 'declined'
  feedbackText: string | null
  submittedAt: string | null
}

// ─── Email Intelligence ───────────────────────────────────────────────────────

export interface EmailScrapingConsent {
  userId: string
  consentLevel: ScrapingConsentLevel
  schedule: ScrapingSchedule
  enabledAt: string | null
  updatedAt: string
}

export interface EmailScrapeJob {
  id: string
  userId: string
  triggeredBy: 'manual' | 'scheduled'
  status: ScrapingJobStatus
  runAt: string
  completedAt: string | null
  errorMessage: string | null
}

export interface EmailScrapeExtraction {
  id: string
  jobId: string
  gmailMessageId: string
  extractedText: string
  proposedUpdate: ProposedOkrUpdate
  userDecision: ExtractionDecision
  decidedAt: string | null
}

export interface ProposedOkrUpdate {
  objectiveId: string | null
  keyResultId: string | null
  newValue: number | null
  confidence: Confidence | null
  note: string
  reasoning: string
  sourceSnippet: string
}

// ─── Bulk Import ──────────────────────────────────────────────────────────────

export interface BulkImportJob {
  id: string
  userId: string
  jobType: BulkJobType
  fileName: string
  fileStoragePath: string
  status: BulkJobStatus
  rowResults: BulkRowResult[]
  totalRows: number
  successRows: number
  errorRows: number
  createdAt: string
  committedAt: string | null
}

export interface BulkRowResult {
  rowNumber: number
  status: 'success' | 'error' | 'warning'
  data: Record<string, unknown>
  errors: string[]
  warnings: string[]
  createdId?: string
}

// ─── Notification ─────────────────────────────────────────────────────────────

export interface NotificationPreference {
  userId: string
  channel: NotificationChannel
  checkinReminders: boolean
  reviewRequests: boolean
  atRiskAlerts: boolean
  appraisalUpdates: boolean
  collaboratorRequests: boolean
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string
  timestamp: string
  actorId: string
  action: string
  entityType: string
  entityId: string
  oldJson: Record<string, unknown> | null
  newJson: Record<string, unknown> | null
  client: 'web' | 'mobile' | 'slack' | 'system'
}

// ─── API Response shapes ──────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  data: T
  meta?: {
    total?: number
    page?: number
    perPage?: number
  }
}

export interface ApiError {
  error: {
    code: string
    message: string
    details?: Record<string, string[]>
  }
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthTokenPayload {
  sub: string       // user id
  email: string
  role: UserRole
  authType: AuthType
  iat: number
  exp: number
}

export interface AuthSession {
  user: User
  accessToken: string
}

// ─── Sheets Sync ──────────────────────────────────────────────────────────────

export interface SheetsSyncLogEntry {
  id: string
  direction: 'export' | 'import'
  status: 'running' | 'success' | 'failed'
  rowsAffected: number | null
  errorMessage: string | null
  triggeredByName: string | null
  triggeredByEmail: string | null
  startedAt: string
  completedAt: string | null
}

export interface SheetsStatus {
  configured: boolean
  spreadsheetId: string | null
  spreadsheetUrl: string | null
  lastExport: { startedAt: string; completedAt: string | null; rowsAffected: number | null; status: string } | null
  lastImport: { startedAt: string; completedAt: string | null; rowsAffected: number | null; status: string } | null
  logs: SheetsSyncLogEntry[]
}
