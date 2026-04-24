import { useState } from 'react'
import * as WebBrowser from 'expo-web-browser'
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
 * Opens the backend's Google OAuth URL via ASWebAuthenticationSession
 * (an in-app browser sheet). The app stays in the foreground throughout —
 * no background/foreground transition — and the result URL is returned
 * directly from openAuthSessionAsync when the backend redirects to the
 * verve:// scheme, so no Linking listener is needed.
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
      const authUrl = `${API_URL}/auth/google?mobile_redirect=${redirectUri}`

      const result = await WebBrowser.openAuthSessionAsync(authUrl, MOBILE_REDIRECT_URI)

      if (result.type === 'success') {
        await handleGoogleCallbackUrl(result.url, {
          onSuccess: opts.onSuccess,
          onError: opts.onError,
        })
      }
      // type === 'cancel' or 'dismiss': user closed the sheet, do nothing
    } catch {
      opts.onError('Failed to open sign-in page. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return { signIn, loading, enabled: true }
}

/**
 * Parses the verve://auth/google-callback?token=<jwt> URL,
 * saves the token, and fires the appropriate callback.
 * Still exported so _layout.tsx can use it as a cold-start fallback.
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
