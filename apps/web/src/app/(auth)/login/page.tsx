'use client'

import { useState } from 'react'
import { VerveLogo } from '@/components/VerveLogo'

export default function LoginPage() {
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
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center mb-4">
                <VerveLogo size={48} showWordmark={false} />
              </div>
              <h1 className="text-2xl font-extrabold text-ink-900 tracking-tight">Sign in to Verve</h1>
              <p className="text-sm text-ink-500 mt-1 font-medium">OKRs that move</p>
            </div>

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

            <p className="text-center text-xs text-ink-400 mt-6">
              By signing in you agree to your organisation&apos;s data policies.
            </p>
          </div>
        </div>

        {/* Footer Links */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <a href="/docs" className="text-xs font-medium text-verve hover:underline">
            Documentation
          </a>
          <span className="text-ink-300">•</span>
          <a href="/privacy-policy" className="text-xs font-medium text-verve hover:underline">
            Privacy Policy
          </a>
        </div>

        {process.env['NODE_ENV'] !== 'production' && <DevLoginPanel />}
      </div>
    </div>
  )
}

// ─── Dev-only quick-login panel ───────────────────────────────────────────────
// Only rendered in development. Uses the /auth/dev-login endpoint which is also
// stripped from the production build.

const DEV_USERS = [
  { email: 'jayant.sharma@capillarytech.com',  label: 'Jayant Sharma — Admin' },
  { email: 'priya.mehta@capillarytech.com',    label: 'Priya Mehta — Engineering Dept Lead' },
  { email: 'arjun.kapoor@capillarytech.com',   label: 'Arjun Kapoor — Backend Team Lead' },
  { email: 'anjali.sharma@capillarytech.com',  label: 'Anjali Sharma — Frontend Team Lead' },
  { email: 'rahul.singh@capillarytech.com',    label: 'Rahul Singh — Backend Member' },
  { email: 'vikram.nair@capillarytech.com',    label: 'Vikram Nair — Product Dept Lead' },
  { email: 'deepa.reddy@capillarytech.com',    label: 'Deepa Reddy — Core Product Team Lead' },
  { email: 'rajesh.iyer@capillarytech.com',    label: 'Rajesh Iyer — Sales Dept Lead' },
]

function DevLoginPanel() {
  const [loading, setLoading] = useState(false)

  const loginAs = async (email: string) => {
    setLoading(true)
    try {
      const res = await fetch(
        `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'}/auth/dev-login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        },
      )
      const json = await res.json()
      localStorage.setItem('okr_access_token', json.data.accessToken)
      window.location.href = '/dashboard'
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-5">
      <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-3">Dev — instant login</p>
      <div className="space-y-1.5">
        {DEV_USERS.map(({ email, label }) => (
          <button
            key={email}
            disabled={loading}
            onClick={() => loginAs(email)}
            className="w-full text-left text-sm px-3 py-2 rounded-lg bg-white border border-amber-200 text-ink-700 hover:border-amber-400 disabled:opacity-50 transition-colors font-medium"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
