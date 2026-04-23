import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { colors, spacing, radius, font } from '@/lib/theme';
import Card from '@/components/Card';
import ProgressBar from '@/components/ProgressBar';
import ConfidenceBadge from '@/components/ConfidenceBadge';

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

function formatTarget(kr: any): string {
  const val = kr.targetValue;
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

const LEVEL_COLORS: Record<string, { bg: string; text: string }> = {
  company: { bg: colors.violetLight, text: colors.violet },
  dept: { bg: colors.blueLight, text: colors.blue },
  team: { bg: colors.tealLight, text: colors.teal },
  individual: { bg: colors.gray100, text: colors.gray700 },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: colors.greenLight, text: colors.green },
  pending: { bg: colors.amberLight, text: colors.amber },
};

const CONFIDENCE_OPTIONS = [
  { value: 'on_track', label: 'On Track' },
  { value: 'at_risk', label: 'At Risk' },
  { value: 'off_track', label: 'Off Track' },
];

interface CheckInModalProps {
  kr: any;
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function CheckInModal({ kr, visible, onClose, onSuccess }: CheckInModalProps) {
  const queryClient = useQueryClient();
  const [newValue, setNewValue] = useState('');
  const [confidence, setConfidence] = useState<string>('on_track');
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      api.keyResults.checkin(kr.id, {
        newValue: Number(newValue),
        confidence,
        note,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      setNewValue('');
      setConfidence('on_track');
      setNote('');
      onSuccess();
      onClose();
    },
  });

  const handleClose = () => {
    setNewValue('');
    setConfidence('on_track');
    setNote('');
    onClose();
  };

  if (!kr) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable style={styles.modalOverlay} onPress={handleClose}>
        <Pressable style={styles.modalSheet} onPress={() => {}}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle} numberOfLines={2}>
              Check In: {kr.title}
            </Text>
            <Text style={styles.modalCurrentValue}>
              Current value: {formatValue(kr)}
            </Text>

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
                      confidence === opt.value && styles.confidencePillTextSelected,
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
              <Text style={styles.errorText}>Failed to submit. Please try again.</Text>
            )}

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleClose}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!newValue || mutation.isPending) && styles.submitButtonDisabled,
                ]}
                onPress={() => mutation.mutate()}
                disabled={!newValue || mutation.isPending}
                activeOpacity={0.8}
              >
                {mutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.submitButtonText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface KrRowProps {
  kr: any;
}

function KrRow({ kr }: KrRowProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const pct = calcKrPct(kr);

  return (
    <View style={styles.krRow}>
      <View style={styles.krHeader}>
        <Text style={styles.krTitle} numberOfLines={2}>
          {kr.title}
        </Text>
        <ConfidenceBadge confidence={kr.confidence} />
      </View>
      <View style={styles.krProgressRow}>
        <View style={styles.krProgressBar}>
          <ProgressBar pct={pct} />
        </View>
        <Text style={styles.krValues}>
          {formatValue(kr)} / {formatTarget(kr)}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.checkInRowButton}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.checkInRowButtonText}>Check in</Text>
      </TouchableOpacity>
      <CheckInModal
        kr={kr}
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSuccess={() => {}}
      />
    </View>
  );
}

interface ObjectiveCardProps {
  objective: any;
}

