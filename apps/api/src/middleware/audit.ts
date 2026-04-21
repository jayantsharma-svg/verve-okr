import type { Request, Response, NextFunction } from 'express'
import { query } from '../db/client.js'

type AuditAction =
  | 'create' | 'update' | 'delete' | 'approve' | 'reject'
  | 'checkin' | 'login' | 'logout'

type Client = 'web' | 'mobile' | 'slack' | 'system'

export async function writeAudit(opts: {
  actorId: string | null
  action: AuditAction
  entityType: string
  entityId?: string
  oldJson?: Record<string, unknown>
  newJson?: Record<string, unknown>
  client?: Client
}) {
  try {
    await query(
      `INSERT INTO audit_log (actor_id, action, entity_type, entity_id, old_json, new_json, client)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        opts.actorId,
        opts.action,
        opts.entityType,
        opts.entityId ?? null,
        opts.oldJson ? JSON.stringify(opts.oldJson) : null,
        opts.newJson ? JSON.stringify(opts.newJson) : null,
        opts.client ?? 'web',
      ],
    )
  } catch (err) {
    // Audit failures must never break the main request
    console.error('Audit write failed:', err)
  }
}

// Detect client from User-Agent or custom header
export function detectClient(req: Request): Client {
  const ua = req.headers['user-agent'] ?? ''
  const clientHeader = req.headers['x-client'] as string | undefined
  if (clientHeader === 'slack') return 'slack'
  if (clientHeader === 'mobile') return 'mobile'
  if (ua.includes('okr-mobile')) return 'mobile'
  return 'web'
}

export function auditMiddleware(_req: Request, _res: Response, next: NextFunction) {
  next()
}
