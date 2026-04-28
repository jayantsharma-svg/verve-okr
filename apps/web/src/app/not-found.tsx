import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-ink-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-cap-sm border border-ink-100 p-10 max-w-md w-full text-center">
        <h1 className="text-8xl font-extrabold text-verve tracking-tight">404</h1>
        <h2 className="text-xl font-bold text-ink-900 mt-4">Page not found</h2>
        <p className="text-sm text-ink-500 mt-2">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block bg-verve text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-verve-d transition-colors shadow-cap-sm"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}
