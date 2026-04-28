'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { VerveLogo } from '@/components/VerveLogo'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  LayoutDashboard, Target, CheckCircle, Users,
  Settings, Download, BarChart3, LogOut, Upload, Mail, Calendar, Sheet,
  CalendarRange, ClipboardCheck, UserCog,
} from 'lucide-react'
import type { UserRole } from '@okr-tool/core'

const nav = [
  { href: '/dashboard',          label: 'Dashboard',     icon: LayoutDashboard,  roles: null },
  { href: '/objectives',         label: 'OKRs',          icon: Target,           roles: null },
  { href: '/checkin',            label: 'Check-in',      icon: CheckCircle,      roles: null },
  { href: '/reviews',            label: 'Reviews',       icon: BarChart3,        roles: null },
  { href: '/appraisals',         label: 'Appraisals',    icon: Users,            roles: null },
  { href: '/bulk-import',        label: 'Bulk Import',   icon: Upload,           roles: null },
  { href: '/email-intelligence', label: 'Email Intel',   icon: Mail,             roles: null },
  { href: '/meeting-digest',     label: 'Digest',        icon: Calendar,         roles: null },
  { href: '/sheets',             label: 'Sheets Sync',   icon: Sheet,            roles: null },
  { href: '/settings',           label: 'Settings',      icon: Settings,         roles: null },
  // Role-gated admin routes
  { href: '/objectives/pending', label: 'Pending',       icon: ClipboardCheck,   roles: ['admin', 'team_lead', 'dept_lead'] as UserRole[] },
  { href: '/admin/cycles',       label: 'Cycles',        icon: CalendarRange,    roles: ['admin', 'dept_lead'] as UserRole[] },
  { href: '/admin/users',        label: 'Users',         icon: UserCog,          roles: ['admin'] as UserRole[] },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const ready = useAuthGuard()
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.auth.me(),
    enabled: ready,
    staleTime: 60_000,
  })
  const myRole = me?.role as UserRole | undefined

  // Render nothing (hook redirects to /login) until token is confirmed
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-verve border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-ink-400 font-medium">Loading…</p>
        </div>
      </div>
    )
  }

  const handleLogout = () => {
    localStorage.removeItem('okr_access_token')
    window.location.href = '/login'
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-ink-50">
      {/* Sidebar */}
      <aside className="hidden md:flex md:w-60 bg-white shadow-cap-sm flex-col">
        {/* Gradient strip accent at top */}
        <div className="h-1 cap-strip flex-shrink-0" />

        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-ink-100">
          <VerveLogo size={28} showWordmark={true} />
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {(() => {
            const visibleItems = nav.filter(({ roles }) =>
              roles === null || (myRole && roles.includes(myRole)),
            )
            const generalItems = visibleItems.filter(({ roles }) => roles === null)
            const adminItems   = visibleItems.filter(({ roles }) => roles !== null)

            const renderLink = ({ href, label, icon: Icon }: typeof nav[number]) => {
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
            }

            return (
              <>
                {generalItems.map(renderLink)}
                {adminItems.length > 0 && (
                  <>
                    <div className="pt-3 pb-1 px-3">
                      <p className="text-xs font-semibold text-ink-300 uppercase tracking-wider">Admin</p>
                    </div>
                    {adminItems.map(renderLink)}
                  </>
                )}
              </>
            )
          })()}
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
