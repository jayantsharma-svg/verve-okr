import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  Alert,
  Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { api, clearToken } from '@/lib/api'
import { colors, spacing, radius, font, shadow } from '@/lib/theme'
import Card from '@/components/Card'
import { queryClient } from '@/lib/query'

const ROLE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  admin:     { bg: colors.violetLight, text: colors.violet, label: 'Admin' },
  dept_lead: { bg: colors.primaryLight, text: colors.primary, label: 'Dept Lead' },
  team_lead: { bg: colors.tealLight, text: colors.teal, label: 'Team Lead' },
  member:    { bg: colors.gray100, text: colors.gray700, label: 'Member' },
}

const AUTH_METHOD_LABELS: Record<string, string> = {
  google_sso:     'Google SSO',
  email_password: 'Password',
}

const LEAD_TIME_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '4 hours', value: 240 },
]

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('')
}

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

function ToggleRow({
  label,
  sub,
  value,
  onChange,
  last = false,
}: {
  label: string
  sub?: string
  value: boolean
  onChange: (v: boolean) => void
  last?: boolean
}) {
  return (
    <View style={[styles.toggleRow, last && styles.infoRowLast]}>
      <View style={styles.toggleRowLeft}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {sub ? <Text style={styles.toggleSub}>{sub}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.gray200, true: colors.primary }}
        thumbColor={colors.white}
      />
    </View>
  )
}

