import React from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
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

  // ── Brand strip ─────────────────────────────────────────────────────────────
  brandStrip: {
    flexDirection: 'row',
    height: 3,
  },
  brandStripSegment: {
    flex: 1,
  },

  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: colors.red,
    fontSize: font.base,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },

  // ── Header ───────────────────────────────────────────────────────────────
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

  // ── Hero card ─────────────────────────────────────────────────────────────
  heroCard: {
    backgroundColor: colors.primaryLight,   // light CDP-blue tint
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
  roleBadgeText: {
    fontSize: font.sm,
    fontWeight: '700',
  },

  // ── Info rows ─────────────────────────────────────────────────────────────
  sectionTitle: {
    fontSize: font.sm,
    fontWeight: '700',
    color: colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontSize: font.base,
    color: colors.gray500,
  },
  infoValue: {
    fontSize: font.base,
    fontWeight: '600',
    color: colors.gray900,
  },

  // ── Sign out ──────────────────────────────────────────────────────────────
  signOutButton: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.redLight,
    borderWidth: 1.5,
    borderColor: colors.red + '40',
  },
  signOutButtonText: {
    fontSize: font.base,
    fontWeight: '700',
    color: colors.red,
  },
})
