import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { colors, spacing, radius, font } from '@/lib/theme';
import Card from '@/components/Card';

const CYCLE_STEPS = [
  { key: 'self_appraisal', label: 'Self-Appraisal' },
  { key: 'feedback', label: 'Feedback' },
  { key: 'manager_review', label: 'Manager Review' },
  { key: 'complete', label: 'Complete' },
];

const CYCLE_STEP_ORDER: Record<string, number> = {
  self_appraisal: 0,
  feedback: 1,
  manager_review: 2,
  complete: 3,
};

const RATING_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  exceeds: { bg: colors.greenLight, text: colors.green, label: 'Exceeds Expectations' },
  meets: { bg: colors.blueLight, text: colors.blue, label: 'Meets Expectations' },
  partially_meets: { bg: colors.amberLight, text: colors.amber, label: 'Partially Meets' },
  does_not_meet: { bg: colors.redLight, text: colors.red, label: 'Does Not Meet' },
};

const CYCLE_STATUS_LABELS: Record<string, string> = {
  self_appraisal: 'Self-Appraisal',
  feedback: 'Feedback',
  manager_review: 'Manager Review',
  complete: 'Complete',
  draft: 'Draft',
};

interface ProgressStepsProps {
  currentStatus: string;
}

function ProgressSteps({ currentStatus }: ProgressStepsProps) {
  const currentIdx = CYCLE_STEP_ORDER[currentStatus] ?? -1;

  return (
    <View style={styles.stepsRow}>
      {CYCLE_STEPS.map((step, i) => {
        const isDone = i < currentIdx;
        const isCurrent = i === currentIdx;
        const isFuture = i > currentIdx;

        return (
          <React.Fragment key={step.key}>
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepCircle,
                  isDone && styles.stepCircleDone,
                  isCurrent && styles.stepCircleCurrent,
                  isFuture && styles.stepCircleFuture,
                ]}
              >
                {isDone ? (
                  <Text style={styles.stepCircleCheckmark}>✓</Text>
                ) : (
                  <Text
                    style={[
                      styles.stepCircleNumber,
                      isCurrent && styles.stepCircleNumberCurrent,
                    ]}
                  >
                    {i + 1}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  isCurrent && styles.stepLabelCurrent,
                  isDone && styles.stepLabelDone,
                ]}
                numberOfLines={2}
              >
                {step.label}
              </Text>
            </View>
            {i < CYCLE_STEPS.length - 1 && (
              <View
                style={[
                  styles.stepConnector,
                  isDone ? styles.stepConnectorFilled : styles.stepConnectorEmpty,
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const MANAGER_ROLES = new Set(['admin', 'dept_lead', 'team_lead']);

export default function AppraisalsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selfText, setSelfText] = useState('');

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: api.auth.me,
  });

  const isManager = me?.role ? MANAGER_ROLES.has(me.role) : false;

  const { data, isLoading, error } = useQuery({
    queryKey: ['appraisal-my'],
    queryFn: api.appraisals.myRecord,
  });

  const { data: teamRecords, isLoading: teamLoading } = useQuery({
    queryKey: ['appraisals-team'],
    queryFn: api.appraisals.teamRecords,
    enabled: isManager,
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      api.appraisals.submitSelf({ selfAppraisalText: selfText, okrComments: [] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appraisal-my'] });
    },
  });

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
          <Text style={styles.errorText}>Failed to load appraisal data.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const hasActiveCycle = data && data.cycleStatus && data.cycleStatus !== 'draft';
  const isSubmitted = !!data?.selfSubmittedAt;
  const showSelfAppraisal =
    hasActiveCycle &&
    (data?.cycleStatus === 'self_appraisal' || isSubmitted);
  const showManagerRating = hasActiveCycle && !!data?.managerRating;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Appraisals</Text>
        <Text style={styles.headerSubtitle}>Performance review cycle</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {!hasActiveCycle ? (
            <Card style={styles.cardSpacing}>
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>📋</Text>
                <Text style={styles.emptyStateTitle}>No active appraisal cycle</Text>
                <Text style={styles.emptyStateDesc}>
                  There is no active performance review cycle at this time. Check back
                  later or contact your HR team.
                </Text>
              </View>
            </Card>
          ) : (
            <>
              {/* Status Card */}
              <Card style={styles.cardSpacing}>
                <View style={styles.statusHeader}>
                  <Text style={styles.sectionLabel}>Current Status</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>
                      {CYCLE_STATUS_LABELS[data?.cycleStatus ?? ''] ?? data?.cycleStatus}
                    </Text>
                  </View>
                </View>
                <ProgressSteps currentStatus={data?.cycleStatus ?? ''} />
              </Card>

              {/* Self-Appraisal Section */}
              {showSelfAppraisal && (
                <Card style={styles.cardSpacing}>
                  <Text style={styles.sectionLabel}>Self-Appraisal</Text>

                  {isSubmitted ? (
                    <View style={styles.submittedRow}>
                      <View style={styles.submittedCheckCircle}>
                        <Text style={styles.submittedCheck}>✓</Text>
                      </View>
                      <View style={styles.submittedInfo}>
                        <Text style={styles.submittedTitle}>Submitted</Text>
                        <Text style={styles.submittedDate}>
                          {new Date(data.selfSubmittedAt!).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.inputLabel}>
                        Describe your performance this cycle
                      </Text>
                      <TextInput
                        style={[styles.textInput, styles.textInputLarge]}
                        value={selfText}
                        onChangeText={setSelfText}
                        multiline
                        numberOfLines={6}
                        placeholder="Share your accomplishments, challenges, and learnings..."
                        placeholderTextColor={colors.gray400}
                        textAlignVertical="top"
                      />

                      {submitMutation.isError && (
                        <Text style={styles.errorText}>
                          Failed to submit. Please try again.
                        </Text>
                      )}

                      {submitMutation.isSuccess && (
                        <Text style={styles.successText}>
                          Self-appraisal submitted successfully.
                        </Text>
                      )}

                      <TouchableOpacity
                        style={[
                          styles.submitButton,
                          (!selfText.trim() || submitMutation.isPending) &&
                            styles.submitButtonDisabled,
                        ]}
                        onPress={() => submitMutation.mutate()}
                        disabled={!selfText.trim() || submitMutation.isPending}
                        activeOpacity={0.85}
                      >
                        {submitMutation.isPending ? (
                          <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                          <Text style={styles.submitButtonText}>Submit Self-Appraisal</Text>
                        )}
                      </TouchableOpacity>
                    </>
                  )}
                </Card>
              )}

              {/* Feedback Requests */}
              {hasActiveCycle &&
                data?.feedbackRequests &&
                data.feedbackRequests.length > 0 && (
                  <Card style={styles.cardSpacing}>
                    <Text style={styles.sectionLabel}>Feedback Requests</Text>
                    {data.feedbackRequests.map((req: any, idx: number) => (
                      <View key={idx} style={styles.feedbackRow}>
                        <View style={styles.feedbackAvatar}>
                          <Text style={styles.feedbackAvatarText}>
                            {req.reviewerName?.charAt(0)?.toUpperCase() ?? '?'}
                          </Text>
                        </View>
                        <View style={styles.feedbackInfo}>
                          <Text style={styles.feedbackName}>{req.reviewerName}</Text>
                          <Text style={styles.feedbackStatus}>
                            {req.status === 'submitted' ? 'Submitted' : 'Pending'}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.feedbackStatusDot,
                            {
                              backgroundColor:
                                req.status === 'submitted'
                                  ? colors.green
                                  : colors.amber,
                            },
                          ]}
                        />
                      </View>
                    ))}
                  </Card>
                )}

              {/* Manager Rating Card */}
              {showManagerRating && (
                <Card style={styles.cardSpacing}>
                  <Text style={styles.sectionLabel}>Manager Rating</Text>
                  {(() => {
                    const ratingStyle =
                      RATING_STYLES[data.managerRating!] ?? RATING_STYLES.meets;
                    return (
                      <>
                        <View
                          style={[
                            styles.ratingBadge,
                            { backgroundColor: ratingStyle.bg },
                          ]}
                        >
                          <Text
                            style={[styles.ratingBadgeText, { color: ratingStyle.text }]}
                          >
                            {ratingStyle.label}
                          </Text>
                        </View>
                        {data.managerComments && (
                          <View style={styles.commentsSection}>
                            <Text style={styles.commentsLabel}>Manager Comments</Text>
                            <Text style={styles.commentsText}>
                              {data.managerComments}
                            </Text>
                          </View>
                        )}
                      </>
                    );
                  })()}
                </Card>
              )}
            </>
          )}

          {/* Team section — visible to managers */}
          {isManager && (
            <>
              <View style={styles.teamSectionHeader}>
                <Text style={styles.teamSectionTitle}>My Team</Text>
                {teamLoading && (
                  <ActivityIndicator size="small" color={colors.primary} />
                )}
              </View>

              {!teamLoading && (teamRecords ?? []).length === 0 ? (
                <Card style={styles.cardSpacing}>
                  <Text style={styles.emptyTeamText}>
                    No team appraisal records found.
                  </Text>
                </Card>
              ) : (
                (teamRecords ?? []).map((record: any) => {
                  const emp = record.employee;
                  const isFinalized = !!record.managerFinalizedAt;
                  const needsReview =
                    record.cycleStatus === 'manager_review' && !isFinalized;
                  return (
                    <TouchableOpacity
                      key={record.id}
                      onPress={() => router.push(`/appraisals/${record.id}`)}
                      activeOpacity={0.85}
                    >
                      <Card style={styles.cardSpacing}>
                        <View style={styles.teamRow}>
                          <View style={styles.teamAvatar}>
                            <Text style={styles.teamAvatarText}>
                              {emp?.name?.charAt(0)?.toUpperCase() ?? '?'}
                            </Text>
                          </View>
                          <View style={styles.teamInfo}>
                            <Text style={styles.teamName}>
                              {emp?.name ?? 'Unknown'}
                            </Text>
                            <Text style={styles.teamMeta}>
                              {[emp?.department, emp?.team]
                                .filter(Boolean)
                                .join(' · ')}
                            </Text>
                          </View>
                          <View style={styles.teamRight}>
                            {needsReview ? (
                              <View style={styles.reviewBadge}>
                                <Text style={styles.reviewBadgeText}>
                                  Review
                                </Text>
                              </View>
                            ) : isFinalized ? (
                              <View style={styles.doneBadge}>
                                <Text style={styles.doneBadgeText}>Done</Text>
                              </View>
                            ) : null}
                            <Ionicons
                              name="chevron-forward"
                              size={16}
                              color={colors.gray400}
                            />
                          </View>
                        </View>
                      </Card>
                    </TouchableOpacity>
                  );
                })
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  flex: {
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
    marginBottom: spacing.sm,
  },
  successText: {
    color: colors.green,
    fontSize: font.base,
    marginBottom: spacing.sm,
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
  sectionLabel: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.gray700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  emptyStateIcon: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  emptyStateTitle: {
    fontSize: font.lg,
    fontWeight: '600',
    color: colors.gray700,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptyStateDesc: {
    fontSize: font.base,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 22,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  statusBadge: {
    backgroundColor: colors.blueLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  statusBadgeText: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.blue,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  stepCircleDone: {
    backgroundColor: colors.primary,
  },
  stepCircleCurrent: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  stepCircleFuture: {
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  stepCircleCheckmark: {
    color: colors.white,
    fontSize: font.sm,
    fontWeight: '700',
  },
  stepCircleNumber: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.gray400,
  },
  stepCircleNumberCurrent: {
    color: colors.primary,
  },
  stepConnector: {
    height: 2,
    flex: 1,
    marginTop: 13,
    marginHorizontal: -spacing.xs,
  },
  stepConnectorFilled: {
    backgroundColor: colors.primary,
  },
  stepConnectorEmpty: {
    backgroundColor: colors.gray200,
  },
  stepLabel: {
    fontSize: 10,
    color: colors.gray400,
    textAlign: 'center',
    lineHeight: 14,
  },
  stepLabelCurrent: {
    color: colors.primary,
    fontWeight: '600',
  },
  stepLabelDone: {
    color: colors.gray700,
  },
  submittedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  submittedCheckCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submittedCheck: {
    fontSize: font.lg,
    color: colors.green,
    fontWeight: '700',
  },
  submittedInfo: {
    flex: 1,
  },
  submittedTitle: {
    fontSize: font.base,
    fontWeight: '700',
    color: colors.green,
  },
  submittedDate: {
    fontSize: font.sm,
    color: colors.gray500,
    marginTop: 2,
  },
  inputLabel: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.gray700,
    marginBottom: spacing.xs,
  },
  textInput: {
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: font.base,
    color: colors.gray900,
    marginBottom: spacing.md,
  },
  textInputLarge: {
    height: 140,
    paddingTop: spacing.sm,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: font.base,
    fontWeight: '600',
    color: colors.white,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
    gap: spacing.sm,
  },
  feedbackAvatar: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackAvatarText: {
    fontSize: font.base,
    fontWeight: '700',
    color: colors.blue,
  },
  feedbackInfo: {
    flex: 1,
  },
  feedbackName: {
    fontSize: font.base,
    fontWeight: '500',
    color: colors.gray900,
  },
  feedbackStatus: {
    fontSize: font.sm,
    color: colors.gray500,
  },
  feedbackStatusDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  ratingBadge: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  ratingBadgeText: {
    fontSize: font.base,
    fontWeight: '700',
  },
  commentsSection: {
    marginTop: spacing.xs,
  },
  commentsLabel: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.gray500,
    marginBottom: spacing.xs,
  },
  commentsText: {
    fontSize: font.base,
    color: colors.gray700,
    lineHeight: 22,
  },
  // Team section
  teamSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  teamSectionTitle: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.gray700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyTeamText: {
    fontSize: font.base,
    color: colors.gray500,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  teamAvatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.violetLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamAvatarText: {
    fontSize: font.base,
    fontWeight: '700',
    color: colors.violet,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: font.base,
    fontWeight: '600',
    color: colors.gray900,
  },
  teamMeta: {
    fontSize: font.sm,
    color: colors.gray500,
    marginTop: 1,
  },
  teamRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  reviewBadge: {
    backgroundColor: colors.amberLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  reviewBadgeText: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.amber,
  },
  doneBadge: {
    backgroundColor: colors.greenLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  doneBadgeText: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.green,
  },
});
