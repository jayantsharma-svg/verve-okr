import { Router } from 'express'
import { OAuth2Client } from 'google-auth-library'
import { queryOne } from '../db/client.js'
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  requireAuth,
} from '../middleware/auth.js'
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

// ─── Dev-only instant login (no password check) ───────────────────────────────
// Active in non-production OR when ALLOW_DEV_LOGIN=true (set for internal
// simulator / staging builds — never enable on a public-facing deployment).

if (process.env['NODE_ENV'] !== 'production' || process.env['ALLOW_DEV_LOGIN'] === 'true') {
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