// ─── Notifications section ────────────────────────────────────────────────────
function NotificationsSection() {
  const qc = useQueryClient()
  const { data: prefs, isLoading } = useQuery({
    queryKey: ['notif-prefs'],
    queryFn: api.notifications.getPrefs,
    staleTime: 60_000,
  })

  const [channel, setChannel] = useState<'slack' | 'gmail'>('gmail')
  const [checkinReminders, setCheckinReminders]     = useState(true)
  const [reviewRequests, setReviewRequests]         = useState(true)
  const [atRiskAlerts, setAtRiskAlerts]             = useState(true)
  const [appraisalUpdates, setAppraisalUpdates]     = useState(true)
  const [collaboratorRequests, setCollaboratorRequests] = useState(true)

  useEffect(() => {
    if (!prefs) return
    setChannel(prefs.channel ?? 'gmail')
    setCheckinReminders(prefs.checkinReminders ?? true)
    setReviewRequests(prefs.reviewRequests ?? true)
    setAtRiskAlerts(prefs.atRiskAlerts ?? true)
    setAppraisalUpdates(prefs.appraisalUpdates ?? true)
    setCollaboratorRequests(prefs.collaboratorRequests ?? true)
  }, [prefs])

  const saveMut = useMutation({
    mutationFn: () =>
      api.notifications.updatePrefs({
        channel,
        checkinReminders,
        reviewRequests,
        atRiskAlerts,
        appraisalUpdates,
        collaboratorRequests,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notif-prefs'] })
      Alert.alert('Saved', 'Notification preferences updated.')
    },
    onError: () => Alert.alert('Error', 'Failed to save. Please try again.'),
  })

  if (isLoading) {
    return (
      <Card style={styles.cardSpacing}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.md }} />
      </Card>
    )
  }

  return (
    <Card style={styles.cardSpacing}>
      <Text style={styles.sectionTitle}>Notifications</Text>

      {/* Channel */}
      <Text style={styles.subLabel}>Channel</Text>
      <View style={styles.segmentRow}>
        {(['gmail', 'slack'] as const).map((ch) => (
          <TouchableOpacity
            key={ch}
            style={[styles.segment, channel === ch && styles.segmentActive]}
            onPress={() => setChannel(ch)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={ch === 'gmail' ? 'mail-outline' : 'logo-slack'}
              size={14}
              color={channel === ch ? colors.white : colors.gray500}
            />
            <Text style={[styles.segmentText, channel === ch && styles.segmentTextActive]}>
              {ch === 'gmail' ? 'Gmail' : 'Slack'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Toggles */}
      <Text style={[styles.subLabel, { marginTop: spacing.md }]}>Notify me about</Text>
      <ToggleRow label="Check-in reminders"      value={checkinReminders}       onChange={setCheckinReminders} />
      <ToggleRow label="Review requests"          value={reviewRequests}         onChange={setReviewRequests} />
      <ToggleRow label="At-risk alerts"            value={atRiskAlerts}           onChange={setAtRiskAlerts} />
      <ToggleRow label="Appraisal updates"         value={appraisalUpdates}       onChange={setAppraisalUpdates} />
      <ToggleRow label="Collaborator requests"     value={collaboratorRequests}   onChange={setCollaboratorRequests} last />

      {/* Save */}
      <TouchableOpacity
        style={[styles.saveBtn, saveMut.isPending && styles.btnDisabled]}
        onPress={() => saveMut.mutate()}
        disabled={saveMut.isPending}
        activeOpacity={0.85}
      >
        {saveMut.isPending
          ? <ActivityIndicator size="small" color={colors.white} />
          : <Text style={styles.saveBtnText}>Save preferences</Text>}
      </TouchableOpacity>
    </Card>
  )
}

// ─── Meeting Digest section ───────────────────────────────────────────────────
function MeetingDigestSection() {
  const qc = useQueryClient()
  const { data: settings, isLoading } = useQuery({
    queryKey: ['meeting-digest-settings'],
    queryFn: api.meetingDigest.getSettings,
    staleTime: 60_000,
  })

  const [enabled, setEnabled]           = useState(false)
  const [leadTime, setLeadTime]         = useState(30)

  useEffect(() => {
    if (!settings) return
    setEnabled(settings.enabled ?? false)
    setLeadTime(settings.leadTimeMinutes ?? 30)
  }, [settings])

  const saveMut = useMutation({
    mutationFn: () =>
      api.meetingDigest.updateSettings({ enabled, leadTimeMinutes: leadTime }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meeting-digest-settings'] })
      Alert.alert('Saved', 'Meeting digest settings updated.')
    },
    onError: () => Alert.alert('Error', 'Failed to save. Please try again.'),
  })

  const testMut = useMutation({
    mutationFn: () => api.meetingDigest.test(),
    onSuccess: (data: any) =>
      Alert.alert('Test sent', data?.message ?? 'A test digest was sent to your inbox.'),
    onError: () => Alert.alert('Error', 'Failed to send test digest.'),
  })

  if (isLoading) {
    return (
      <Card style={styles.cardSpacing}>
        <Text style={styles.sectionTitle}>Meeting Digest</Text>
        <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.md }} />
      </Card>
    )
  }

  return (
    <Card style={styles.cardSpacing}>
      <Text style={styles.sectionTitle}>Meeting Digest</Text>

      <ToggleRow
        label="Enable meeting digest"
        sub="Get an OKR briefing before each meeting"
        value={enabled}
        onChange={setEnabled}
        last
      />

      {enabled && (
        <>
          <Text style={[styles.subLabel, { marginTop: spacing.md }]}>Lead time</Text>
          <View style={styles.leadTimeGrid}>
            {LEAD_TIME_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.leadTimeChip, leadTime === opt.value && styles.leadTimeChipActive]}
                onPress={() => setLeadTime(opt.value)}
                activeOpacity={0.8}
              >
                <Text style={[styles.leadTimeText, leadTime === opt.value && styles.leadTimeTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <View style={styles.digestBtnRow}>
        <TouchableOpacity
          style={[styles.saveBtn, styles.saveBtnFlex, saveMut.isPending && styles.btnDisabled]}
          onPress={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          activeOpacity={0.85}
        >
          {saveMut.isPending
            ? <ActivityIndicator size="small" color={colors.white} />
            : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.testBtn, testMut.isPending && styles.btnDisabled]}
          onPress={() => testMut.mutate()}
          disabled={testMut.isPending || !enabled}
          activeOpacity={0.85}
        >
          {testMut.isPending
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Text style={styles.testBtnText}>Test</Text>}
        </TouchableOpacity>
      </View>
    </Card>
  )
}

// ─── Export OKRs section ─────────────────────────────────────────────────────
type ExportScope = 'mine' | 'team' | 'department' | 'all'

function ExportOKRsSection({ userRole }: { userRole: string }) {
  const [selectedScope, setSelectedScope] = useState<ExportScope>('mine')
  const [loading, setLoading] = useState(false)

  const canExportAll = userRole === 'admin' || userRole === 'hrbp'

  const SCOPE_OPTIONS: { value: ExportScope; label: string }[] = [
    { value: 'mine',       label: 'Mine' },
    { value: 'team',       label: 'Team' },
    { value: 'department', label: 'Dept' },
    ...(canExportAll ? [{ value: 'all' as ExportScope, label: 'All' }] : []),
  ]

  const handleExport = async () => {
    setLoading(true)
    try {
      const result = await api.exports.exportLink(selectedScope)
      await Linking.openURL(result.url)
    } catch (err: any) {
      Alert.alert('Export failed', err?.message ?? 'Could not generate export link. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card style={styles.cardSpacing}>
      <Text style={styles.sectionTitle}>Export OKRs</Text>
      <Text style={styles.exportSubtitle}>Download your OKRs as a spreadsheet</Text>

      {/* Scope selector */}
      <View style={styles.exportScopeRow}>
        {SCOPE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.exportScopeChip, selectedScope === opt.value && styles.exportScopeChipActive]}
            onPress={() => setSelectedScope(opt.value)}
            activeOpacity={0.8}
          >
            <Text style={[styles.exportScopeText, selectedScope === opt.value && styles.exportScopeTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Export button */}
      <TouchableOpacity
        style={[styles.saveBtn, loading && styles.btnDisabled]}
        onPress={handleExport}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator size="small" color={colors.white} />
          : <Text style={styles.saveBtnText}>Export</Text>}
      </TouchableOpacity>
    </Card>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router = useRouter()

  const { data: me, isLoading, error } = useQuery({
    queryKey: ['me'],
    queryFn: api.auth.me,
  })

  const handleSignOut = async () => {
    await clearToken()
    queryClient.clear()
    router.replace('/(auth)/login')
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  if (error || !me) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to load profile.</Text>
        </View>
      </SafeAreaView>
    )
  }

  const roleStyle = ROLE_STYLES[me.role] ?? ROLE_STYLES.member!
  const initials = getInitials(me.name ?? 'U')
  const authLabel = AUTH_METHOD_LABELS[me.authType] ?? me.authType ?? 'Unknown'

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Verve gradient strip */}
      <View style={styles.brandStrip} pointerEvents="none">
        {(['#0F766E', '#14B8A6', '#2DD4BF'] as const).map((c, i) => (
          <View key={i} style={[styles.brandStripSegment, { backgroundColor: c }]} />
        ))}
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar hero ────────────────────────────────────────────── */}
        <View style={styles.heroCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
          <Text style={styles.heroName}>{me.name}</Text>
          <Text style={styles.heroEmail}>{me.email}</Text>
          <View style={[styles.roleBadge, { backgroundColor: roleStyle.bg }]}>
            <Text style={[styles.roleBadgeText, { color: roleStyle.text }]}>
              {roleStyle.label}
            </Text>
          </View>
        </View>

        {/* ── Account details ─────────────────────────────────────────── */}
        <Card style={styles.cardSpacing}>
          <Text style={styles.sectionTitle}>Account</Text>
          <InfoRow label="Auth method" value={authLabel} />
          {me.department && <InfoRow label="Department" value={me.department} />}
          {me.team && <InfoRow label="Team" value={me.team} />}
          <InfoRow label="Role" value={roleStyle.label} last />
        </Card>

        {/* ── Notifications ───────────────────────────────────────────── */}
        <NotificationsSection />

        {/* ── Meeting Digest ──────────────────────────────────────────── */}
        <MeetingDigestSection />

        {/* ── Export OKRs ─────────────────────────────────────────────── */}
        <ExportOKRsSection userRole={me.role} />

        {/* ── Sign Out ────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          activeOpacity={0.85}
        >
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },

  brandStrip: { flexDirection: 'row', height: 3 },
  brandStripSegment: { flex: 1 },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: {
    color: colors.red,
    fontSize: font.base,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },

  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: font.xl,
    fontWeight: '800',
    color: colors.gray900,
    letterSpacing: -0.5,
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl + spacing.md,
  },
  cardSpacing: { marginBottom: spacing.sm },

  heroCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.xl,
    padding: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.sm,
    ...shadow.md,
  },
  avatarCircle: {
    width: 76,
    height: 76,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.6)',
    ...shadow.lg,
  },
  avatarInitials: {
    fontSize: font.xl,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.5,
  },
  heroName: {
    fontSize: font.lg,
    fontWeight: '800',
    color: colors.gray900,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  heroEmail: {
    fontSize: font.sm,
    color: colors.gray500,
    marginBottom: spacing.md,
  },
  roleBadge: {
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  roleBadgeText: { fontSize: font.sm, fontWeight: '700' },

  sectionTitle: {
    fontSize: font.sm,
    fontWeight: '700',
    color: colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  subLabel: {
    fontSize: font.xs,
    fontWeight: '600',
    color: colors.gray400,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: { fontSize: font.base, color: colors.gray500 },
  infoValue: { fontSize: font.base, fontWeight: '600', color: colors.gray900 },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  toggleRowLeft: { flex: 1, marginRight: spacing.sm },
  toggleLabel: { fontSize: font.base, color: colors.gray900, fontWeight: '500' },
  toggleSub: { fontSize: font.xs, color: colors.gray400, marginTop: 2 },

  segmentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 4,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
  },
  segmentActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segmentText: { fontSize: font.sm, fontWeight: '600', color: colors.gray600 },
  segmentTextActive: { color: colors.white },

  leadTimeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 4,
  },
  leadTimeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
  },
  leadTimeChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  leadTimeText: { fontSize: font.sm, fontWeight: '600', color: colors.gray600 },
  leadTimeTextActive: { color: colors.primary },

  saveBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnFlex: { flex: 1 },
  saveBtnText: { fontSize: font.sm, fontWeight: '700', color: colors.white },
  btnDisabled: { opacity: 0.55 },

  digestBtnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  testBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testBtnText: { fontSize: font.sm, fontWeight: '700', color: colors.primary },

  signOutButton: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.redLight,
    borderWidth: 1.5,
    borderColor: colors.red + '40',
    marginTop: spacing.xs,
  },
  signOutButtonText: {
    fontSize: font.base,
    fontWeight: '700',
    color: colors.red,
  },

  exportSubtitle: {
    fontSize: font.sm,
    color: colors.gray500,
    marginBottom: spacing.md,
  },
  exportScopeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  exportScopeChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportScopeChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  exportScopeText: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.gray600,
  },
  exportScopeTextActive: {
    color: colors.primary,
  },
})
