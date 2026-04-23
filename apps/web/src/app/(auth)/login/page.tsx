'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { EmailPasswordLoginSchema } from '@okr-tool/core'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { z } from 'zod'

type LoginForm = z.infer<typeof EmailPasswordLoginSchema>

export default function LoginPage() {
  const [mode, setMode] = useState<'sso' | 'password'>('sso')
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<LoginForm>({ resolver: zodResolver(EmailPasswordLoginSchema) })

  const onSubmit = async (data: LoginForm) => {
    try {
      setError(null)
      const session = await api.auth.loginWithPassword(data.email, data.password)
      localStorage.setItem('okr_access_token', session.accessToken)
      window.location.href = '/dashboard'
    } catch (err: any) {
      setError(err.message ?? 'Login failed. Please try again.')
    }
  }

  const handleGoogleSSO = () => {
    window.location.href = `${process.env['NEXT_PUBLIC_API_URL']}/auth/google`
  }

  return (
    <div className="min-h-screen bg-ink-50 flex flex-col items-center justify-center p-4">
      {/* Top gradient strip */}
      <div className="fixed top-0 left-0 right-0 h-1 cap-strip z-50" />

      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-cap-md overflow-hidden">
          {/* Card gradient accent strip */}
          <div className="h-1.5 cap-strip" />

          <div className="p-8">
            {/* Brand */}
            <div className="text-center mb-7">
              {/* Verve mark */}
              <div className="inline-flex items-center justify-center mb-4">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="vg-login" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0" stopColor="#0F766E" />
                      <stop offset="1" stopColor="#14B8A6" />
                    </linearGradient>
                  </defs>
                  <path d="M4 40 L20 12 L30 30 Z" fill="#0F766E" opacity="0.35" />
                  <path d="M10 40 L28 8 L44 40 Z" fill="url(#vg-login)" />
                  <circle cx="36" cy="12" r="3" fill="#FDE68A" />
                </svg>
              </div>
              <h1 className="text-2xl font-extrabold text-ink-900 tracking-tight">Sign in to Verve</h1>
              <p className="text-sm text-ink-500 mt-1 font-medium">OKRs that move</p>
            </div>

            {/* Mode toggle */}
            <div className="flex rounded-lg bg-ink-50 p-1 mb-6 gap-1">
              {(['sso', 'password'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    'flex-1 text-sm py-2 rounded-md font-semibold transition-all',
                    mode === m
                      ? 'bg-white text-verve shadow-cap-sm'
                      : 'text-ink-500 hover:text-ink-700',
                  )}
                >
                  {m === 'sso' ? 'Google SSO' : 'Email & Password'}
                </button>
              ))}
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-cap-red text-cap-red text-sm rounded-lg px-4 py-3 mb-4 font-medium">
                {error}
              </div>
            )}

            {mode === 'sso' ? (
              <button
                onClick={handleGoogleSSO}
                className="w-full flex items-center justify-center gap-3 border-2 border-ink-200 rounded-xl px-4 py-3 text-sm font-semibold text-ink-700 hover:border-verve hover:text-verve transition-colors group"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
                </svg>
                Continue with Google Workspace
              </button>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-ink-700 mb-1.5">Work email</label>
                  <input
                    type="email"
                    autoComplete="email"
                    {...register('email')}
                    className="w-full border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-verve focus:border-transparent transition-shadow"
                    placeholder="you@capillary.com"
                  />
                  {errors.email && <p className="text-cap-red text-xs mt-1">{errors.email.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-ink-700 mb-1.5">Password</label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    {...register('password')}
                    className="w-full border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-verve focus:border-transparent"
                  />
                  {errors.password && <p className="text-cap-red text-xs mt-1">{errors.password.message}</p>}
                </div>
                <div className="flex justify-end">
                  <a href="/login/forgot-password" className="text-xs text-verve hover:underline font-medium">Forgot password?</a>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-verve text-white rounded-xl py-3 text-sm font-bold hover:bg-verve-d disabled:opacity-50 transition-colors shadow-cap-sm"
                >
                  {isSubmitting ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            )}

            <p className="text-center text-xs text-ink-400 mt-6">
              By signing in you agree to your organisation&apos;s data policies.
            </p>
          </div>
        </div>

        {process.env['NODE_ENV'] !== 'production' && <DevLoginPanel />}
      </div>
    </div>
  )
}

const DEV_USERS = [
  { email: 'ceo@capillary.com',        label: 'Sameer Nair — CEO (Admin)' },
  { email: 'cto@capillary.com',         label: 'Priya Mehta — CTO (Dept Lead)' },
  { email: 'vp.product@capillary.com',  label: 'Arjun Sharma — VP Product (Dept Lead)' },
  { email: 'vp.cs@capillary.com',       label: 'Divya Nair — VP Customer Success (Dept Lead)' },
  { email: 'vp.sales@capillary.com',    label: 'Ravi Kumar — VP Sales (Dept Lead)' },
  { email: 'tl.platform@capillary.com', label: 'Ananya Rao — Platform Lead (Team Lead)' },
  { email: 'eng1@capillary.com',        label: 'Aditya Singh — Engineer (Member)' },
]

function DevLoginPanel() {
  const [loading, setLoading] = useState(false)
  const loginAs = async (email: string) => {
    setLoading(true)
    try {
      const res = await fetch(`${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'}/auth/dev-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const json = await res.json()
      localStorage.setItem('okr_access_token', json.data.accessToken)
      window.location.href = '/dashboard'
    } catch { setLoading(false) }
  }
  return (
    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-5">
      <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-3">Dev — instant login</p>
      <div className="space-y-1.5">
        {DEV_USERS.map(({ email, label }) => (
          <button key={email} disabled={loading} onClick={() => loginAs(email)}
            className="w-full text-left text-sm px-3 py-2 rounded-lg bg-white border border-amber-200 text-ink-700 hover:border-amber-400 disabled:opacity-50 transition-colors font-medium">
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
