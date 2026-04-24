import React, { useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, Pressable,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { api } from '@/lib/api'
import { colors, spacing, radius, font, shadow } from '@/lib/theme'
import Card from '@/components/Card'

type ReviewStatus = 'pending' | 'submitted' | 'approved' | 'revision_requested'

const STATUS_CONFIG: Record<ReviewStatus, { label: string; bg: string; text: string }> = {
  pending:            { label: 'Pending',           bg: colors.gray100,    text: colors.gray700 },
  submitted:          { label: 'Submitted',         bg: colors.primaryLight, text: colors.primary },
  approved:           { label: 'Approved',          bg: colors.greenLight,  text: colors.green },
  revision_requested: { label: 'Revision Requested', bg: colors.amberLight, text: colors.amber },
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  )
}

function ReviewCard({ item }: { item: any }) {
  const qc = useQueryClient()
  const [showSubmit, setShowSubmit] = useState(false)
  const [note, setNote] = useState('')

  const submitMut = useMutation({
    mutationFn: () => api.reviews.submit(item.id, note || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews'] })
      setShowSubmit(false)
      setNote('')
    },
  })

  const reviewDate = item.reviewDate
    ? new Date(item.reviewDate).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : null

  return (
    <Card style={styles.reviewCard}>
      {/* Header */}
      <View style={styles.reviewHeader}>
        <View style={styles.reviewHeaderLeft}>
          <Text style={styles.reviewTitle} numberOfLines={2}>
            {item.objectiveTitle ?? 'Untitled Objective'}
          </Text>
          <Text style={styles.reviewMeta}>
            {item.reviewCycleName ?? item.cycleName ?? 'Review Cycle'}
            {reviewDate ? ` · ${reviewDate}` : ''}
          </Text>
        </View>
        <StatusBadge status={item.status as ReviewStatus} />
      </View>

      {/* Status context */}
      {item.status === 'submitted' && item.note ? (
        <View style={styles.noteRow}>
          <Ionicons name="chatbubble-outline" size={13} color={colors.gray400} />
          <Text style={styles.noteText} numberOfLines={2}>{item.note}</Text>
        </View>
      ) : null}

      {item.status === 'approved' && (
        <View style={styles.approvedRow}>
          <Ionicons name="checkmark-circle" size={15} color={colors.green} />
          <Text style={styles.approvedText}>
            Approved{item.note ? ` · ${item.note}` : ''}
          </Text>
        </View>
      )}

      {item.status === 'revision_requested' && (
        <View style={styles.revisionRow}>
          <Ionicons name="alert-circle" size={15} color={colors.amber} />
          <Text style={styles.revisionText}>
            Revision requested{item.note ? ` · ${item.note}` : ''}
          </Text>
        </View>
      )}

      {/* Submit action for pending */}
      {item.status === 'pending' && !showSubmit && (
        <TouchableOpacity
          style={styles.submitTrigger}
          onPress={() => setShowSubmit(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="send-outline" size={13} color={colors.primary} />
          <Text style={styles.submitTriggerText}>Submit Review</Text>
        </TouchableOpacity>
      )}

      {/* Inline submit form */}
      {item.status === 'pending' && showSubmit && (
        <View style={styles.submitForm}>
          <Text style={styles.submitFormLabel}>Note (optional)</Text>
          <TextInput
            style={styles.submitFormInput}
            value={note}
            onChangeText={setNote}
            placeholder="Add a note for this review…"
            placeholderTextColor={colors.gray400}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          {submitMut.isError && (
            <Text style={styles.errorText}>Failed to submit. Please try again.</Text>
          )}
          <View style={styles.submitFormButtons}>
            <TouchableOpacity
              style={[styles.submitBtn, submitMut.isPending && styles.btnDisabled]}
              onPress={() => submitMut.mutate()}
              disabled={submitMut.isPending}
              activeOpacity={0.85}
            >
              {submitMut.isPending
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Text style={styles.submitBtnText}>Submit</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { setShowSubmit(false); setNote('') }}
              disabled={submitMut.isPending}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Card>
  )
}

export default function ReviewsScreen() {
  const router = useRouter()
  const [filter, setFilter] = useState<string>('')

  const { data: reviews, isLoading, error, refetch } = useQuery({
    queryKey: ['reviews', filter],
    queryFn: () => api.reviews.list(filter ? { status: filter } : undefined),
    staleTime: 30_000,
  })

  const filtered = reviews ?? []
  const pending = filtered.filter((r: any) => r.status === 'pending').length

  const FILTERS = [
    { label: 'All', value: '' },
    { label: 'Pending', value: 'pending' },
    { label: 'Submitted', value: 'submitted' },
    { label: 'Approved', value: 'approved' },
  ]

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Gradient strip */}
      <View style={styles.brandStrip} pointerEvents="none">
        {(['#0F766E', '#14B8A6', '#2DD4BF'] as const).map((c, i) => (
          <View key={i} style={[styles.brandStripSegment, { backgroundColor: c }]} />
        ))}
      </View>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.gray700} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Reviews</Text>
          {pending > 0 && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>{pending}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterBar}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterPill, filter === f.value && styles.filterPillActive]}
            onPress={() => setFilter(f.value)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterPillText, filter === f.value && styles.filterPillTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to load reviews.</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="clipboard-outline" size={48} color={colors.gray200} />
          <Text style={styles.emptyTitle}>No reviews</Text>
          <Text style={styles.emptyDesc}>
            {filter ? 'Try a different filter.' : 'You have no review items yet.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {filtered.map((item: any) => (
            <ReviewCard key={item.id} item={item} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  brandStrip: { flexDirection: 'row', height: 3 },
  brandStripSegment: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  backBtn: { padding: 4, marginLeft: -4 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: {
    fontSize: font.xl,
    fontWeight: '800',
    color: colors.gray900,
    letterSpacing: -0.5,
  },
  pendingBadge: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  pendingBadgeText: { fontSize: 11, fontWeight: '800', color: colors.white },

  filterBar: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm },
  filterPill: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
  },
  filterPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterPillText: { fontSize: font.sm, fontWeight: '600', color: colors.gray600 },
  filterPillTextActive: { color: colors.white },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },

  reviewCard: { marginBottom: spacing.sm },
  reviewHeader: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  reviewHeaderLeft: { flex: 1 },
  reviewTitle: {
    fontSize: font.base, fontWeight: '700', color: colors.gray900, lineHeight: 21,
  },
  reviewMeta: { fontSize: font.xs, color: colors.gray400, marginTop: 3, fontWeight: '500' },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  badgeText: { fontSize: 11, fontWeight: '600' },

  noteRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    marginTop: spacing.sm, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.gray100,
  },
  noteText: { flex: 1, fontSize: font.sm, color: colors.gray500, fontStyle: 'italic' },

  approvedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: spacing.sm, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.gray100,
  },
  approvedText: { fontSize: font.sm, color: colors.green, fontWeight: '600' },

  revisionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: spacing.sm, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.gray100,
  },
  revisionText: { fontSize: font.sm, color: colors.amber, fontWeight: '600' },

  submitTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: spacing.sm, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.gray100,
    alignSelf: 'flex-start',
  },
  submitTriggerText: { fontSize: font.sm, color: colors.primary, fontWeight: '600' },

  submitForm: {
    marginTop: spacing.sm, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.gray100,
  },
  submitFormLabel: {
    fontSize: font.sm, fontWeight: '600', color: colors.gray700, marginBottom: spacing.xs,
  },
  submitFormInput: {
    borderWidth: 1.5, borderColor: colors.gray200, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    fontSize: font.sm, color: colors.gray900,
    backgroundColor: colors.gray50, minHeight: 72,
    marginBottom: spacing.sm,
  },
  submitFormButtons: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: 9,
    alignItems: 'center', justifyContent: 'center', minWidth: 80,
  },
  btnDisabled: { opacity: 0.55 },
  submitBtnText: { fontSize: font.sm, fontWeight: '700', color: colors.white },
  cancelBtn: { padding: 9 },
  cancelBtnText: { fontSize: font.sm, color: colors.gray500, fontWeight: '600' },

  errorText: { fontSize: font.sm, color: colors.red, textAlign: 'center' },
  retryBtn: { marginTop: spacing.xs, padding: spacing.sm },
  retryBtnText: { fontSize: font.sm, color: colors.primary, fontWeight: '600' },
  emptyTitle: {
    fontSize: font.lg, fontWeight: '700', color: colors.gray700, marginTop: spacing.sm,
  },
  emptyDesc: { fontSize: font.sm, color: colors.gray400, textAlign: 'center' },
})
