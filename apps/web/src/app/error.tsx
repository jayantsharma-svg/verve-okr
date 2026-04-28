'use client'

import Link from 'next/link'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-ink-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-cap-sm border border-ink-100 p-10 max-w-md w-full text-center">
        <h1 className="text-2xl font-extrabold text-ink-900">Something went wrong</h1>
        <p className="text-sm text-ink-500 mt-3 break-words">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="bg-verve text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-verve-d transition-colors shadow-cap-sm"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-ink-600 hover:text-ink-900 transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
