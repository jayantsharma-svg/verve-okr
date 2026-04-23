import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { colors, spacing, radius, font } from '@/lib/theme';
import Card from '@/components/Card';

const RATING_OPTIONS = [
  { value: 'exceeds', label: 'Exceeds Expectations' },
  { value: 'meets', label: 'Meets Expectations' },
  { value: 'partially_meets', label: 'Partially Meets' },
  { value: 'does_not_meet', label: 'Does Not Meet' },
];

const RATING_STYLES: Record<string, { bg: string; text: string }> = {
  exceeds: { bg: colors.greenLight, text: colors.green },
  meets: { bg: colors.blueLight, text: colors.blue },
  partially_meets: { bg: colors.amberLight, text: colors.amber },
  does_not_meet: { bg: colors.redLight, text: colors.red },
};

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

function ProgressSteps({ currentStatus }: { currentStatus: string }) {
  const currentIdx = CYCLE_STEP_ORDER[currentStatus] ?? -1;

  return (
    <View style={styles.stepsRow}>
      {CYCLE_STEPS.map((step, i) => {
        const isDone = i < currentIdx;
        const isCurrent = i === currentIdx;

        return (
          <React.Fragment key={step.key}>
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepCircle,
                  isDone && styles.stepCircleDone,
                  isCurrent && styles.stepCircleCurrent,
                  !isDone && !isCurrent && styles.stepCircleFuture,
                ]}
              >
                {isDone ? (
                  <Text style={styles.stepCheckmark}>✓</Text>
                ) : (
                  <Text
                    style={[
                      styles.stepNumber,
                      isCurrent && styles.stepNumberCurrent,
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

export default function AppraisalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [rating, setRating] = useState('');
  const [comments, setComments] = useState('');

  // Fetch team records and find the one matching this id
  const { data: teamRecords, isLoading, error } = useQuery({
    queryKey: ['appraisals-team'],
    queryFn: api.appraisals.teamRecords,
  });

  const record = (teamRecords ?? []).find((r: any) => r.id === id);

  const finalizeMutation = useMutation({
    mutationFn: () =>
      api.appraisals.finalize(id, {
        managerRating: rating,
        managerComments: comments,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appraisals-team'] });
      router.back();
    },
  });

  const NavBar = (
    <View style={styles.navBar}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.backButton}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={22} color={colors.gray900} />
      </TouchableOpacity>
      <Text style={styles.navTitle} numberOfLines={1}>
        {record ? (record as any).employee?.name ?? 'Appraisal' : 'Appraisal'}
      </Text>
      <View style={styles.navSpacer} />
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {NavBar}
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !record) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {NavBar}
        <View style={styles.centered}>
          <Text style={styles.errorText}>Appraisal record not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const employee = (record as any).employee;
  const cycleStatus = (record as any).cycleStatus ?? '';
  const isAlreadyFinalized = !!(record as any).managerFinalizedAt;
  const canFinalize =
    cycleStatus === 'manager_review' && !isAlreadyFinalized;
  const existingRating = (record as any).managerRating;
  const existingComments = (record as any).managerComments;
  const feedbackRequests = (record as any).feedbackRequests ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {NavBar}
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
          {/* Employee info */}
          {employee && (
            <Card style={styles.cardSpacing}>
              <View style={styles.employeeRow}>
                <View style={styles.employeeAvatar}>
                  <Text style={styles.employeeAvatarText}>
                    {employee.name?.charAt(0)?.toUpperCase() ?? '?'}
                  </Text>
                </View>
                <View style={styles.employeeInfo}>
                  <Text style={styles.employeeName}>{employee.name}</Text>
                  <Text style={styles.employeeMeta}>
                    {[employee.department, employee.team]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  <Text style={styles.employeeEmail}>{employee.email}</Text>
                </View>
              </View>
            </Card>
          )}

          {/* Cycle progress */}
          {cycleStatus && cycleStatus !== 'draft' && (
            <Card style={styles.cardSpacing}>
              <Text style={styles.sectionLabel}>Cycle Progress</Text>
              <ProgressSteps currentStatus={cycleStatus} />
            </Card>
          )}

          {/* Self-appraisal */}
          {(record as any).selfAppraisalText && (
            <Card style={styles.cardSpacing}>
              <Text style={styles.sectionLabel}>Self-Appraisal</Text>
              {(record as any).selfSubmittedAt && (
                <Text style={styles.submittedDate}>
                  Submitted{' '}
                  {new Date(
                    (record as any).selfSubmittedAt,
                  ).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
              )}
              <Text style={styles.selfAppraisalText}>
                {(record as any).selfAppraisalText}
              </Text>
            </Card>
          )}

          {/* OKR achievement */}
          {(record as any).overallOkrAchievementPct != null && (
            <Card style={styles.cardSpacing}>
              <Text style={styles.sectionLabel}>OKR Achievement</Text>
              <Text style={styles.achievementPct}>
                {Math.round((record as any).overallOkrAchievementPct)}%
              </Text>
            </Card>
          )}

          {/* Feedback requests */}
          {feedbackRequests.length > 0 && (
            <Card style={styles.cardSpacing}>
              <Text style={styles.sectionLabel}>
                Feedback ({feedbackRequests.length})
              </Text>
              {feedbackRequests.map((req: any, idx: number) => (
                <View key={idx} style={styles.feedbackRow}>
                  <View style={styles.feedbackAvatar}>
                    <Text style={styles.feedbackAvatarText}>
                      {req.reviewerName?.charAt(0)?.toUpperCase() ?? '?'}
                    </Text>
                  </View>
                  <View style={styles.feedbackInfo}>
                    <Text style={styles.feedbackName}>{req.reviewerName}</Text>
                    {req.feedbackText ? (
                      <Text style={styles.feedbackText} numberOfLines={3}>
                        {req.feedbackText}
                      </Text>
                    ) : (
                      <Text style={styles.feedbackPending}>Pending</Text>
                    )}
                  </View>
                  <View
                    style={[
                      styles.feedbackDot,
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

          {/* Manager rating — read-only if already finalized */}
          {isAlreadyFinalized && existingRating ? (
            <Card style={styles.cardSpacing}>
              <Text style={styles.sectionLabel}>Manager Rating</Text>
              <View
                style={[
                  styles.ratingBadge,
                  { backgroundColor: RATING_STYLES[existingRating]?.bg ?? colors.gray100 },
                ]}
              >
                <Text
                  style={[
                    styles.ratingBadgeText,
                    { color: RATING_STYLES[existingRating]?.text ?? colors.gray700 },
                  ]}
                >
                  {RATING_OPTIONS.find((r) => r.value === existingRating)?.label ??
                    existingRating}
                </Text>
              </View>
              {existingComments ? (
                <View style={styles.commentsSection}>
                  <Text style={styles.commentsLabel}>Manager Comments</Text>
                  <Text style={styles.commentsText}>{existingComments}</Text>
                </View>
              ) : null}
              <Text style={styles.finalizedDate}>
                Finalized{' '}
                {new Date(
                  (record as any).managerFinalizedAt,
                ).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </Card>
          ) : canFinalize ? (
            <Card style={styles.cardSpacing}>
              <Text style={styles.sectionLabel}>Manager Review</Text>

              <Text style={styles.inputLabel}>Rating</Text>
              <View style={styles.ratingOptions}>
                {RATING_OPTIONS.map((opt) => {
                  const selected = rating === opt.value;
                  const s = RATING_STYLES[opt.value];
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.ratingOption,
                        selected && {
                          backgroundColor: s.bg,
                          borderColor: s.text,
                        },
                      ]}
                      onPress={() => setRating(opt.value)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.ratingOptionText,
                          selected && { color: s.text, fontWeight: '700' },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>Comments (optional)</Text>
              <TextInput
                style={[styles.textInput, styles.textInputLarge]}
                value={comments}
                onChangeText={setComments}
                multiline
                numberOfLines={5}
                placeholder="Share your assessment of this employee's performance..."
                placeholderTextColor={colors.gray400}
                textAlignVertical="top"
              />

              {finalizeMutation.isError && (
                <Text style={styles.errorText}>
                  Failed to submit. Please try again.
                </Text>
              )}

              <TouchableOpacity
                style={[
                  styles.finalizeButton,
                  (!rating || finalizeMutation.isPending) &&
                    styles.finalizeButtonDisabled,
                ]}
                onPress={() => finalizeMutation.mutate()}
                disabled={!rating || finalizeMutation.isPending}
                activeOpacity={0.85}
              >
                {finalizeMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.finalizeButtonText}>
                    Finalize Appraisal
                  </Text>
                )}
              </TouchableOpacity>
            </Card>
          ) : null}
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
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  backButton: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  navTitle: {
    flex: 1,
    fontSize: font.md,
    fontWeight: '700',
    color: colors.gray900,
  },
  navSpacer: {
    width: 30,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl + spacing.sm,
  },
  cardSpacing: {
    marginBottom: spacing.sm,
  },
  errorText: {
    color: colors.red,
    fontSize: font.base,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
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
  // Employee info
  employeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  employeeAvatar: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  employeeAvatarText: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.blue,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: font.md,
    fontWeight: '700',
    color: colors.gray900,
  },
  employeeMeta: {
    fontSize: font.sm,
    color: colors.gray500,
    marginTop: 2,
  },
  employeeEmail: {
    fontSize: font.sm,
    color: colors.gray500,
    marginTop: 2,
  },
  // Progress steps (reused from appraisals.tsx)
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
  stepCheckmark: {
    color: colors.white,
    fontSize: font.sm,
    fontWeight: '700',
  },
  stepNumber: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.gray400,
  },
  stepNumberCurrent: {
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
  // Self-appraisal
  submittedDate: {
    fontSize: font.sm,
    color: colors.gray500,
    marginBottom: spacing.sm,
  },
  selfAppraisalText: {
    fontSize: font.base,
    color: colors.gray700,
    lineHeight: 22,
  },
  // OKR achievement
  achievementPct: {
    fontSize: 40,
    fontWeight: 'bold',
    color: colors.primary,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  // Feedback
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    fontWeight: '600',
    color: colors.gray900,
  },
  feedbackText: {
    fontSize: font.sm,
    color: colors.gray500,
    marginTop: 2,
    lineHeight: 18,
  },
  feedbackPending: {
    fontSize: font.sm,
    color: colors.amber,
    marginTop: 2,
  },
  feedbackDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    marginTop: 6,
  },
  // Manager rating (read-only)
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
  finalizedDate: {
    fontSize: font.sm,
    color: colors.gray400,
    marginTop: spacing.sm,
  },
  // Manager review form
  inputLabel: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.gray700,
    marginBottom: spacing.xs,
  },
  ratingOptions: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  ratingOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
  },
  ratingOptionText: {
    fontSize: font.base,
    color: colors.gray700,
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
    height: 120,
    paddingTop: spacing.sm,
  },
  finalizeButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  finalizeButtonDisabled: {
    opacity: 0.5,
  },
  finalizeButtonText: {
    fontSize: font.base,
    fontWeight: '600',
    color: colors.white,
  },
});