function ObjectiveCard({ objective }: ObjectiveCardProps) {
  const router = useRouter();
  const krs = objective.keyResults ?? [];
  const avgPct =
    krs.length > 0
      ? krs.reduce((sum: number, kr: any) => sum + calcKrPct(kr), 0) / krs.length
      : 0;

  const levelStyle = LEVEL_COLORS[objective.level] ?? LEVEL_COLORS.individual;
  const statusStyle = STATUS_COLORS[objective.status] ?? STATUS_COLORS.active;
  const atRiskCount = krs.filter(
    (kr: any) => kr.confidence === 'at_risk' || kr.confidence === 'off_track',
  ).length;

  return (
    <TouchableOpacity
      onPress={() => router.push(`/objectives/${objective.id}`)}
      activeOpacity={0.85}
    >
      <Card style={styles.cardSpacing}>
        <View style={styles.objTopRow}>
          <View style={[styles.levelPill, { backgroundColor: levelStyle.bg }]}>
            <Text style={[styles.levelPillText, { color: levelStyle.text }]}>
              {objective.level ?? 'individual'}
            </Text>
          </View>
          <View style={[styles.statusChip, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusChipText, { color: statusStyle.text }]}>
              {objective.status === 'active' ? 'Active' : 'Pending'}
            </Text>
          </View>
        </View>

        <Text style={styles.objTitle} numberOfLines={2}>
          {objective.title}
        </Text>

        <View style={styles.progressRow}>
          <View style={styles.progressFill}>
            <ProgressBar pct={avgPct} />
          </View>
          <Text style={styles.pctText}>{Math.round(avgPct)}%</Text>
        </View>

        <View style={styles.objFooter}>
          <Text style={styles.krCountText}>
            {krs.length} KR{krs.length !== 1 ? 's' : ''}
            {atRiskCount > 0 ? (
              <Text style={styles.atRiskText}> · {atRiskCount} at risk</Text>
            ) : null}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
        </View>
      </Card>
    </TouchableOpacity>
  );
}

export default function OKRsScreen() {
  const [search, setSearch] = useState('');

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['me'],
    queryFn: api.auth.me,
  });

  const userId = me?.id;

  const { data: objectives, isLoading: objLoading, error } = useQuery({
    queryKey: ['objectives', 'mine', userId],
    queryFn: () => api.objectives.list({ ownerId: userId }),
    enabled: !!userId,
  });

  const isLoading = meLoading || objLoading;

  const filtered = (objectives ?? []).filter((o: any) =>
    o.title.toLowerCase().includes(search.toLowerCase())
  );

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
      {/* Verve gradient strip */}
      <View style={styles.brandStrip} pointerEvents="none">
        {(['#0F766E', '#14B8A6', '#2DD4BF'] as const).map((c, i) => (
          <View key={i} style={[styles.brandStripSegment, { backgroundColor: c }]} />
        ))}
      </View>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>My OKRs</Text>
        <Text style={styles.headerSubtitle}>
          {(objectives ?? []).length} objective{(objectives ?? []).length !== 1 ? 's' : ''}
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search objectives..."
          placeholderTextColor={colors.gray400}
          clearButtonMode="while-editing"
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No objectives found</Text>
            <Text style={styles.emptyStateDesc}>
              {search ? 'Try a different search term.' : 'You have no objectives yet.'}
            </Text>
          </View>
        ) : (
          filtered.map((obj: any) => <ObjectiveCard key={obj.id} objective={obj} />)
        )}
      </ScrollView>
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
    fontWeight: '800',
    color: colors.gray900,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: font.sm,
    color: colors.gray500,
    marginTop: 2,
  },
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  searchInput: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: font.base,
    color: colors.gray900,
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
  objTopRow: {
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
  statusChip: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusChipText: {
    fontSize: font.sm,
    fontWeight: '600',
  },
  objTitle: {
    fontSize: font.base,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: spacing.sm,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressFill: {
    flex: 1,
  },
  pctText: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.gray700,
    minWidth: 36,
    textAlign: 'right',
  },
  krList: {
    marginTop: spacing.sm,
  },
  krDivider: {
    height: 1,
    backgroundColor: colors.gray100,
    marginBottom: spacing.sm,
  },
  krRow: {
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  krHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  krTitle: {
    flex: 1,
    fontSize: font.sm,
    fontWeight: '500',
    color: colors.gray900,
  },
  krProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  krProgressBar: {
    flex: 1,
  },
  krValues: {
    fontSize: font.sm,
    color: colors.gray500,
    minWidth: 70,
    textAlign: 'right',
  },
  checkInRowButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  checkInRowButtonText: {
    fontSize: font.sm,
    color: colors.primary,
    fontWeight: '600',
  },
  objFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  krCountText: {
    fontSize: font.sm,
    color: colors.gray500,
  },
  atRiskText: {
    color: colors.amber,
    fontWeight: '600',
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl + spacing.lg,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.gray200,
    borderRadius: radius.full,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: spacing.xs,
  },
  modalCurrentValue: {
    fontSize: font.sm,
    color: colors.gray500,
    marginBottom: spacing.md,
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
  modalButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: font.base,
    fontWeight: '600',
    color: colors.gray700,
  },
  submitButton: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
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
});
