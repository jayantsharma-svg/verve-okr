'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

function CallbackHandler() {
  const searchParams = useSearchParams()

  // Run once on mount only — avoids re-firing when the URL changes as part
  // of the navigation triggered below, which would race in React 18 concurrent
  // mode and send the user back to /login before the dashboard fully loads.
  useEffect(() => {
    const token = searchParams.get('token')
    if (token) {
      localStorage.setItem('okr_access_token', token)
      // Hard navigation: guarantees localStorage is committed before the new
      // page's JS runs (no client-side re-render race possible).
      window.location.replace('/dashboard')
    } else {
      window.location.replace('/login?error=auth_failed')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-gray-500">Signing you in…</p>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  )
}
