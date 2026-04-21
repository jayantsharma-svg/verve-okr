import { z } from 'zod'

// ─── Shared primitives ────────────────────────────────────────────────────────

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(50),
})

export const UuidSchema = z.string().uuid()

// ─── Cycle ────────────────────────────────────────────────────────────────────

export const CreateCycleSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['annual', 'monthly', 'custom']),
  startDate: z.string().date(),
  endDate: z.string().date(),
  departmentOverride: z.string().nullable().optional(),
  teamOverride: z.string().nullable().optional(),
})

export const UpdateCycleStatusSchema = z.object({
  status: z.enum(['planning', 'active', 'review', 'closed']),
})

// ─── Objective ────────────────────────────────────────────────────────────────

export const CreateObjectiveSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).nullable().optional(),
  level: z.enum(['company', 'department', 'team', 'individual']),
  department: z.string().nullable().optional(),
  team: z.string().nullable().optional(),
  parentObjectiveId: z.string().uuid().nullable().optional(),
  cycleId: z.string().uuid(),
  visibility: z.enum(['public', 'private']).default('public'),
})

export const UpdateObjectiveSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).nullable().optional(),
  parentObjectiveId: z.string().uuid().nullable().optional(),
  visibility: z.enum(['public', 'private']).optional(),
  status: z.enum(['draft', 'pending_approval', 'active', 'closed', 'deleted']).optional(),
})

export const ApproveObjectiveSchema = z.object({
  action: z.enum(['approve', 'reject', 'send_back']),
  reason: z.string().max(1000).optional(),
})

export const ListObjectivesSchema = z.object({
  cycleId: z.string().uuid().optional(),
  level: z.enum(['company', 'department', 'team', 'individual']).optional(),
  department: z.string().optional(),
  team: z.string().optional(),
  ownerId: z.string().uuid().optional(),
  status: z.enum(['draft', 'pending_approval', 'active', 'closed']).optional(),
  visibility: z.enum(['public', 'private']).optional(),
  search: z.string().max(200).optional(),
  ...PaginationSchema.shape,
})

// ─── Key Result ───────────────────────────────────────────────────────────────

export const CreateKeyResultSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).nullable().optional(),
  metricType: z.enum(['percentage', 'number', 'currency', 'binary']),
  startValue: z.number(),
  targetValue: z.number(),
  unit: z.string().max(50).nullable().optional(),
  ownerId: z.string().uuid().optional(), // defaults to objective owner
})

export const UpdateKeyResultSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).nullable().optional(),
  targetValue: z.number().optional(),
  unit: z.string().max(50).nullable().optional(),
  status: z.enum(['draft', 'active', 'closed']).optional(),
})

// ─── Check-in ─────────────────────────────────────────────────────────────────

export const CreateCheckinSchema = z.object({
  newValue: z.number(),
  confidence: z.enum(['on_track', 'at_risk', 'off_track']),
  note: z.string().max(2000).nullable().optional(),
})

// ─── Collaborator ─────────────────────────────────────────────────────────────

export const InviteCollaboratorSchema = z.object({
  collaboratorUserId: z.string().uuid(),
})

export const RespondCollaboratorSchema = z.object({
  decision: z.enum(['accept', 'decline']),
})

// ─── Review cycle ─────────────────────────────────────────────────────────────

export const CreateReviewCycleSchema = z.object({
  cycleId: z.string().uuid(),
  name: z.string().min(1).max(200),
  reviewDate: z.string().date(),
  scope: z.enum(['company', 'department', 'team']),
  department: z.string().nullable().optional(),
  team: z.string().nullable().optional(),
})

export const SubmitReviewSchema = z.object({
  note: z.string().max(2000).optional(),
})

export const ReviewDecisionSchema = z.object({
  action: z.enum(['approve', 'request_revision']),
  note: z.string().max(2000).optional(),
})

// ─── Appraisal ────────────────────────────────────────────────────────────────

export const CreateAppraisalCycleSchema = z.object({
  name: z.string().min(1).max(200),
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
})

export const SelfAppraisalSchema = z.object({
  selfAppraisalText: z.string().min(1).max(5000),
  okrComments: z.array(
    z.object({
      objectiveId: z.string().uuid(),
      employeeComment: z.string().max(2000),
    }),
  ),
})

export const ManagerFinalizeSchema = z.object({
  rating: z.enum(['exceeds', 'meets', 'partially_meets', 'does_not_meet']),
  managerComments: z.string().min(1).max(5000),
  okrComments: z.array(
    z.object({
      objectiveId: z.string().uuid(),
      managerComment: z.string().max(2000),
    }),
  ),
})

export const RequestFeedbackSchema = z.object({
  feedbackProviderIds: z.array(z.string().uuid()).min(1).max(10),
})

export const SubmitFeedbackSchema = z.object({
  feedbackText: z.string().min(1).max(3000),
})

// ─── Email Intelligence ───────────────────────────────────────────────────────

export const UpdateScrapingConsentSchema = z.object({
  consentLevel: z.enum(['none', 'capture_all', 'capture_confirm']),
  schedule: z.enum(['manual', 'end_of_day', 'end_of_week', 'end_of_period']),
})

export const ExtractionDecisionSchema = z.object({
  decision: z.enum(['accept', 'reject']),
})

// ─── Bulk Import ──────────────────────────────────────────────────────────────

export const BulkCommitSchema = z.object({
  jobId: z.string().uuid(),
})

// ─── Notification preferences ─────────────────────────────────────────────────

export const UpdateNotificationPrefsSchema = z.object({
  channel: z.enum(['slack', 'gmail']),
  checkinReminders: z.boolean().optional(),
  reviewRequests: z.boolean().optional(),
  atRiskAlerts: z.boolean().optional(),
  appraisalUpdates: z.boolean().optional(),
  collaboratorRequests: z.boolean().optional(),
})

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const EmailPasswordLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(200),
})

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
})

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(128),
})

// ─── Meeting Digest ───────────────────────────────────────────────────────────

export const UpdateMeetingDigestSchema = z.object({
  enabled: z.boolean(),
  leadTimeMinutes: z.number().int().min(15).max(1440).default(60),
  calendarId: z.string().optional(),
})

// ─── Export / Download ────────────────────────────────────────────────────────

export const OkrExportSchema = z.object({
  cycleId: z.string().uuid().optional(),
  department: z.string().optional(),
  team: z.string().optional(),
  ownerId: z.string().uuid().optional(),
  format: z.enum(['xlsx', 'csv']).default('xlsx'),
})
