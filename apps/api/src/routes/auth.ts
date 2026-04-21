import { Router } from 'express'
import bcrypt from 'bcrypt'
import crypto from 'node:crypto'
import { OAuth2Client } from 'google-auth-library'
import {
  EmailPasswordLoginSchema,
  RegisterSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from '@okr-tool/core'
import { queryOne, query } from '../db/client.js'
import { sendPasswordResetEmail } from '../services/notifications.js'
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  requireAuth,
} from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { AppError } from '../middleware/error.js'
import { writeAudit } from '../middleware/audit.js'
import type { Request, Response } from 'express'

const router = Router()

const oauthClient = new OAuth2Client(
  process.env['GOOGLE_CLIENT_ID'],
  process.env['GOOGLE_CLIENT_SECRET'],
  process.env['GOOGLE_REDIRECT_URI'],
)

const WORKSPACE_DOMAIN = process.env['GOOGLE_WORKSPACE_DOMAIN']!

// ─── Google SSO ───────────────────────────────────────────────────────────────

// Step 1: redirect to Google consent screen
// Accepts an optional ?mobile_redirect=<deep-link-uri> from native apps.
// The value is round-tripped through Google's `state` param so the callback
// knows where to redirect after a successful sign-in.
router.get('/google', (req: Request, res: Response) => {
  const mobileRedirect = (req.query['mobile_redirect'] as string | undefined) || null

  const url = oauthClient.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    prompt: 'consent',
    hd: WORKSPACE_DOMAIN,   // restrict to company Workspace domain
    ...(mobileRedirect
      ? { state: Buffer.from(JSON.stringify({ mobileRedirect })).toString('base64') }
      : {}),
  })
  res.redirect(url)
})

// Mobile: accept an ID token directly (expo-auth-session flow)
router.post('/google/token', async (req: Request, res: Response, next) => {
  try {
    const { idToken } = req.body as { idToken?: string }
    if (!idToken) throw new AppError('INVALID_REQUEST', 'Missing idToken', 400)

    const ticket = await (oauthClient.verifyIdToken({
      idToken,
      audience: process.env['GOOGLE_CLIENT_ID']!,
    }) as Promise<any>)
    const googlePayload = ticket.getPayload()
    if (!googlePayload) throw new AppError('AUTH_FAILED', 'Failed to verify Google token', 401)

    // Enforce hosted domain when configured
    if (WORKSPACE_DOMAIN && googlePayload.hd !== WORKSPACE_DOMAIN) {
      throw new AppError('AUTH_FAILED', 'Account not in the organisation domain', 403)
    }

    const email = googlePayload.email!
    const name = googlePayload.name ?? email.split('@')[0]!

    const user = await queryOne<{ id: string; role: string; auth_type: string }>(
      `INSERT INTO users (email, name, auth_type)
       VALUES ($1, $2, 'google_sso')
       ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name, updated_at = NOW()
       RETURNING id, role, auth_type`,
      [email, name],
    )
    if (!user) throw new AppError('AUTH_FAILED', 'User creation failed', 500)

    const accessToken = signAccessToken({
      sub: user.id,
      email,
      role: user.role as any,
      authType: 'google_sso',
    })
    const refreshToken = signRefreshToken(user.id)

    await writeAudit({ actorId: user.id, action: 'login', entityType: 'user', entityId: user.id })

    res
      .cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/auth/refresh',
      })
      .json({ data: { accessToken, user: { id: user.id, email, name, role: user.role } } })
  } catch (err) {
    next(err)
  }
})

