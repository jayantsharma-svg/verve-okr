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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 w-full max-w-md">

        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-xl mb-4">
            <span className="text-white font-bold text-xl">V</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Sign in to Verve</h1>
          <p className="text-sm text-gray-500 mt-1">Enterprise OKR management</p>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg border border-gray-200 p-1 mb-6">
          {(['sso', 'password'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'flex-1 text-sm py-2 rounded-md font-medium transition-colors',
                mode === m
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {m === 'sso' ? 'Google SSO' : 'Email & Password'}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {mode === 'sso' ? (
          <button
            onClick={handleGoogleSSO}
            className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {/* Google "G" icon */}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Work email
              </label>
              <input
                type="email"
                autoComplete="email"
                {...register('email')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@company.com"
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                {...register('password')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            <div className="flex justify-end">
              <a href="/login/forgot-password" className="text-xs text-blue-600 hover:underline">
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          By signing in you agree to your organisation&apos;s data policies.
        </p>
      </div>

      {/* Dev login panel — only shown in development */}
      {process.env['NODE_ENV'] !== 'production' && (
        <DevLoginPanel />
      )}
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
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="mt-6 w-full max-w-md mx-auto bg-amber-50 border border-amber-200 rounded-2xl p-5">
      <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3">
        Dev — instant login
      </p>
      <div className="space-y-1.5">
        {DEV_USERS.map(({ email, label }) => (
          <button
            key={email}
            disabled={loading}
            onClick={() => loginAs(email)}
            className="w-full text-left text-sm px-3 py-2 rounded-lg bg-white border border-amber-200 text-gray-700 hover:border-amber-400 hover:bg-amber-50 disabled:opacity-50 transition-colors"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
