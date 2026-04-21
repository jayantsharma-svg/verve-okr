import { Linking } from 'react-native'
import { api, saveToken } from './api'

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001'
const GOOGLE_CLIENT_ID = process.env['EXPO_PUBLIC_GOOGLE_CLIENT_ID'] ?? ''

// Deep link the backend should redirect back to after Google OAuth
const MOBILE_REDIRECT_URI = 'okrtool://auth/google-callback'

interface UseGoogleSignInResult {
  signIn: () => Promise<void>
  /** True if Google OAuth is configured (real client ID present) */
  enabled: boolean
}

/**
 * Opens the backend's Google OAuth URL in the system browser (Safari).
 * After the user approves, the backend redirects to
 *   okrtool://auth/google-callback?token=<jwt>
 * which is caught by the Linking listener in app/_layout.tsx.
 */
export function useGoogleSignIn(_opts: {
  onSuccess: () => void
  onError: (message: string) => void
}): UseGoogleSignInResult {
  // Hide the button if no real client ID is configured
  const isRealClientId =
    Boolean(GOOGLE_CLIENT_ID) &&
    !GOOGLE_CLIENT_ID.startsWith('your-') &&
    GOOGLE_CLIENT_ID.includes('.apps.googleusercontent.com')

  async function signIn() {
    const redirectUri = encodeURIComponent(MOBILE_REDIRECT_URI)
    const url = `${API_URL}/auth/google?mobile_redirect=${redirectUri}`
    const canOpen = await Linking.canOpenURL(url)
    if (!canOpen) {
      _opts.onError('Unable to open the sign-in page. Please try again.')
      return
    }
    await Linking.openURL(url)
    // Outcome is handled by the Linking listener in _layout.tsx
  }

  return { signIn, enabled: isRealClientId }
}

/**
 * Called by the root layout's Linking handler when the deep link
 * okrtool://auth/google-callback?token=<jwt> is received.
 */
export async function handleGoogleCallbackUrl(
  url: string,
  callbacks: { onSuccess: () => void; onError: (msg: string) => void },
) {
  try {
    const parsed = new URL(url)
    const token = parsed.searchParams.get('token')
    const error = parsed.searchParams.get('error')

    if (error) {
      callbacks.onError(decodeURIComponent(error))
      return
    }
    if (!token) {
      callbacks.onError('Sign-in failed: no token received.')
      return
    }

    await saveToken(token)
    callbacks.onSuccess()
  } catch {
    callbacks.onError('Sign-in failed. Please try again.')
  }
}
