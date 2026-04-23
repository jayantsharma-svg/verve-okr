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
import { api } from '@/lib/api'
import { colors, spacing, radius, font, shadow } from '@/lib/theme'
import Card from '@/components/Card'
import ProgressBar from '@/components/ProgressBar'
import ConfidenceBadge from '@/components/ConfidenceBadge'

function calcKrPct(kr: any): number {
  if (kr.targetValue === kr.startValue) return 0
  return ((kr.currentValue - kr.startValue) / (kr.targetValue - kr.startValue)) * 100
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const LEVEL_COLORS: Record<string, { bg: string; text: string }> = {
  company:    { bg: colors.violetLight, text: colors.violet },
  dept:       { bg: colors.primaryLight, text: colors.primary },
  team:       { bg: colors.tealLight, text: colors.teal },
  individual: { bg: colors.gray100, text: colors.gray700 },
}

export default function DashboardScreen() {
  const router = useRouter()

  const { data: me, isLoading: meLoading, error: meError } = useQuery({
    queryKey: ['me'],
    queryFn: api.auth.me,
  })

  const userId = me?.id

  const { data: objectives, isLoading: objLoading, error: objError } = useQuery({
    queryKey: ['objectives', 'mine', userId],
    queryFn: () => api.objectives.list({ ownerId: userId, status: 'active' }),
    enabled: !!userId,
  })

  const isLoading = meLoading || objLoading
  const error = meError || objError

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to load dashboard.</Text>
        </View>
      </SafeAreaView>
    )
  }

  const allKrs = (objectives ?? []).flatMap((o: any) => o.keyResults ?? [])
  const activeObjCount = (objectives ?? []).length
  const activeKrCount = allKrs.length
  const avgPct =
    activeKrCount > 0
      ? allKrs.reduce((sum: number, kr: any) => sum + calcKrPct(kr), 0) / activeKrCount
      : 0

  const atRiskKrs = allKrs
    .filter((kr: any) => kr.confidence === 'at_risk' || kr.confidence === 'off_track')
    .slice(0, 3)

  const topObjectives = (objectives ?? []).slice(0, 3)
  const firstName = me?.name?.split(' ')[0] ?? 'there'

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Capillary signature gradient strip */}
      <View style={styles.brandStrip} pointerEvents="none">
        {(['#2FAA4E', '#1CA68F', '#1E90C7', '#1E6BBF'] as const).map((c, i) => (
          <View key={i} style={[styles.brandStripSegment, { backgroundColor: c }]} />
        ))}
      </View>

      {/* ── Branded header ───────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greetingLabel}>{greeting()} 👋</Text>
          <Text style={styles.greetingName}>{firstName}</Text>
        </View>
        {/* Mini logo mark */}
        <View style={styles.miniMark}>
          <Text style={styles.miniMarkLetter}>V</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Cycle Progress ───────────────────────────────────────────── */}
        <Card style={styles.progressCard} tinted>
          <Text style={styles.cardLabel}>Cycle Progress</Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{activeObjCount}</Text>
              <Text style={styles.statDesc}>Objectives</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{activeKrCount}</Text>
              <Text style={styles.statDesc}>Key Results</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: avgPct >= 70 ? colors.green : avgPct >= 40 ? colors.amber : colors.red }]}>
                {Math.round(avgPct)}%
              </Text>
              <Text style={styles.statDesc}>Avg Progress</Text>
            </View>
          </View>

          <View style={styles.progressRow}>
            <ProgressBar pct={avgPct} height={10} />
            <Text style={styles.progressLabel}>{Math.round(avgPct)}% complete</Text>
          </View>
        </Card>

        {/* ── Needs Attention ──────────────────────────────────────────── */}
        {atRiskKrs.length > 0 && (
          <Card style={styles.cardSpacing}>
            <View style={styles.cardLabelRow}>
              <View style={[styles.labelDot, { backgroundColor: colors.red }]} />
              <Text style={styles.cardLabel}>Needs Attention</Text>
            </View>
            {atRiskKrs.map((kr: any) => {
              const obj = (objectives ?? []).find((o: any) =>
                (o.keyResults ?? []).some((k: any) => k.id === kr.id)
              )
              const isOffTrack = kr.confidence === 'off_track'
              return (
                <View
                  key={kr.id}
                  style={[
                    styles.atRiskRow,
                    { borderLeftColor: isOffTrack ? colors.red : colors.amber },
                  ]}
                >
                  <View style={styles.atRiskContent}>
                    <Text style={styles.atRiskKrTitle} numberOfLines={1}>
                      {kr.title}
                    </Text>
                    {obj && (
                      <Text style={styles.atRiskObjTitle} numberOfLines={1}>
                        {obj.title}
                      </Text>
                    )}
                  </View>
                  <ConfidenceBadge confidence={kr.confidence} />
                </View>
              )
            })}
          </Card>
        )}

        {/* ── My OKRs ──────────────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My OKRs</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/okrs')}>
            <Text style={styles.sectionLink}>See all</Text>
          </TouchableOpacity>
        </View>

        {topObjectives.length === 0 ? (
          <Card>
            <Text style={styles.emptyText}>No active objectives this cycle.</Text>
          </Card>
        ) : (
          topObjectives.map((obj: any) => {
            const krs = obj.keyResults ?? []
            const objPct =
              krs.length > 0
                ? krs.reduce((sum: number, kr: any) => sum + calcKrPct(kr), 0) / krs.length
                : 0
            const levelStyle = LEVEL_COLORS[obj.level] ?? LEVEL_COLORS.individual
            return (
              <TouchableOpacity
                key={obj.id}
                onPress={() => router.push('/(tabs)/okrs')}
                activeOpacity={0.8}
              >
                <Card style={styles.cardSpacing}>
                  <View style={styles.objHeader}>
                    <View style={[styles.levelPill, { backgroundColor: levelStyle.bg }]}>
                      <Text style={[styles.levelPillText, { color: levelStyle.text }]}>
                        {obj.level ?? 'individual'}
                      </Text>
                    </View>
                    <Text style={[styles.objPct, {
                      color: objPct >= 70 ? colors.green : objPct >= 40 ? colors.amber : colors.red
                    }]}>
                      {Math.round(objPct)}%
                    </Text>
                  </View>
                  <Text style={styles.objTitle} numberOfLines={2}>
                    {obj.title}
                  </Text>
                  <ProgressBar pct={objPct} height={6} />
                  <Text style={styles.krCount}>
                    {krs.length} key result{krs.length !== 1 ? 's' : ''}
                  </Text>
                </Card>
              </TouchableOpacity>
            )
          })
        )}

        {/* ── Quick Check-in CTA ───────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.checkinButton}
          onPress={() => router.push('/(tabs)/checkin')}
          activeOpacity={0.85}
        >
          <Text style={styles.checkinIcon}>✓</Text>
          <Text style={styles.checkinButtonText}>Quick Check-in</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  greetingLabel: {
    fontSize: font.sm,
    color: colors.gray500,
    fontWeight: '500',
    marginBottom: 2,
  },
  greetingName: {
    fontSize: font.xxl,
    fontWeight: '800',
    color: colors.gray900,
    letterSpacing: -0.8,
  },
  miniMark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
  },
  miniMarkLetter: {
    fontSize: 20,
    fontWeight: '900',
    fontStyle: 'italic',
    color: colors.white,
    letterSpacing: -1,
  },

  // ── Scroll ───────────────────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl + spacing.md,
  },

  // ── Progress card ─────────────────────────────────────────────────────────
  progressCard: {
    marginBottom: spacing.sm,
  },
  progressRow: {
    marginTop: spacing.sm,
    gap: 6,
  },
  progressLabel: {
    fontSize: font.xs,
    color: colors.gray500,
    fontWeight: '500',
    marginTop: 4,
  },

  // ── Section header ────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontSize: font.base,
    fontWeight: '700',
    color: colors.gray900,
  },
  sectionLink: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.primary,
  },

  // ── Card label ────────────────────────────────────────────────────────────
  cardLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  labelDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  cardLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: spacing.sm,
  },
  cardSpacing: {
    marginBottom: spacing.sm,
  },

  // ── Stats row ─────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: font.xl,
    fontWeight: '800',
    color: colors.gray900,
    letterSpacing: -0.5,
  },
  statDesc: {
    fontSize: font.xs,
    color: colors.gray500,
    marginTop: 2,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.primaryMid,
    opacity: 0.2,
  },

  // ── At-risk ───────────────────────────────────────────────────────────────
  atRiskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 3,
    paddingLeft: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  atRiskContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  atRiskKrTitle: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.gray900,
  },
  atRiskObjTitle: {
    fontSize: font.xs,
    color: colors.gray500,
    marginTop: 2,
  },

  // ── OKR card ──────────────────────────────────────────────────────────────
  objHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  levelPill: {
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  levelPillText: {
    fontSize: font.xs,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  objPct: {
    fontSize: font.base,
    fontWeight: '700',
  },
  objTitle: {
    fontSize: font.base,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: spacing.sm,
    lineHeight: 21,
  },
  krCount: {
    fontSize: font.xs,
    color: colors.gray400,
    marginTop: 6,
    fontWeight: '500',
  },
  emptyText: {
    fontSize: font.base,
    color: colors.gray500,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },

  // ── Check-in CTA ──────────────────────────────────────────────────────────
  checkinButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    ...shadow.md,
  },
  checkinIcon: {
    fontSize: 18,
    color: colors.white,
    fontWeight: '700',
  },
  checkinButtonText: {
    fontSize: font.md,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 0.2,
  },
})
