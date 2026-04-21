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
import { api, clearToken } from '@/lib/api';
import { colors, spacing, radius, font } from '@/lib/theme';
import Card from '@/components/Card';
import { queryClient } from '@/lib/query';

const ROLE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  admin: { bg: colors.violetLight, text: colors.violet, label: 'Admin' },
  dept_lead: { bg: colors.blueLight, text: colors.blue, label: 'Dept Lead' },
  team_lead: { bg: colors.tealLight, text: colors.teal, label: 'Team Lead' },
  member: { bg: colors.gray100, text: colors.gray700, label: 'Member' },
};

const AUTH_METHOD_LABELS: Record<string, string> = {
  google_sso: 'Google SSO',
  email_password: 'Password',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
}

export default function ProfileScreen() {
  const router = useRouter();

  const { data: me, isLoading, error } = useQuery({
    queryKey: ['me'],
    queryFn: api.auth.me,
  });

  const handleSignOut = async () => {
    await clearToken();
    queryClient.clear();
    router.replace('/(auth)/login');
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

  if (error || !me) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to load profile.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const roleStyle = ROLE_STYLES[me.role] ?? ROLE_STYLES.member;
  const initials = getInitials(me.name ?? 'U');
  const authLabel = AUTH_METHOD_LABELS[me.authType] ?? me.authType ?? 'Unknown';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <Text style={styles.headerSubtitle}>Account settings</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <Card style={styles.cardSpacing}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{me.name}</Text>
              <Text style={styles.profileEmail}>{me.email}</Text>
              {(me.department || me.team) && (
                <Text style={styles.profileMeta}>
                  {[me.department, me.team].filter(Boolean).join(' · ')}
                </Text>
              )}
              <View style={[styles.roleBadge, { backgroundColor: roleStyle.bg }]}>
                <Text style={[styles.roleBadgeText, { color: roleStyle.text }]}>
                  {roleStyle.label}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Account Card */}
        <Card style={styles.cardSpacing}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.accountRow}>
            <Text style={styles.accountRowLabel}>Auth method</Text>
            <Text style={styles.accountRowValue}>{authLabel}</Text>
          </View>
          {me.department && (
            <View style={styles.accountRow}>
              <Text style={styles.accountRowLabel}>Department</Text>
              <Text style={styles.accountRowValue}>{me.department}</Text>
            </View>
          )}
          {me.team && (
            <View style={styles.accountRow}>
              <Text style={styles.accountRowLabel}>Team</Text>
              <Text style={styles.accountRowValue}>{me.team}</Text>
            </View>
          )}
          <View style={[styles.accountRow, styles.accountRowLast]}>
            <Text style={styles.accountRowLabel}>Role</Text>
            <Text style={styles.accountRowValue}>{roleStyle.label}</Text>
          </View>
        </Card>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          activeOpacity={0.85}
        >
          <Text style={styles.signOutButtonText}>Sign Out</Text>
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
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarInitials: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.white,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: font.sm,
    color: colors.gray500,
    marginBottom: 2,
  },
  profileMeta: {
    fontSize: font.sm,
    color: colors.gray500,
    marginBottom: spacing.sm,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  roleBadgeText: {
    fontSize: font.sm,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: font.base,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: spacing.sm,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  accountRowLast: {
    borderBottomWidth: 0,
  },
  accountRowLabel: {
    fontSize: font.base,
    color: colors.gray500,
  },
  accountRowValue: {
    fontSize: font.base,
    fontWeight: '500',
    color: colors.gray900,
  },
  signOutButton: {
    backgroundColor: colors.redLight,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.red,
  },
  signOutButtonText: {
    fontSize: font.base,
    fontWeight: '700',
    color: colors.red,
  },
});
