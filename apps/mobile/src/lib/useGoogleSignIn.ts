import { useState } from 'react'
import { Linking } from 'react-native'
import { saveToken } from './api'

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001'

// Deep link the backend should redirect back to after Google OAuth.
// Must match the app scheme defined in app.json ("scheme": "verve").
const MOBILE_REDIRECT_URI = 'verve://auth/google-callback'

interface UseGoogleSignInResult {
  signIn: () => Promise<void>
  loading: boolean
  /** Always true — Google SSO is always available via the backend */
  enabled: boolean
}

/**
 * Opens the backend's Google OAuth URL in the system browser (Safari/Chrome).
 * After the user approves, the backend redirects to
 *   verve://auth/google-callback?token=<jwt>
 * which is caught by the Linking listener in app/_layout.tsx.
 */
export function useGoogleSignIn(opts: {
  onSuccess: () => void
  onError: (message: string) => void
}): UseGoogleSignInResult {
  const [loading, setLoading] = useState(false)

  async function signIn() {
    setLoading(true)
    try {
      const redirectUri = encodeURIComponent(MOBILE_REDIRECT_URI)
      const url = `${API_URL}/auth/google?mobile_redirect=${redirectUri}`
      const canOpen = await Linking.canOpenURL(url)
      if (!canOpen) {
        opts.onError('Unable to open the sign-in page. Please try again.')
        return
      }
      await Linking.openURL(url)
      // Outcome is handled by the Linking listener in _layout.tsx
    } catch {
      opts.onError('Failed to open sign-in page. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return { signIn, loading, enabled: true }
}

/**
 * Called by the root layout's Linking handler when the deep link
 * verve://auth/google-callback?token=<jwt> is received.
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