// Step 2: handle callback from Google
router.get('/google/callback', async (req: Request, res: Response, next) => {
  try {
    const { code, state } = req.query as { code: string; state?: string }
    if (!code) throw new AppError('INVALID_REQUEST', 'Missing authorization code', 400)

    // Decode mobile_redirect from state (if present)
    let mobileRedirect: string | null = null
    if (state) {
      try {
        const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'))
        mobileRedirect = typeof decoded.mobileRedirect === 'string' ? decoded.mobileRedirect : null
      } catch { /* state not from us — ignore */ }
    }

    const { tokens } = await oauthClient.getToken(code)
    oauthClient.setCredentials(tokens)

    const ticket = await (oauthClient.verifyIdToken({
      idToken: tokens.id_token!,
      audience: process.env['GOOGLE_CLIENT_ID']!,
    }) as Promise<any>)
    const googlePayload = ticket.getPayload()
    if (!googlePayload) throw new AppError('AUTH_FAILED', 'Failed to verify Google token', 401)

    // Enforce hosted domain
    if (googlePayload.hd !== WORKSPACE_DOMAIN) {
      throw new AppError('AUTH_FAILED', 'Account not in the organisation domain', 403)
    }

    const email = googlePayload.email!
    const name = googlePayload.name ?? email.split('@')[0]!

    // Upsert user
    const user = await queryOne<{ id: string; role: string; auth_type: string }>(
      `INSERT INTO users (email, name, auth_type)
       VALUES ($1, $2, 'google_sso')
       ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name, updated_at = NOW()
       RETURNING id, role, auth_type`,
      [email, name],
    )
    if (!user) throw new AppError('AUTH_FAILED', 'User creation failed', 500)

    const accessToken = signAccessToken({
      sub: user.id,
      email,
      role: user.role as any,
      authType: 'google_sso',
    })
    const refreshToken = signRefreshToken(user.id)

    await writeAudit({ actorId: user.id, action: 'login', entityType: 'user', entityId: user.id })

    // In production: set refresh token in httpOnly cookie
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/auth/refresh',
    })

    if (mobileRedirect) {
      // Native app: redirect to the deep-link URI with the token
      res.redirect(`${mobileRedirect}?token=${encodeURIComponent(accessToken)}`)
    } else {
      // Web app: redirect to the frontend callback page
      res.redirect(`${process.env['FRONTEND_URL']}/auth/callback?token=${accessToken}`)
    }
  } catch (err) {
    next(err)
  }
})

// ─── Email + Password ─────────────────────────────────────────────────────────

