'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { VerveLogo } from '@/components/VerveLogo'
import {
  LayoutDashboard, Target, CheckCircle, Users,
  Settings, Download, BarChart3, LogOut, Upload, Mail, Calendar, Sheet,
} from 'lucide-react'

const nav = [
  { href: '/dashboard',          label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/objectives',         label: 'OKRs',          icon: Target },
  { href: '/checkin',            label: 'Check-in',      icon: CheckCircle },
  { href: '/reviews',            label: 'Reviews',       icon: BarChart3 },
  { href: '/appraisals',         label: 'Appraisals',    icon: Users },
  { href: '/bulk-import',        label: 'Bulk Import',   icon: Upload },
  { href: '/email-intelligence', label: 'Email Intel',   icon: Mail },
  { href: '/meeting-digest',     label: 'Digest',        icon: Calendar },
  { href: '/sheets',             label: 'Sheets Sync',   icon: Sheet },
  { href: '/settings',           label: 'Settings',      icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const handleLogout = () => {
    localStorage.removeItem('okr_access_token')
    window.location.href = '/login'
  }

  return (
    <div className="flex h-screen bg-ink-50">
      {/* Sidebar */}
      <aside className="w-60 bg-white shadow-cap-sm flex flex-col">
        {/* Gradient strip accent at top */}
        <div className="h-1 cap-strip flex-shrink-0" />

        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-ink-100">
          <VerveLogo size={28} showWordmark={true} />
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors',
                  active
                    ? 'bg-verve-l text-verve'
                    : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
                )}
              >
                <Icon size={16} className={active ? 'text-verve' : 'text-ink-400'} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom actions */}
        <div className="px-3 py-4 border-t border-ink-100 space-y-0.5">
          <a
            href="/api/export/okrs"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-ink-600 hover:bg-ink-50 hover:text-ink-900 transition-colors"
          >
            <Download size={16} className="text-ink-400" />
            Export OKRs
          </a>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-ink-600 hover:bg-ink-50 hover:text-ink-900 transition-colors"
          >
            <LogOut size={16} className="text-ink-400" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
