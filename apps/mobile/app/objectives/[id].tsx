import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
    case 'percentage': return `${val}%`;
    case 'currency': return `$${val}`;
    case 'binary': return val === 1 ? 'Done' : 'Not done';
    default: return `${val}${kr.unit ? ' ' + kr.unit : ''}`;
  }
}

function formatTarget(kr: any): string {
  const val = kr.targetValue;
  switch (kr.metricType) {
    case 'percentage': return `${val}%`;
    case 'currency': return `$${val}`;
    case 'binary': return val === 1 ? 'Done' : 'Not done';
    default: return `${val}${kr.unit ? ' ' + kr.unit : ''}`;
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
  pending_approval: { bg: colors.amberLight, text: colors.amber },
  draft: { bg: colors.gray100, text: colors.gray500 },
  closed: { bg: colors.gray100, text: colors.gray500 },
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  pending_approval: 'Pending',
  draft: 'Draft',
  closed: 'Closed',
};

const CONFIDENCE_OPTIONS = [
  { value: 'on_track', label: 'On Track' },
  { value: 'at_risk', label: 'At Risk' },
  { value: 'off_track', label: 'Off Track' },
];

const SMART_DIMENSIONS = [
  { key: 'specific', label: 'Specific' },
  { key: 'measurable', label: 'Measurable' },
  { key: 'achievable', label: 'Achievable' },
  { key: 'relevant', label: 'Relevant' },
  { key: 'timeBound', label: 'Time-Bound' },
];

// ─── Check-in Modal ────────────────────────────────────────────────────────────

interface CheckInModalProps {
  kr: any;
  visible: boolean;
  onClose: () => void;
}

function CheckInModal({ kr, visible, onClose }: CheckInModalProps) {
  const queryClient = useQueryClient();
  const [newValue, setNewValue] = useState('');
  const [confidence, setConfidence] = useState('on_track');
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      api.keyResults.checkin(kr.id, { newValue: Number(newValue), confidence, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objective', kr.objectiveId] });
      queryClient.invalidateQueries({ queryKey: ['checkins', kr.id] });
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      setNewValue('');
      setConfidence('on_track');
      setNote('');
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
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle} numberOfLines={2}>
              Check In: {kr.title}
            </Text>
            <Text style={styles.modalCurrentValue}>Current: {formatValue(kr)}</Text>

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

// ─── KR row with expandable check-in history ──────────────────────────────────

function KrDetailRow({ kr }: { kr: any }) {
  const [expanded, setExpanded] = useState(false);
  const [checkinVisible, setCheckinVisible] = useState(false);
  const pct = calcKrPct(kr);

  const { data: checkins, isLoading: checkinsLoading } = useQuery({
    queryKey: ['checkins', kr.id],
    queryFn: () => api.keyResults.checkins(kr.id),
    enabled: expanded,
  });

  return (
    <View style={styles.krDetailRow}>
      <View style={styles.krHeader}>
        <Text style={styles.krTitle} numberOfLines={expanded ? undefined : 2}>
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

      <View style={styles.krActionRow}>
        <TouchableOpacity
          style={styles.historyButton}
          onPress={() => setExpanded((p) => !p)}
          activeOpacity={0.8}
        >
          <Text style={styles.historyButtonText}>
            {expanded ? 'Hide history' : 'View history'}
          </Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={12}
            color={colors.gray500}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.checkInRowButton}
          onPress={() => setCheckinVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.checkInRowButtonText}>Check in</Text>
        </TouchableOpacity>
      </View>

      {expanded && (
        <View style={styles.checkinHistory}>
          {checkinsLoading ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={{ marginVertical: spacing.sm }}
            />
          ) : (checkins ?? []).length === 0 ? (
            <Text style={styles.noHistoryText}>No check-ins yet.</Text>
          ) : (
            (checkins ?? []).slice(0, 5).map((c: any) => (
              <View key={c.id} style={styles.checkinRow}>
                <View style={styles.checkinDot} />
                <View style={styles.checkinContent}>
                  <View style={styles.checkinTopRow}>
                    <Text style={styles.checkinValue}>
                      {c.newValue}{kr.unit ? ' ' + kr.unit : ''}
                    </Text>
                    <ConfidenceBadge confidence={c.confidence} />
                    <Text style={styles.checkinDate}>
                      {new Date(c.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </View>
                  {c.note ? (
                    <Text style={styles.checkinNote}>{c.note}</Text>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </View>
      )}

      <CheckInModal
        kr={kr}
        visible={checkinVisible}
        onClose={() => setCheckinVisible(false)}
      />
    </View>
  );
}

// ─── SMART+ Score card ────────────────────────────────────────────────────────

function SmartScoreCard({ objectiveId }: { objectiveId: string }) {
  const { data: smart, isLoading, error } = useQuery({
    queryKey: ['smart-score', objectiveId],
    queryFn: () => api.objectives.getSmartScore(objectiveId),
    retry: false,
  });

  if (isLoading) {
    return (
      <Card style={styles.cardSpacing}>
        <Text style={styles.sectionLabel}>SMART+ Score</Text>
        <ActivityIndicator size="small" color={colors.primary} />
      </Card>
    );
  }

  if (error || !smart) return null;

  const score = (smart as any).overallScore ?? 0;
  const scoreColor =
    score >= 7 ? colors.green : score >= 4 ? colors.amber : colors.red;
  const feedback = (smart as any).feedback ?? {};

  return (
    <Card style={styles.cardSpacing}>
      <View style={styles.smartHeader}>
        <Text style={styles.sectionLabel}>SMART+ Score</Text>
        <View style={[styles.smartScoreBadge, { backgroundColor: scoreColor + '22' }]}>
          <Text style={[styles.smartScoreNumber, { color: scoreColor }]}>
            {score.toFixed(1)}
          </Text>
          <Text style={[styles.smartScoreMax, { color: scoreColor }]}>/10</Text>
        </View>
      </View>
      {SMART_DIMENSIONS.map((dim) => {
        const d = feedback[dim.key];
        if (!d) return null;
        const dimColor =
          d.score >= 7 ? colors.green : d.score >= 4 ? colors.amber : colors.red;
        return (
          <View key={dim.key} style={styles.smartDimRow}>
            <View style={styles.smartDimLeft}>
              <Text style={styles.smartDimLabel}>{dim.label}</Text>
              {d.comment ? (
                <Text style={styles.smartDimComment} numberOfLines={2}>
                  {d.comment}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.smartDimScore, { color: dimColor }]}>
              {d.score}/10
            </Text>
          </View>
        );
      })}
    </Card>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ObjectiveDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: objective, isLoading, error } = useQuery({
    queryKey: ['objective', id],
    queryFn: () => api.objectives.get(id),
    enabled: !!id,
  });

  const { data: collaborators } = useQuery({
    queryKey: ['collaborators', id],
    queryFn: () => api.collaborators.list(id),
    enabled: !!id,
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
        Objective
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

  if (error || !objective) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {NavBar}
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to load objective.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const krs = (objective as any).keyResults ?? [];
  const avgPct =
    krs.length > 0
      ? krs.reduce((sum: number, kr: any) => sum + calcKrPct(kr), 0) / krs.length
      : 0;

  const levelStyle = LEVEL_COLORS[objective.level] ?? LEVEL_COLORS.individual;
  const statusStyle = STATUS_COLORS[objective.status] ?? STATUS_COLORS.active;
  const statusLabel = STATUS_LABELS[objective.status] ?? objective.status;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {NavBar}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Overview */}
        <Card style={styles.cardSpacing}>
          <View style={styles.badgeRow}>
            <View style={[styles.levelPill, { backgroundColor: levelStyle.bg }]}>
              <Text style={[styles.levelPillText, { color: levelStyle.text }]}>
                {objective.level}
              </Text>
            </View>
            <View style={[styles.statusChip, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusChipText, { color: statusStyle.text }]}>
                {statusLabel}
              </Text>
            </View>
          </View>

          <Text style={styles.objTitle}>{objective.title}</Text>

          {objective.description ? (
            <Text style={styles.objDescription}>{objective.description}</Text>
          ) : null}

          {(objective as any).owner ? (
            <View style={styles.ownerRow}>
              <View style={styles.ownerAvatar}>
                <Text style={styles.ownerAvatarText}>
                  {(objective as any).owner.name?.charAt(0)?.toUpperCase() ?? '?'}
                </Text>
              </View>
              <Text style={styles.ownerName}>{(objective as any).owner.name}</Text>
            </View>
          ) : null}
        </Card>

        {/* Progress */}
        <Card style={styles.cardSpacing}>
          <View style={styles.progressHeader}>
            <Text style={styles.sectionLabel}>Progress</Text>
            <Text style={styles.progressPct}>{Math.round(avgPct)}%</Text>
          </View>
          <ProgressBar pct={avgPct} />
          <Text style={styles.krCountText}>
            {krs.length} key result{krs.length !== 1 ? 's' : ''}
          </Text>
        </Card>

        {/* SMART+ Score */}
        <SmartScoreCard objectiveId={id} />

        {/* Key Results */}
        {krs.length > 0 && (
          <Card style={styles.cardSpacing}>
            <Text style={styles.sectionLabel}>Key Results</Text>
            {krs.map((kr: any, idx: number) => (
              <View key={kr.id}>
                {idx > 0 && <View style={styles.krDivider} />}
                <KrDetailRow kr={kr} />
              </View>
            ))}
          </Card>
        )}

        {/* Collaborators */}
        {(collaborators ?? []).length > 0 && (
          <Card style={styles.cardSpacing}>
            <Text style={styles.sectionLabel}>
              Collaborators ({(collaborators ?? []).length})
            </Text>
            {(collaborators ?? []).map((c: any) => (
              <View key={c.id} style={styles.collaboratorRow}>
                <View style={styles.collaboratorAvatar}>
                  <Text style={styles.collaboratorAvatarText}>
                    {c.user?.name?.charAt(0)?.toUpperCase() ?? '?'}
                  </Text>
                </View>
                <View style={styles.collaboratorInfo}>
                  <Text style={styles.collaboratorName}>
                    {c.user?.name ?? 'Unknown'}
                  </Text>
                  <Text style={styles.collaboratorEmail}>{c.user?.email ?? ''}</Text>
                </View>
                <View
                  style={[
                    styles.collaboratorStatusDot,
                    {
                      backgroundColor:
                        c.status === 'accepted' ? colors.green : colors.amber,
                    },
                  ]}
                />
              </View>
            ))}
          </Card>
        )}
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
  },
  // Overview card
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  levelPill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  levelPillText: {
    fontSize: font.sm,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  statusChip: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  statusChipText: {
    fontSize: font.sm,
    fontWeight: '600',
  },
  objTitle: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: spacing.xs,
    lineHeight: 26,
  },
  objDescription: {
    fontSize: font.base,
    color: colors.gray500,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  ownerAvatar: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerAvatarText: {
    fontSize: font.sm,
    fontWeight: '700',
    color: colors.blue,
  },
  ownerName: {
    fontSize: font.sm,
    color: colors.gray500,
    fontWeight: '500',
  },
  // Progress card
  sectionLabel: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.gray700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  progressPct: {
    fontSize: font.xl,
    fontWeight: 'bold',
    color: colors.primary,
  },
  krCountText: {
    fontSize: font.sm,
    color: colors.gray500,
    marginTop: spacing.xs,
  },
  // SMART+ card
  smartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  smartScoreBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  smartScoreNumber: {
    fontSize: font.xl,
    fontWeight: 'bold',
  },
  smartScoreMax: {
    fontSize: font.sm,
    fontWeight: '600',
    marginLeft: 1,
  },
  smartDimRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  smartDimLeft: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  smartDimLabel: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.gray900,
  },
  smartDimComment: {
    fontSize: font.sm,
    color: colors.gray500,
    marginTop: 2,
    lineHeight: 18,
  },
  smartDimScore: {
    fontSize: font.base,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'right',
  },
  // Key Results
  krDetailRow: {
    paddingVertical: spacing.sm,
  },
  krDivider: {
    height: 1,
    backgroundColor: colors.gray100,
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
    fontSize: font.base,
    fontWeight: '600',
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
  krActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  historyButtonText: {
    fontSize: font.sm,
    color: colors.gray500,
  },
  checkInRowButton: {
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
  // Check-in history
  checkinHistory: {
    marginTop: spacing.sm,
    paddingLeft: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.gray200,
  },
  noHistoryText: {
    fontSize: font.sm,
    color: colors.gray400,
    paddingVertical: spacing.xs,
  },
  checkinRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  checkinDot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    marginTop: 5,
    marginLeft: -spacing.sm - 3.5,
  },
  checkinContent: {
    flex: 1,
  },
  checkinTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  checkinValue: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.gray900,
  },
  checkinDate: {
    fontSize: font.sm,
    color: colors.gray400,
    marginLeft: 'auto',
  },
  checkinNote: {
    fontSize: font.sm,
    color: colors.gray500,
    marginTop: 2,
    lineHeight: 18,
  },
  // Collaborators
  collaboratorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
    gap: spacing.sm,
  },
  collaboratorAvatar: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.tealLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collaboratorAvatarText: {
    fontSize: font.base,
    fontWeight: '700',
    color: colors.teal,
  },
  collaboratorInfo: {
    flex: 1,
  },
  collaboratorName: {
    fontSize: font.base,
    fontWeight: '500',
    color: colors.gray900,
  },
  collaboratorEmail: {
    fontSize: font.sm,
    color: colors.gray500,
    marginTop: 1,
  },
  collaboratorStatusDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  // Modal
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