router.post('/register', validate(RegisterSchema), async (req: Request, res: Response, next) => {
  try {
    const { email, password, name } = req.body as { email: string; password: string; name: string }

    // Enforce company domain
    const domain = email.split('@')[1]
    if (domain !== WORKSPACE_DOMAIN) {
      throw new AppError('FORBIDDEN', 'Registration requires a company email address', 403)
    }

    const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email])
    if (existing) throw new AppError('CONFLICT', 'Email already registered', 409)

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await queryOne<{ id: string; role: string }>(
      `INSERT INTO users (email, name, password_hash, auth_type)
       VALUES ($1, $2, $3, 'email_password')
       RETURNING id, role`,
      [email, name, passwordHash],
    )
    if (!user) throw new AppError('INTERNAL_ERROR', 'User creation failed', 500)

    // Provision default notification prefs
    await query(
      `INSERT INTO notification_prefs (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [user.id],
    )

    const accessToken = signAccessToken({
      sub: user.id,
      email,
      role: user.role as any,
      authType: 'email_password',
    })
    const refreshToken = signRefreshToken(user.id)

    res
      .cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/auth/refresh',
      })
      .status(201)
      .json({ data: { accessToken, user: { id: user.id, email, name, role: user.role } } })
  } catch (err) {
    next(err)
  }
})

router.post('/login', validate(EmailPasswordLoginSchema), async (req: Request, res: Response, next) => {
  try {
    const { email, password } = req.body as { email: string; password: string }

    const user = await queryOne<{ id: string; role: string; name: string; password_hash: string | null; auth_type: string }>(
      `SELECT id, role, name, password_hash, auth_type FROM users WHERE email = $1 AND is_active = TRUE`,
      [email],
    )
    if (!user || user.auth_type !== 'email_password' || !user.password_hash) {
      throw new AppError('UNAUTHORIZED', 'Invalid credentials', 401)
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) throw new AppError('UNAUTHORIZED', 'Invalid credentials', 401)

    const accessToken = signAccessToken({
      sub: user.id,
      email,
      role: user.role as any,
      authType: 'email_password',
    })
    const refreshToken = signRefreshToken(user.id)

    await writeAudit({ actorId: user.id, action: 'login', entityType: 'user', entityId: user.id })

    res
      .cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/auth/refresh',
      })
      .json({ data: { accessToken, user: { id: user.id, email, name: user.name, role: user.role } } })
  } catch (err) {
    next(err)
  }
})

// ─── Token refresh ────────────────────────────────────────────────────────────

router.post('/refresh', async (req: Request, res: Response, next) => {
  try {
    const token = req.cookies?.refresh_token as string | undefined
    if (!token) throw new AppError('UNAUTHORIZED', 'No refresh token', 401)

    const { sub } = verifyRefreshToken(token)
    const user = await queryOne<{ id: string; email: string; role: string; auth_type: string }>(
      `SELECT id, email, role, auth_type FROM users WHERE id = $1 AND is_active = TRUE`,
      [sub],
    )
    if (!user) throw new AppError('UNAUTHORIZED', 'User not found', 401)

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role as any,
      authType: user.auth_type as any,
    })
    res.json({ data: { accessToken } })
  } catch (err) {
    next(err)
  }
})

// ─── Current user ─────────────────────────────────────────────────────────────

router.get('/me', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const user = await queryOne(
      `SELECT id, email, name, department, team, manager_id, role, auth_type, is_active, slack_user_id, created_at
       FROM users WHERE id = $1`,
      [req.user!.sub],
    )
    if (!user) throw new AppError('NOT_FOUND', 'User not found', 404)
    res.json({ data: user })
  } catch (err) {
    next(err)
  }
})

// ─── Forgot / Reset password ──────────────────────────────────────────────────

router.post('/forgot-password', validate(ForgotPasswordSchema), async (req: Request, res: Response, next) => {
  try {
    const { email } = req.body as { email: string }
    const user = await queryOne<{ id: string; name: string }>(
      `SELECT id, name FROM users WHERE email = $1 AND auth_type = 'email_password' AND is_active = TRUE`,
      [email],
    )
    // Always return 200 to prevent email enumeration
    if (user) {
      const token = crypto.randomBytes(32).toString('hex')
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
      await query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
        [user.id, tokenHash],
      )
      await sendPasswordResetEmail(email, user.name, token)
    }
    res.json({ data: { message: 'If that email exists, a reset link has been sent.' } })
  } catch (err) {
    next(err)
  }
})

router.post('/reset-password', validate(ResetPasswordSchema), async (req: Request, res: Response, next) => {
  try {
    const { token, newPassword } = req.body as { token: string; newPassword: string }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    const record = await queryOne<{ id: string; user_id: string; used_at: string | null }>(
      `SELECT id, user_id, used_at FROM password_reset_tokens
       WHERE token_hash = $1 AND expires_at > NOW()`,
      [tokenHash],
    )
    if (!record || record.used_at) {
      throw new AppError('INVALID_TOKEN', 'Reset token is invalid or expired', 400)
    }

    const passwordHash = await bcrypt.hash(newPassword, 12)
    await query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [
      passwordHash,
      record.user_id,
    ])
    await query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, [record.id])

    res.json({ data: { message: 'Password updated successfully.' } })
  } catch (err) {
    next(err)
  }
})

// ─── Dev-only instant login (no password check) ───────────────────────────────
// ONLY active in development. Lets you log in as any seeded user by email.

if (process.env['NODE_ENV'] !== 'production') {
  router.post('/dev-login', async (req: Request, res: Response, next) => {
    try {
      const { email } = req.body as { email: string }
      const user = await queryOne<{ id: string; email: string; name: string; role: string; auth_type: string }>(
        `SELECT id, email, name, role, auth_type FROM users WHERE email = $1 AND is_active = TRUE`,
        [email],
      )
      if (!user) throw new AppError('NOT_FOUND', 'User not found', 404)

      const accessToken = signAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role as any,
        authType: user.auth_type as any,
      })

      res.json({ data: { accessToken, user } })
    } catch (err) {
      next(err)
    }
  })
}

export default router
