'use client'

import { useState } from 'react'
import { ChevronDown, CheckCircle2, Clock, AlertTriangle, Users, BarChart3, FileText, Zap } from 'lucide-react'
import Link from 'next/link'

type Section = 'overview' | 'getting-started' | 'web-features' | 'admin' | 'integrations' | 'mobile' | 'faq'

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<Section>('overview')
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null)

  const sections: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <FileText size={18} /> },
    { id: 'getting-started', label: 'Getting Started', icon: <Zap size={18} /> },
    { id: 'web-features', label: 'Web Features', icon: <BarChart3 size={18} /> },
    { id: 'admin', label: 'Admin', icon: <Users size={18} /> },
    { id: 'integrations', label: 'Integrations', icon: <CheckCircle2 size={18} /> },
    { id: 'mobile', label: 'Mobile App', icon: <Zap size={18} /> },
    { id: 'faq', label: 'FAQ', icon: <FileText size={18} /> },
  ]

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return <OverviewSection />
      case 'getting-started':
        return <GettingStartedSection />
      case 'web-features':
        return <WebFeaturesSection />
      case 'admin':
        return <AdminSection />
      case 'integrations':
        return <IntegrationsSection />
      case 'mobile':
        return <MobileSection />
      case 'faq':
        return <FaqSection expandedIndex={expandedFaqIndex} setExpandedIndex={setExpandedFaqIndex} />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-ink-50 to-white">
      {/* Header */}
      <div className="bg-white border-b border-ink-100">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <h1 className="text-4xl font-extrabold text-ink-900 tracking-tight">Verve Documentation</h1>
          <p className="text-lg text-ink-500 mt-2">Learn how to get the most out of your OKR platform</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <aside className="lg:col-span-1">
            <nav className="sticky top-8 space-y-2">
              {sections.map(({ id, label, icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all text-left ${
                    activeSection === id
                      ? 'bg-verve text-white shadow-lg'
                      : 'text-ink-600 hover:bg-ink-100'
                  }`}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </nav>

            {/* Quick Links */}
            <div className="mt-12 p-4 bg-verve-l rounded-lg border border-verve">
              <p className="text-xs font-semibold text-verve-d mb-3 uppercase">Quick Links</p>
              <div className="space-y-2">
                <Link href="/auth/login" className="block text-sm text-verve hover:underline font-medium">
                  → Sign In
                </Link>
                <a href="mailto:support@verve.local" className="block text-sm text-verve hover:underline font-medium">
                  → Contact Support
                </a>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-3">
            <div className="bg-white rounded-xl border border-ink-100 p-8 shadow-cap-sm">
              {renderContent()}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

function OverviewSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-ink-900 mb-3">What is Verve?</h2>
        <p className="text-ink-600 leading-relaxed">
          Verve is a modern OKR (Objectives & Key Results) platform designed to help teams set ambitious goals, track progress, and align work across the organization. Whether you're an individual contributor, team lead, or manager, Verve makes it easy to define what matters and measure progress toward those goals.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <FeatureCard
          icon={<BarChart3 className="text-verve" size={24} />}
          title="Track Progress"
          description="Real-time visibility into OKR progress with visual indicators and confidence levels."
        />
        <FeatureCard
          icon={<Users className="text-cap-green" size={24} />}
          title="Align Teams"
          description="Connect individual OKRs to team and organizational goals for complete alignment."
        />
        <FeatureCard
          icon={<CheckCircle2 className="text-cap-amber" size={24} />}
          title="Stay Informed"
          description="Weekly digest emails and automated check-in reminders keep everyone on track."
        />
        <FeatureCard
          icon={<Clock className="text-cap-red" size={24} />}
          title="Manage Cycles"
          description="Flexible planning, active, review, and closed cycle states for your OKR workflow."
        />
      </div>

      <div className="mt-8 p-6 bg-verve-l rounded-lg border border-verve">
        <h3 className="font-bold text-ink-900 mb-2">Key Terminology</h3>
        <ul className="space-y-2 text-sm text-ink-700">
          <li><strong>Objective:</strong> A qualitative goal describing what you want to achieve (e.g., "Improve customer satisfaction")</li>
          <li><strong>Key Result:</strong> A quantitative measure of success for an objective (e.g., "Increase NPS from 40 to 65")</li>
          <li><strong>Check-in:</strong> A progress update on a Key Result, submitted weekly or as needed</li>
          <li><strong>Confidence:</strong> Your belief that a Key Result will be achieved (On Track / At Risk / Off Track)</li>
          <li><strong>Cycle:</strong> A time period (typically quarterly) during which OKRs are active</li>
        </ul>
      </div>
    </div>
  )
}

function GettingStartedSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-ink-900 mb-3">Getting Started</h2>
        <p className="text-ink-600 mb-6">
          Follow these steps to begin using Verve:
        </p>
      </div>

      <div className="space-y-4">
        <StepCard
          number={1}
          title="Sign In"
          description="Use your Workspace email to sign in securely. Your account is automatically created from your organization's directory."
        />
        <StepCard
          number={2}
          title="Complete Your Profile"
          description="Add a profile photo and set your preferences in your profile settings."
        />
        <StepCard
          number={3}
          title="Wait for an Active Cycle"
          description="Your admin will create and activate an OKR cycle. You'll see it on the dashboard once available."
        />
        <StepCard
          number={4}
          title="Create Your First OKR"
          description="Go to Objectives > Create OKR. Choose your level (Individual, Team, or Organizational) and write your objective and key results."
        />
        <StepCard
          number={5}
          title="Submit Check-ins"
          description="Each week, update progress on your Key Results. This helps you and your team stay aligned and aware of blockers."
        />
      </div>

      <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-sm text-amber-900">
          <strong>Note:</strong> If you're creating a Team or Organization-level OKR as a regular user, it will need approval from an admin or your department lead before it becomes active.
        </p>
      </div>
    </div>
  )
}

function WebFeaturesSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-ink-900 mb-3">Web Platform Features</h2>
      </div>

      <div className="space-y-6">
        <FeatureSection
          title="Dashboard"
          description="Your at-a-glance view of all your OKRs and their status."
          features={[
            'Real-time stats: Total OKRs, On Track, At Risk, Off Track',
            'Click stat cards to filter the list by confidence',
            'Amber banner shows pending OKRs awaiting approval',
            'Progress bars and SMART+ scores for each objective',
            'Quick access to create new OKRs',
          ]}
        />

        <FeatureSection
          title="Objectives"
          description="Manage and track your OKRs throughout the cycle."
          features={[
            'Create new OKRs with clear objectives and measurable key results',
            'Add, edit, and track key results with progress bars',
            'Set and update confidence levels for each KR',
            'View SMART+ score showing goal quality',
            'See real-time progress from latest check-ins',
            'Submit check-ins directly on KRs',
          ]}
        />

        <FeatureSection
          title="Check-ins"
          description="Keep your team updated on progress toward goals."
          features={[
            'Quick check-in form: update value, confidence, and optional note',
            'Historical check-in log showing all updates',
            'Parent objective progress auto-calculated from KRs',
            'For objectives without KRs, submit confidence + note directly',
          ]}
        />

        <FeatureSection
          title="Reviews (Coming Soon)"
          description="Performance review and feedback cycles integrated with OKRs."
          features={[
            'Submit self-reviews against your OKR achievements',
            'Managers approve or request revision',
            'Historical review records for comparison',
          ]}
        />

        <FeatureSection
          title="Pending Approvals"
          description="Admin view for all OKRs awaiting approval (admin/team lead only)."
          features={[
            'View all pending OKRs from the organization',
            'Approve to activate an OKR immediately',
            'Reject with optional feedback',
          ]}
        />
      </div>
    </div>
  )
}

function AdminSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-ink-900 mb-3">Admin Features</h2>
        <p className="text-ink-600 mb-4">
          Administrators have access to additional tools for managing cycles, users, and approvals.
        </p>
      </div>

      <div className="space-y-6">
        <FeatureSection
          title="Manage Cycles"
          description="Control the OKR planning and execution timeline."
          features={[
            'View all cycles with their current status (Planning, Active, Review, Closed)',
            'Create new cycles with dates and type',
            'Advance cycles through their lifecycle',
            'Only one cycle can be Active at a time',
            'Active cycle determines which OKRs appear on the dashboard',
          ]}
        />

        <FeatureSection
          title="Manage Users"
          description="Administer team members and their roles."
          features={[
            'View all users in the organization',
            'Assign and change user roles: admin, dept_lead, manager, individual',
            'Sync users from Google Workspace to keep the directory current',
            'Users automatically created from your Workspace on first login',
          ]}
        />

        <FeatureSection
          title="Approve OKRs"
          description="Review and approve pending OKRs from team members."
          features={[
            'View all OKRs awaiting approval',
            'Approve to activate immediately or reject if not aligned',
            'Individual-level OKRs auto-approve (no admin review needed)',
            'Admins and dept_leads auto-bypass approval for their own OKRs',
          ]}
        />

        <div className="p-4 bg-verve-l border border-verve rounded-lg">
          <p className="text-sm text-ink-700">
            <strong>Admin Roles:</strong> Admins can perform all actions. Department leads can approve OKRs and manage users in their department.
          </p>
        </div>
      </div>
    </div>
  )
}

function IntegrationsSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-ink-900 mb-3">Integrations</h2>
        <p className="text-ink-600 mb-4">
          Verve integrates with your existing tools to streamline workflows.
        </p>
      </div>

      <div className="space-y-6">
        <FeatureSection
          title="Google Sheets"
          description="Export and import OKRs and check-ins with Google Sheets for easy collaboration."
          features={[
            'All OKRs and current progress automatically exported to a linked Google Sheet',
            'Update check-in values directly in the sheet',
            'Weekly import sync pulls changes back into Verve',
            'Share the sheet with stakeholders for read-only visibility',
            'Admin configures the sheet URL in settings',
          ]}
        />

        <FeatureSection
          title="Email Notifications"
          description="Stay informed with automated emails and digests."
          features={[
            'Check-in reminder emails: sent weekly to prompt updates',
            'Meeting digest email: weekly summary of org-wide OKR status (Monday 7am UTC)',
            'Approval notifications: admins notified when new OKRs need approval',
            'All emails are non-intrusive; customize frequency in settings',
          ]}
        />

        <FeatureSection
          title="Google Workspace"
          description="Automated synchronization with your Workspace directory."
          features={[
            'Nightly org sync pulls your latest user list and team structure',
            'Users automatically created on first login with correct department',
            'Admin can manually trigger sync from Users page',
            'No action needed — syncs automatically',
          ]}
        />
      </div>
    </div>
  )
}

function MobileSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-ink-900 mb-3">Mobile App (iOS)</h2>
        <p className="text-ink-600 mb-4">
          Verve is also available as a native iOS app for on-the-go access to your OKRs and check-ins.
        </p>
      </div>

      <div className="space-y-6">
        <FeatureSection
          title="Getting Started"
          description="Install and set up the mobile app."
          features={[
            'Download from the App Store: [Coming Soon]',
            'Sign in with your Workspace email',
            'Access the same OKRs and data as the web app',
            'Offline support for viewing cached data',
          ]}
        />

        <FeatureSection
          title="Mobile Features"
          description="Key features available on iOS."
          features={[
            'Dashboard with your OKRs and current status',
            'Quick check-in submission with progress and confidence',
            'Browse objectives and key results on the go',
            'View profile and account settings',
            '[More features coming as app evolves]',
          ]}
        />

        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-900">
            <strong>Status:</strong> The iOS app is currently in development. Android app coming later.
          </p>
        </div>
      </div>
    </div>
  )
}

function FaqSection({ expandedIndex, setExpandedIndex }: { expandedIndex: number | null; setExpandedIndex: (i: number | null) => void }) {
  const faqs = [
    {
      q: 'How often should I submit check-ins?',
      a: 'You should submit check-ins at least weekly. This helps your team understand progress and any blockers. More frequent check-ins are helpful during critical weeks.',
    },
    {
      q: 'What if I don\'t think I can achieve my Key Result?',
      a: 'Mark it as "At Risk" or "Off Track" in your check-in. Add a note explaining the blocker and any corrective actions you\'re taking. Your manager can help you adjust the goal if needed.',
    },
    {
      q: 'Can I edit an OKR after it\'s active?',
      a: 'Yes, you can edit objectives and key results even after they\'re active. However, major changes should be discussed with your manager to avoid misalignment.',
    },
    {
      q: 'What\'s the difference between On Track, At Risk, and Off Track?',
      a: 'On Track = 70%+ confidence of achieving the goal. At Risk = 40–70% confidence. Off Track = <40% confidence or serious blockers. These are updated with each check-in.',
    },
    {
      q: 'How are individual, team, and org OKRs different?',
      a: 'Individual OKRs are personal goals. Team OKRs are for a team and may need approval. Org OKRs are strategic company goals. Individual OKRs should ladder up to team/org goals.',
    },
    {
      q: 'Do I need approval for all my OKRs?',
      a: 'Individual-level OKRs auto-approve. Team and Org OKRs need approval from a manager, dept_lead, or admin. Admins and dept_leads auto-bypass approval for their own OKRs.',
    },
    {
      q: 'How can I sync the latest check-ins with the Google Sheet?',
      a: 'The sync happens automatically every night. You can also manually trigger it from the Admin > Users page by clicking "Sync from Google".',
    },
    {
      q: 'Will I be notified when I have a pending approval?',
      a: 'Yes, you\'ll see an amber banner on the dashboard if there are pending OKRs. Admins are also notified via email.',
    },
    {
      q: 'Can I use Verve offline?',
      a: 'The web app requires internet. The iOS mobile app has limited offline support for cached data.',
    },
    {
      q: 'Who do I contact for technical issues?',
      a: 'Contact your admin or support team. You can also reach out to support@verve.local with details of the issue.',
    },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-ink-900 mb-3">Frequently Asked Questions</h2>
      </div>

      <div className="space-y-3">
        {faqs.map((faq, index) => (
          <div
            key={index}
            className="border border-ink-100 rounded-lg overflow-hidden hover:border-verve transition-colors"
          >
            <button
              onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
              className="w-full flex items-center justify-between p-4 bg-white hover:bg-ink-50 transition-colors"
            >
              <span className="font-semibold text-ink-900 text-left">{faq.q}</span>
              <ChevronDown
                size={20}
                className={`text-ink-400 shrink-0 transition-transform ${
                  expandedIndex === index ? 'rotate-180' : ''
                }`}
              />
            </button>
            {expandedIndex === index && (
              <div className="px-4 py-3 bg-ink-50 border-t border-ink-100">
                <p className="text-ink-700">{faq.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-verve-l border border-verve rounded-lg">
        <p className="text-sm text-ink-700">
          <strong>Don't see your answer?</strong> Contact your admin or email support@verve.local
        </p>
      </div>
    </div>
  )
}

// Helper Components

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="p-4 border border-ink-100 rounded-lg hover:border-verve transition-colors">
      <div className="mb-3">{icon}</div>
      <h4 className="font-bold text-ink-900 mb-2">{title}</h4>
      <p className="text-sm text-ink-600">{description}</p>
    </div>
  )
}

function StepCard({
  number,
  title,
  description,
}: {
  number: number
  title: string
  description: string
}) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0">
        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-verve text-white font-bold">
          {number}
        </div>
      </div>
      <div className="flex-1">
        <h4 className="font-bold text-ink-900 mb-1">{title}</h4>
        <p className="text-sm text-ink-600">{description}</p>
      </div>
    </div>
  )
}

function FeatureSection({
  title,
  description,
  features,
}: {
  title: string
  description: string
  features: string[]
}) {
  return (
    <div className="border-l-4 border-verve pl-4 py-2">
      <h3 className="font-bold text-ink-900 text-lg mb-1">{title}</h3>
      <p className="text-sm text-ink-600 mb-3">{description}</p>
      <ul className="space-y-2">
        {features.map((feature, index) => (
          <li key={index} className="flex gap-2 text-sm text-ink-700">
            <span className="text-verve font-bold">•</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
