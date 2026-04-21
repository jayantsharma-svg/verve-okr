import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  BackHandler,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { api, saveToken } from '@/lib/api'
import { useGoogleSignIn } from '@/lib/useGoogleSignIn'
import { colors, spacing, radius, font } from '@/lib/theme'

export default function LoginScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ google_error?: string }>()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(
    params.google_error ? decodeURIComponent(params.google_error) : null
  )

  const google = useGoogleSignIn({
    onSuccess: () => router.replace('/(tabs)'),
    onError: (msg) => setError(msg),
  })

  // Android: hardware back button on login screen should exit the app
  useEffect(() => {
    if (Platform.OS !== 'android') return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      BackHandler.exitApp()
      return true
    })
    return () => sub.remove()
  }, [])

  async function handleSignIn(emailVal: string, passwordVal: string) {
    if (!emailVal.trim() || !passwordVal.trim()) {
      setError('Please enter your email and password.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await api.auth.loginWithPassword(emailVal.trim(), passwordVal)
      await saveToken(result.accessToken)
      router.replace('/(tabs)')
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Sign in failed. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit() {
    handleSignIn(email, password)
  }

  function handleDevLogin() {
    handleSignIn('admin@capillary.com', 'password123')
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand header */}
          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoLetter}>V</Text>
            </View>
            <Text style={styles.appTitle}>Verve</Text>
            <Text style={styles.appSubtitle}>Capillary Technologies</Text>
          </View>

          {/* Login card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign in to your account</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@capillary.com"
                placeholderTextColor={colors.gray400}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="next"
                value={email}
                onChangeText={setEmail}
                editable={!loading}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.gray400}
                secureTextEntry
                textContentType="password"
                returnKeyType="done"
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={handleSubmit}
                editable={!loading}
              />
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.signInButton, loading && styles.signInButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.signInButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Google SSO */}
            {google.enabled && (
              <>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                  style={[styles.googleButton, (loading || google.loading) && styles.signInButtonDisabled]}
                  onPress={google.signIn}
                  disabled={loading || google.loading}
                  activeOpacity={0.8}
                >
                  {google.loading ? (
                    <ActivityIndicator color={colors.gray700} size="small" />
                  ) : (
                    <>
                      <Text style={styles.googleIcon}>G</Text>
                      <Text style={styles.googleButtonText}>Sign in with Google</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {__DEV__ && (
              <TouchableOpacity
                style={styles.devButton}
                onPress={handleDevLogin}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Text style={styles.devButtonText}>
                  Dev Login (admin@capillary.com)
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  logoLetter: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.white,
  },
  appTitle: {
    fontSize: font.xxl,
    fontWeight: '700',
    color: colors.gray900,
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: font.sm,
    color: colors.gray500,
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: font.md,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: spacing.lg,
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: font.sm,
    fontWeight: '500',
    color: colors.gray700,
    marginBottom: spacing.xs,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    fontSize: font.base,
    color: colors.gray900,
    backgroundColor: colors.white,
  },
  errorBox: {
    backgroundColor: colors.redLight,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: font.sm,
    color: colors.red,
    lineHeight: 18,
  },
  signInButton: {
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  signInButtonDisabled: {
    opacity: 0.6,
  },
  signInButtonText: {
    fontSize: font.base,
    fontWeight: '600',
    color: colors.white,
    letterSpacing: 0.2,
  },
  devButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.sm,
    backgroundColor: colors.gray50,
  },
  devButtonText: {
    fontSize: font.sm,
    color: colors.gray500,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gray200,
  },
  dividerText: {
    marginHorizontal: spacing.sm,
    fontSize: font.sm,
    color: colors.gray400,
  },
  googleButton: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    gap: spacing.sm,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4285F4',
  },
  googleButtonText: {
    fontSize: font.base,
    fontWeight: '500',
    color: colors.gray700,
  },
})
