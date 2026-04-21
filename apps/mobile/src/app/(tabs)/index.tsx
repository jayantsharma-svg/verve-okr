import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { colors, spacing, radius, font } from '@/lib/theme';
import Card from '@/components/Card';
import ProgressBar from '@/components/ProgressBar';
import ConfidenceBadge from '@/components/ConfidenceBadge';

function calcKrPct(kr: any): number {
  if (kr.targetValue === kr.startValue) return 0;
  return ((kr.currentValue - kr.startValue) / (kr.targetValue - kr.startValue)) * 100;
}

const LEVEL_COLORS: Record<string, { bg: string; text: string }> = {
  company: { bg: colors.violetLight, text: colors.violet },
  dept: { bg: colors.blueLight, text: colors.blue },
  team: { bg: colors.tealLight, text: colors.teal },
  individual: { bg: colors.gray100, text: colors.gray700 },
};

export default function DashboardScreen() {
  const router = useRouter();

  const { data: me, isLoading: meLoading, error: meError } = useQuery({
    queryKey: ['me'],
    queryFn: api.auth.me,
  });

  const userId = me?.id;

  const { data: objectives, isLoading: objLoading, error: objError } = useQuery({
    queryKey: ['objectives', 'mine', userId],
    queryFn: () => api.objectives.list({ ownerId: userId, status: 'active' }),
    enabled: !!userId,
  });

  const isLoading = meLoading || objLoading;
  const error = meError || objError;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to load dashboard data.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const allKrs = (objectives ?? []).flatMap((o: any) => o.keyResults ?? []);
  const activeObjCount = (objectives ?? []).length;
  const activeKrCount = allKrs.length;
  const avgPct =
    activeKrCount > 0
      ? allKrs.reduce((sum: number, kr: any) => sum + calcKrPct(kr), 0) / activeKrCount
      : 0;

  const atRiskKrs = allKrs
    .filter((kr: any) => kr.confidence === 'at_risk' || kr.confidence === 'off_track')
    .slice(0, 3);

  const topObjectives = (objectives ?? []).slice(0, 3);

  const firstName = me?.name?.split(' ')[0] ?? 'there';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <Text style={styles.headerSubtitle}>Good morning, {firstName}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Cycle Progress Card */}
        <Card style={styles.cardSpacing}>
          <Text style={styles.sectionLabel}>Cycle Progress</Text>
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
              <Text style={styles.statNumber}>{Math.round(avgPct)}%</Text>
              <Text style={styles.statDesc}>Avg Progress</Text>
            </View>
          </View>
          <View style={styles.progressBarSpacing}>
            <ProgressBar pct={avgPct} />
          </View>
        </Card>

        {/* At-Risk Section */}
        {atRiskKrs.length > 0 && (
          <Card style={styles.cardSpacing}>
            <Text style={styles.sectionLabel}>Needs Attention</Text>
            {atRiskKrs.map((kr: any) => {
              const obj = (objectives ?? []).find((o: any) =>
                (o.keyResults ?? []).some((k: any) => k.id === kr.id)
              );
              const isOffTrack = kr.confidence === 'off_track';
              return (
                <View
                  key={kr.id}
                  style={[
                    styles.atRiskRow,
                    {
                      borderLeftColor: isOffTrack ? colors.red : colors.amber,
                    },
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
              );
            })}
          </Card>
        )}

        {/* My OKRs Summary */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>My OKRs</Text>
        </View>

        {topObjectives.length === 0 ? (
          <Card style={styles.cardSpacing}>
            <Text style={styles.emptyText}>No active objectives found.</Text>
          </Card>
        ) : (
          topObjectives.map((obj: any) => {
            const krs = obj.keyResults ?? [];
            const objPct =
              krs.length > 0
                ? krs.reduce((sum: number, kr: any) => sum + calcKrPct(kr), 0) / krs.length
                : 0;
            const levelStyle = LEVEL_COLORS[obj.level] ?? LEVEL_COLORS.individual;
            return (
              <TouchableOpacity
                key={obj.id}
                onPress={() => router.push('/(tabs)/okrs')}
                activeOpacity={0.8}
              >
                <Card style={styles.cardSpacing}>
                  <View style={styles.objRow}>
                    <View
                      style={[
                        styles.levelPill,
                        { backgroundColor: levelStyle.bg },
                      ]}
                    >
                      <Text style={[styles.levelPillText, { color: levelStyle.text }]}>
                        {obj.level ?? 'individual'}
                      </Text>
                    </View>
                    <Text style={styles.objPct}>{Math.round(objPct)}%</Text>
                  </View>
                  <Text style={styles.objTitle} numberOfLines={2}>
                    {obj.title}
                  </Text>
                  <View style={styles.progressBarSpacing}>
                    <ProgressBar pct={objPct} />
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })
        )}

        {/* Quick Check-in Button */}
        <TouchableOpacity
          style={styles.checkinButton}
          onPress={() => router.push('/(tabs)/checkin')}
          activeOpacity={0.85}
        >
          <Text style={styles.checkinButtonText}>Quick Check-in</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.gray50,
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
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: font.xl,
    fontWeight: 'bold',
    color: colors.gray900,
  },
  headerSubtitle: {
    fontSize: font.sm,
    color: colors.gray500,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl + spacing.sm,
  },
  cardSpacing: {
    marginBottom: spacing.sm,
  },
  sectionHeader: {
    marginBottom: spacing.xs,
  },
  sectionLabel: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.gray700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
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
    fontWeight: 'bold',
    color: colors.gray900,
  },
  statDesc: {
    fontSize: font.sm,
    color: colors.gray500,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.gray200,
  },
  progressBarSpacing: {
    marginTop: spacing.sm,
  },
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
    fontSize: font.base,
    fontWeight: '500',
    color: colors.gray900,
  },
  atRiskObjTitle: {
    fontSize: font.sm,
    color: colors.gray500,
    marginTop: 2,
  },
  objRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  levelPill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  levelPillText: {
    fontSize: font.sm,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  objPct: {
    fontSize: font.base,
    fontWeight: '600',
    color: colors.gray700,
  },
  objTitle: {
    fontSize: font.base,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: font.base,
    color: colors.gray500,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  checkinButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  checkinButtonText: {
    fontSize: font.md,
    fontWeight: '600',
    color: colors.white,
  },
});
