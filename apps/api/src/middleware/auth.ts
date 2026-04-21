import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import type { AuthTokenPayload, UserRole } from '@okr-tool/core'
import { AppError } from './error.js'

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload
    }
  }
}

const JWT_SECRET = process.env['JWT_SECRET']!

// ─── Verify JWT and attach user to request ────────────────────────────────────

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('UNAUTHORIZED', 'Authentication required', 401))
  }
  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthTokenPayload
    req.user = payload
    next()
  } catch {
    next(new AppError('UNAUTHORIZED', 'Invalid or expired token', 401))
  }
}

// ─── Role-based access guards ─────────────────────────────────────────────────

const ROLE_WEIGHT: Record<UserRole, number> = {
  admin: 4,
  dept_lead: 3,
  team_lead: 2,
  member: 1,
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('UNAUTHORIZED', 'Authentication required', 401))
    if (!roles.includes(req.user.role)) {
      return next(new AppError('FORBIDDEN', 'Insufficient permissions', 403))
    }
    next()
  }
}

export function requireMinRole(minRole: UserRole) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('UNAUTHORIZED', 'Authentication required', 401))
    if (ROLE_WEIGHT[req.user.role] < ROLE_WEIGHT[minRole]) {
      return next(new AppError('FORBIDDEN', 'Insufficient permissions', 403))
    }
    next()
  }
}

// ─── JWT helpers ──────────────────────────────────────────────────────────────

export function signAccessToken(payload: Omit<AuthTokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: process.env['JWT_EXPIRES_IN'] ?? '15m',
  })
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, type: 'refresh' }, JWT_SECRET, {
    expiresIn: process.env['REFRESH_TOKEN_EXPIRES_IN'] ?? '7d',
  })
}

export function verifyRefreshToken(token: string): { sub: string } {
  const payload = jwt.verify(token, JWT_SECRET) as { sub: string; type: string }
  if (payload.type !== 'refresh') throw new Error('Not a refresh token')
  return payload
}
