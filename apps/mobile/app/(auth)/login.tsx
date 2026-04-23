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
import { colors, spacing, radius, font, shadow } from '@/lib/theme'
import Logo from '@/components/Logo'

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

  return (
    <SafeAreaView style={styles.safe}>
      {/* Capillary signature gradient strip — 4 color stops rendered as segments */}
      <View style={styles.brandStrip} pointerEvents="none">
        {(['#2FAA4E', '#1CA68F', '#1E90C7', '#1E6BBF'] as const).map((c, i) => (
          <View key={i} style={[styles.brandStripSegment, { backgroundColor: c }]} />
        ))}
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand header */}
          <View style={styles.header}>
            <Logo size={72} showWordmark />
            <Text style={styles.tagline}>Your goals. Your growth.</Text>
          </View>

          {/* Login card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign in</Text>
            <Text style={styles.cardSubtitle}>Use your Capillary account</Text>

            {/* Google SSO — primary action */}
            {google.enabled && (
              <TouchableOpacity
                style={[styles.googleButton, (loading || google.loading) && styles.buttonDisabled]}
                onPress={google.signIn}
                disabled={loading || google.loading}
                activeOpacity={0.85}
              >
                {google.loading ? (
                  <ActivityIndicator color={colors.gray700} size="small" />
                ) : (
                  <>
                    {/* Google logo — 4 coloured arcs mimicked as quadrant segments */}
                    <View style={styles.googleIconWrap}>
                      <View style={styles.googleIconInner}>
                        {/* Top-left: blue  */}
                        <View style={[styles.googleQ, { backgroundColor: '#4285F4', borderTopLeftRadius: 99 }]} />
                        {/* Top-right: red */}
                        <View style={[styles.googleQ, { backgroundColor: '#EA4335', borderTopRightRadius: 99 }]} />
                        {/* Bottom-left: green */}
                        <View style={[styles.googleQ, { backgroundColor: '#34A853', borderBottomLeftRadius: 99 }]} />
                        {/* Bottom-right: yellow */}
                        <View style={[styles.googleQ, { backgroundColor: '#FBBC05', borderBottomRightRadius: 99 }]} />
                        {/* White centre circle to make it look like the G */}
                        <View style={styles.googleCentre} />
                      </View>
                    </View>
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or sign in with email</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Email / password fields */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@capillary.com"
                placeholderTextColor={colors.gray300}
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
                placeholderTextColor={colors.gray300}
                secureTextEntry
                textContentType="password"
                returnKeyType="done"
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={() => handleSignIn(email, password)}
                editable={!loading}
              />
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.signInButton, loading && styles.buttonDisabled]}
              onPress={() => handleSignIn(email, password)}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.signInButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Dev shortcut */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.devButton}
              onPress={() => handleSignIn('admin@capillary.com', 'password123')}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.devButtonText}>⚡ Dev Login</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.footer}>
            Capillary Technologies · Verve
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
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

  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  tagline: {
    marginTop: spacing.md,
    fontSize: font.sm,
    color: colors.gray500,
    letterSpacing: 0.2,
  },

  // ── Card ────────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadow.md,
  },
  cardTitle: {
    fontSize: font.xl,
    fontWeight: '800',
    color: colors.gray900,
    letterSpacing: -0.5,
  },
  cardSubtitle: {
    fontSize: font.sm,
    color: colors.gray500,
    marginTop: 2,
    marginBottom: spacing.lg,
  },

  // ── Google button ────────────────────────────────────────────────────────────
  googleButton: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    gap: spacing.sm,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  /** Outer wrapper sets overall icon size */
  googleIconWrap: {
    width: 22,
    height: 22,
  },
  /** Inner container for the 4 quadrants — overflow hidden makes them circular */
  googleIconInner: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: 'hidden',
    flexDirection: 'row',
    flexWrap: 'wrap',
    position: 'relative',
  },
  /** Each colour quadrant is 50% of the circle */
  googleQ: {
    width: '50%',
    height: '50%',
  },
  /** White central disc punched out to create the "G" ring appearance */
  googleCentre: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.white,
    top: 6,
    left: 6,
  },
  googleButtonText: {
    fontSize: font.base,
    fontWeight: '600',
    color: colors.gray800,
  },

  // ── Divider ──────────────────────────────────────────────────────────────────
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gray100,
  },
  dividerText: {
    fontSize: font.xs,
    color: colors.gray400,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // ── Form ─────────────────────────────────────────────────────────────────────
  fieldGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.gray700,
    marginBottom: spacing.xs,
  },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    fontSize: font.base,
    color: colors.gray900,
    backgroundColor: colors.surface,
  },

  // ── Error ─────────────────────────────────────────────────────────────────────
  errorBox: {
    backgroundColor: colors.redLight,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.red,
  },
  errorText: {
    fontSize: font.sm,
    color: colors.red,
    lineHeight: 18,
  },

  // ── Primary button ───────────────────────────────────────────────────────────
  signInButton: {
    height: 50,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    ...shadow.md,
  },
  buttonDisabled: { opacity: 0.55 },
  signInButtonText: {
    fontSize: font.base,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 0.3,
  },

  // ── Dev ──────────────────────────────────────────────────────────────────────
  devButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  devButtonText: {
    fontSize: font.sm,
    color: colors.gray400,
  },

  // ── Footer ───────────────────────────────────────────────────────────────────
  footer: {
    marginTop: spacing.xl,
    textAlign: 'center',
    fontSize: font.xs,
    color: colors.gray300,
    letterSpacing: 0.3,
  },
})
