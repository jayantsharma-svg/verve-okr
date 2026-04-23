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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { colors, spacing, radius, font } from '@/lib/theme';
import Card from '@/components/Card';
import ProgressBar from '@/components/ProgressBar';

type Step = 1 | 2 | 3;

function calcKrPct(kr: any): number {
  if (kr.targetValue === kr.startValue) return 0;
  return ((kr.currentValue - kr.startValue) / (kr.targetValue - kr.startValue)) * 100;
}

function formatValue(kr: any): string {
  const val = kr.currentValue;
  switch (kr.metricType) {
    case 'percentage':
      return `${val}%`;
    case 'currency':
      return `$${val}`;
    case 'binary':
      return val === 1 ? 'Done' : 'Not done';
    case 'number':
    default:
      return `${val}${kr.unit ? ' ' + kr.unit : ''}`;
  }
}

const CONFIDENCE_OPTIONS = [
  { value: 'on_track', label: 'On Track' },
  { value: 'at_risk', label: 'At Risk' },
  { value: 'off_track', label: 'Off Track' },
];

interface StepIndicatorProps {
  current: Step;
}

function StepIndicator({ current }: StepIndicatorProps) {
  return (
    <View style={styles.stepIndicator}>
      {([1, 2, 3] as Step[]).map((s, i) => (
        <React.Fragment key={s}>
          <View
            style={[
              styles.stepDot,
              current >= s ? styles.stepDotFilled : styles.stepDotEmpty,
            ]}
          />
          {i < 2 && (
            <View
              style={[
                styles.stepLine,
                current > s ? styles.stepLineFilled : styles.stepLineEmpty,
              ]}
            />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

export default function CheckInScreen() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>(1);
  const [selectedObjective, setSelectedObjective] = useState<any>(null);
  const [selectedKr, setSelectedKr] = useState<any>(null);
  const [newValue, setNewValue] = useState('');
  const [confidence, setConfidence] = useState('on_track');
  const [note, setNote] = useState('');
  const [success, setSuccess] = useState(false);

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: api.auth.me,
  });

  const userId = me?.id;

  const { data: objectives, isLoading, error } = useQuery({
    queryKey: ['objectives', 'mine', userId],
    queryFn: () => api.objectives.list({ ownerId: userId, status: 'active' }),
    enabled: !!userId,
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.keyResults.checkin(selectedKr.id, {
        newValue: Number(newValue),
        confidence,
        note,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      setSuccess(true);
    },
  });

  const resetAll = () => {
    setStep(1);
    setSelectedObjective(null);
    setSelectedKr(null);
    setNewValue('');
    setConfidence('on_track');
    setNote('');
    setSuccess(false);
    mutation.reset();
  };

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
          <Text style={styles.errorText}>Failed to load objectives.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Capillary signature gradient strip */}
      <View style={styles.brandStrip} pointerEvents="none">
        {(['#2FAA4E', '#1CA68F', '#1E90C7', '#1E6BBF'] as const).map((c, i) => (
          <View key={i} style={[styles.brandStripSegment, { backgroundColor: c }]} />
        ))}
      </View>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Check-in</Text>
        <Text style={styles.headerSubtitle}>
          {step === 1 && 'Select an objective'}
          {step === 2 && 'Select a key result'}
          {step === 3 && 'Enter your update'}
        </Text>
      </View>

      <StepIndicator current={step} />

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
          {/* STEP 1 — Pick Objective */}
          {step === 1 && (
            <>
              {(objectives ?? []).length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateTitle}>No active objectives</Text>
                  <Text style={styles.emptyStateDesc}>
                    You have no active objectives to check in on.
                  </Text>
                </View>
              ) : (
                (objectives ?? []).map((obj: any) => {
                  const isSelected = selectedObjective?.id === obj.id;
                  return (
                    <TouchableOpacity
                      key={obj.id}
                      onPress={() => setSelectedObjective(obj)}
                      activeOpacity={0.85}
                    >
                      <Card
                        style={[
                          styles.selectableCard,
                          isSelected && styles.selectableCardActive,
                        ]}
                      >
                        <Text style={styles.objTitle} numberOfLines={2}>
                          {obj.title}
                        </Text>
                        <Text style={styles.objMeta}>
                          {(obj.keyResults ?? []).length} key result
                          {(obj.keyResults ?? []).length !== 1 ? 's' : ''}
                        </Text>
                      </Card>
                    </TouchableOpacity>
                  );
                })
              )}
            </>
          )}

          {/* STEP 2 — Pick KR */}
          {step === 2 && selectedObjective && (
            <>
              <Card style={styles.selectedObjCard}>
                <Text style={styles.selectedObjLabel}>Objective</Text>
                <Text style={styles.selectedObjTitle}>{selectedObjective.title}</Text>
              </Card>

              {(selectedObjective.keyResults ?? []).length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateTitle}>No key results</Text>
                  <Text style={styles.emptyStateDesc}>
                    This objective has no key results yet.
                  </Text>
                </View>
              ) : (
                (selectedObjective.keyResults ?? []).map((kr: any) => {
                  const isSelected = selectedKr?.id === kr.id;
                  const pct = calcKrPct(kr);
                  return (
                    <TouchableOpacity
                      key={kr.id}
                      onPress={() => setSelectedKr(kr)}
                      activeOpacity={0.85}
                    >
                      <Card
                        style={[
                          styles.selectableCard,
                          isSelected && styles.selectableCardActive,
                        ]}
                      >
                        <Text style={styles.krTitle} numberOfLines={2}>
                          {kr.title}
                        </Text>
                        <Text style={styles.krCurrentValue}>
                          Current: {formatValue(kr)}
                        </Text>
                        <View style={styles.krProgressRow}>
                          <View style={styles.krProgressFill}>
                            <ProgressBar pct={pct} />
                          </View>
                          <Text style={styles.krPct}>{Math.round(pct)}%</Text>
                        </View>
                      </Card>
                    </TouchableOpacity>
                  );
                })
              )}
            </>
          )}

          {/* STEP 3 — Enter Update */}
          {step === 3 && selectedKr && (
            <>
              {success ? (
                <Card style={styles.successCard}>
                  <Text style={styles.successIcon}>✓</Text>
                  <Text style={styles.successTitle}>Check-in recorded!</Text>
                  <Text style={styles.successDesc}>
                    {selectedKr.title} has been updated.
                  </Text>
                  <TouchableOpacity
                    style={styles.checkInAnotherButton}
                    onPress={resetAll}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.checkInAnotherText}>Check in another</Text>
                  </TouchableOpacity>
                </Card>
              ) : (
                <>
                  <Card style={styles.selectedObjCard}>
                    <Text style={styles.selectedObjLabel}>Key Result</Text>
                    <Text style={styles.selectedObjTitle}>{selectedKr.title}</Text>
                    <Text style={styles.krCurrentValue}>
                      Current value: {formatValue(selectedKr)}
                    </Text>
                  </Card>

                  <Card style={styles.formCard}>
                    <Text style={styles.inputLabel}>New Value</Text>
                    <TextInput
                      style={styles.textInput}
                      value={newValue}
                      onChangeText={setNewValue}
                      keyboardType="numeric"
                      placeholder="Enter new value"
                      placeholderTextColor={colors.gray400}
                    />

                    <Text style={styles.inputLabel}>Confidence</Text>
                    <View style={styles.confidenceRow}>
                      {CONFIDENCE_OPTIONS.map((opt) => (
                        <TouchableOpacity
                          key={opt.value}
                          style={[
                            styles.confidencePill,
                            confidence === opt.value && styles.confidencePillSelected,
                          ]}
                          onPress={() => setConfidence(opt.value)}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.confidencePillText,
                              confidence === opt.value &&
                                styles.confidencePillTextSelected,
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.inputLabel}>Note (optional)</Text>
                    <TextInput
                      style={[styles.textInput, styles.textInputMultiline]}
                      value={note}
                      onChangeText={setNote}
                      multiline
                      numberOfLines={3}
                      placeholder="Add a note..."
                      placeholderTextColor={colors.gray400}
                      textAlignVertical="top"
                    />

                    {mutation.isError && (
                      <Text style={styles.errorText}>
                        Failed to submit. Please try again.
                      </Text>
                    )}
                  </Card>
                </>
              )}
            </>
          )}
        </ScrollView>

        {/* Bottom navigation buttons */}
        {!success && (
          <View style={styles.bottomBar}>
            {step > 1 && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setStep((prev) => (prev - 1) as Step)}
                activeOpacity={0.8}
              >
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            )}

            {step < 3 && (
              <TouchableOpacity
                style={[
                  styles.nextButton,
                  (step === 1 && !selectedObjective) ||
                  (step === 2 && !selectedKr)
                    ? styles.nextButtonDisabled
                    : null,
                ]}
                onPress={() => setStep((prev) => (prev + 1) as Step)}
                disabled={
                  (step === 1 && !selectedObjective) ||
                  (step === 2 && !selectedKr)
                }
                activeOpacity={0.85}
              >
                <Text style={styles.nextButtonText}>Next</Text>
              </TouchableOpacity>
            )}

            {step === 3 && !success && (
              <TouchableOpacity
                style={[
                  styles.nextButton,
                  (!newValue || mutation.isPending) && styles.nextButtonDisabled,
                ]}
                onPress={() => mutation.mutate()}
                disabled={!newValue || mutation.isPending}
                activeOpacity={0.85}
              >
                {mutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.nextButtonText}>Submit Check-in</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
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
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: radius.full,
  },
  stepDotFilled: {
    backgroundColor: colors.primary,
  },
  stepDotEmpty: {
    backgroundColor: colors.gray200,
    borderWidth: 1,
    borderColor: colors.gray400,
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginHorizontal: spacing.xs,
  },
  stepLineFilled: {
    backgroundColor: colors.primary,
  },
  stepLineEmpty: {
    backgroundColor: colors.gray200,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  selectableCard: {
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectableCardActive: {
    borderColor: colors.primary,
  },
  objTitle: {
    fontSize: font.base,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: spacing.xs,
  },
  objMeta: {
    fontSize: font.sm,
    color: colors.gray500,
  },
  selectedObjCard: {
    marginBottom: spacing.sm,
    backgroundColor: colors.gray50,
  },
  selectedObjLabel: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  selectedObjTitle: {
    fontSize: font.base,
    fontWeight: '600',
    color: colors.gray900,
  },
  krTitle: {
    fontSize: font.base,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: spacing.xs,
  },
  krCurrentValue: {
    fontSize: font.sm,
    color: colors.gray500,
    marginTop: spacing.xs,
  },
  krProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  krProgressFill: {
    flex: 1,
  },
  krPct: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.gray700,
    minWidth: 36,
    textAlign: 'right',
  },
  formCard: {
    marginBottom: spacing.sm,
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
  textInputMultiline: {
    height: 80,
    paddingTop: spacing.sm,
  },
  confidenceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  confidencePill: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  confidencePillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  confidencePillText: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.gray700,
  },
  confidencePillTextSelected: {
    color: colors.white,
  },
  successCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.greenLight,
  },
  successIcon: {
    fontSize: 40,
    color: colors.green,
    marginBottom: spacing.sm,
  },
  successTitle: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.green,
    marginBottom: spacing.xs,
  },
  successDesc: {
    fontSize: font.base,
    color: colors.gray700,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  checkInAnotherButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.green,
  },
  checkInAnotherText: {
    fontSize: font.base,
    fontWeight: '600',
    color: colors.green,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: spacing.xl * 2,
  },
  emptyStateTitle: {
    fontSize: font.lg,
    fontWeight: '600',
    color: colors.gray700,
    marginBottom: spacing.xs,
  },
  emptyStateDesc: {
    fontSize: font.base,
    color: colors.gray500,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    backgroundColor: colors.white,
    gap: spacing.sm,
  },
  backButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: font.base,
    fontWeight: '600',
    color: colors.gray700,
  },
  nextButton: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    fontSize: font.base,
    fontWeight: '600',
    color: colors.white,
  },
});
